---
id: PERF-SOAK
title: 'Soak testing: mirar el paso del tiempo, no solo el resultado final'
published: 2026-10-22T10:03:00Z
locale: es
translationKey: performance-soak-windows
slug: soak-testing-carga-sostenida-ventanas
draft: true
status: draft
level: intermedio
prerequisites: [PERF-SATURATION]
description: 'Analiza una ejecución sostenida mediante ventanas de finalización. Distingue el ejercicio local de sesenta segundos de un soak test que investigue degradación durante horas.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, soak-testing, load-testing, time-series]
---

Un servicio puede pasar una prueba corta y empeorar después de varias horas. Una caché crece, un recurso no se libera o se acumulan tareas. El resultado del primer minuto no responde a esas preguntas.

El **soak testing** investiga comportamiento durante periodos prolongados bajo una carga elegida. Para leerlo necesitamos conservar el paso del tiempo, no solo un percentil calculado al terminar.

Después de [saturación y recuperación](/posts/saturacion-stress-testing-admision-recuperacion), ejecutaremos una fase local de sesenta segundos y la dividiremos en ventanas. **Es una prueba sostenida corta, no un soak test de horas**. Esa frontera es parte del aprendizaje, no una nota que convenga esconder.

## Qué cambia cuando la pregunta incluye duración

Un stress test busca comportamiento al superar límites. Una prueba sostenida puede mantenerse por debajo de ellos y preguntar si las condiciones empeoran con el tiempo.

La duración debe guardar relación con el mecanismo sospechado: ciclos de caché, renovaciones, tareas periódicas, generación de datos o uso de pools. Llamar «soak» a cualquier ejecución larga no elige esos mecanismos por nosotros.

Antes de mantener horas de carga hay que comprobar que el script valida la operación correcta y que el entorno puede detenerse con seguridad. Una prueba breve valida ese recorrido, pero no hereda las garantías de la larga que todavía no hemos hecho.

## La fase ejecutada mantiene una carga baja y explícita

El array de planes de `scripts/measure-load.mjs` contiene esta entrada:

```javascript
  { name: 'steady-60s', mode: 'open', rate: 25, vus: 40, seconds: 60, expected: 0 }
```

Es un extracto del array, no un objeto para pegar como programa independiente. El runner lo transforma en variables del escenario de k6 y limita la duración máxima admitida por el script a sesenta segundos.

La fase llega después del resto de escenarios sobre el mismo fixture. Registra **1501 respuestas exitosas**, sin errores ni iteraciones descartadas. La diferencia respecto a `25 × 60` pertenece a los bordes del calendario de ejecución; el informe utiliza el conteo real y su duración observada.

El endpoint sigue esperando cuarenta milisegundos con un límite de ocho operaciones activas. No contiene una caché creciente o un pool real que estemos dejando envejecer.

<img src="/assets/visuals/performance/PERF-SOAK.svg" alt="La fase local programa veinticinco iteraciones por segundo durante sesenta segundos; las finalizaciones se agrupan en ventanas de diez segundos y se marca la última parcial, sin afirmar estabilidad de horas ni medir heap en esta fase." width="364" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/PERF-SOAK.svg).

## Un agregado puede ocultar cuándo empeoró el servicio

Si una ejecución es rápida al principio y lenta al final, una sola distribución mezcla ambas etapas. El percentil resultante no conserva el momento en que empezó el cambio.

k6 emite estas métricas HTTP al finalizar la petición; son **ventanas de finalización**, no un registro exacto de llegadas programadas. La diferencia importa si hay trabajo pendiente que termina después.

El helper de `src/windows.ts` usa como origen la primera observación. `TimedSample` combina `ms`, `status` y un timestamp ISO en `at`:

```typescript
export function groupWindows(samples: readonly TimedSample[], seconds = 10) {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('window')
  if (samples.length === 0) return []
  const times = samples.map((sample) => Date.parse(sample.at))
  if (times.some((time) => !Number.isFinite(time))) throw new RangeError('time')
  const first = Math.min(...times)
  const last = Math.max(...times)
  const groups = new Map<number, TimedSample[]>()
  for (let i = 0; i < samples.length; i++) {
    const bucket = Math.floor((times[i]! - first) / (seconds * 1000))
    const group = groups.get(bucket) ?? []
    group.push(samples[i]!)
    groups.set(bucket, group)
  }
  return [...groups].sort(([a], [b]) => a - b).map(([bucket, rows]) => ({
    fromSecond: bucket * seconds, complete: last >= first + (bucket + 1) * seconds * 1000,
    ...summarize(rows, seconds),
  }))
}
```

Importa `summarize` del módulo de estadísticas. Conserva cantidades y percentiles por grupo y marca si hay observaciones posteriores al final de la ventana. No crea buckets vacíos ni reconstruye un calendario de llegadas que no está en estos datos.

## Una ventana parcial no tiene el mismo denominador

Estos son los grupos observados, con el tiempo relativo a la primera finalización:

<div role="region" aria-label="Ventanas de la prueba sostenida local" tabindex="0" style="overflow-x:auto">
<div style="min-width:34rem">

| Desde | Respuestas | p95 de éxitos | Ventana cubierta por observaciones posteriores |
| --- | --- | --- | --- |
| 0 s | 250 | 41,12 ms | Sí |
| 10 s | 251 | 41,18 ms | Sí |
| 20 s | 250 | 41,17 ms | Sí |
| 30 s | 250 | 41,21 ms | Sí |
| 40 s | 250 | 41,32 ms | Sí |
| 50 s | 250 | 41,16 ms | No, última ventana parcial |

</div>
</div>

No interpretamos el throughput de la última como si hubiéramos observado diez segundos completos desde su origen. El helper marca esa diferencia aunque calcule campos normalizados con el ancho nominal. El visor muestra cantidades y percentiles, y señala la parcialidad.

Tener observaciones posteriores tampoco demuestra que no falten muestras dentro de una ventana. Para investigar huecos harían falta señales del colector. Aquí tenemos las muestras escritas por el generador local.

## Explorar la ejecución sin volver a enviar tráfico

El visor permite elegir una fase y consultar sus resultados archivados. En la fase sostenida añade las ventanas anteriores. No ejecuta k6 ni consulta el servicio desde el navegador:

<iframe src="/assets/interactive/performance-series/explorer.html?stage=steady-60s" title="Resultados archivados de carga y ventanas de la fase sostenida" width="100%" height="760" loading="lazy" style="border:0;border-radius:12px"></iframe>

[Abrir el visor en otra pestaña](/assets/interactive/performance-series/explorer.html?stage=steady-60s).

Los p95 se mantienen cerca de cuarenta y un milisegundos en esos grupos. Podemos afirmarlo sobre esta ejecución. No hay base para concluir que no aparecería degradación al repetirla durante ocho horas o con un dataset creciente.

## Qué faltaría para un soak test de servicio

Necesitaríamos una carga representativa, duración justificada y condiciones de parada. También series de memoria, conexiones, descriptores, colas y almacenamiento, según el servicio.

Habría que observar pendiente y recuperación y conservar cambios del entorno. Una tarea programada, un despliegue o una caché que expira pueden explicar diferencias que no vienen del código probado.

En esta fase no muestreamos heap por ventanas ni medimos una fuga del servidor. El [laboratorio de memoria](/posts/memory-profiling-heap-snapshots-retencion-cache) es un experimento separado con una caché deliberada. No debemos unirlos como si fueran una misma ejecución.

## Código completo y pruebas

[Índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/perf-soak/README.md) y [agrupación temporal](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/src/windows.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab tools:install
pnpm --dir packages/performance-lab measure:load
```

## Garantías y límites

Sesenta segundos reales de carga baja en loopback. Sin soak prolongado, datos crecientes, ciclos de renovación, pools externos o aislamiento de CPU. Las ventanas no son seis repeticiones independientes del experimento.

El helper carga estas muestras acotadas en memoria. Para campañas grandes necesitaríamos revisar almacenamiento y agregación incremental. Ampliar la duración requiere esas decisiones operativas, no únicamente cambiar el nombre del escenario.

## Ejercicio: elegir una duración por un mecanismo

Supón que una caché expira cada treinta minutos. Escribe qué necesitarías observar antes y después de varias expiraciones y qué métricas diferenciarían un crecimiento acotado de acumulación. No propongas una duración solo porque suene suficientemente larga.

Seguimos con [microbenchmarks y reproducibilidad](/posts/microbenchmarks-warmup-reproducibilidad-typescript), donde compararemos dos implementaciones sin confundir esa medida con capacidad de un servicio.

## Referencias

- [k6: soak testing, duración y recursos](https://grafana.com/docs/k6/latest/testing-guides/test-types/soak-testing/).
- [k6: timestamps y métricas HTTP](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/).

Fuentes consultadas el 22 de octubre de 2026. El informe declara longSoakExecuted: false.
