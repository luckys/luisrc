---
id: P058
title: 'Latencia y percentiles: qué mide el p99 y qué puede esconder'
published: 2026-10-22T10:00:00Z
locale: es
translationKey: performance-latency-percentiles
slug: latencia-percentiles-histogramas-errores
draft: true
status: draft
level: intermedio
prerequisites: [P055, OPS-LOAD]
description: 'Interpreta p50, p95 y p99 con su muestra, resultado y frontera de medida. Agrega histogramas sin promediar percentiles ni confundir rechazos rápidos con trabajo útil.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, latency, percentiles, testing]
---

El dashboard dice que la mediana ha mejorado. Sin embargo, casi nadie consigue completar la operación: el servicio responde rápido porque está rechazando las peticiones. El número es correcto; la interpretación, no.

Para entender una latencia necesitamos saber **qué se midió, sobre qué respuestas y durante cuánto tiempo**. Un percentil sin esas condiciones puede servir para decorar una gráfica, pero no para decidir si el servicio funciona mejor.

Esta serie amplía [la introducción a carga y saturación](/posts/pruebas-carga-percentiles-saturacion). Separaremos distribuciones, modelos de carga, saturación, pruebas sostenidas, microbenchmarks y profiling. Mantendremos **TypeScript** para el código del servicio y **k6** para generar HTTP desde otro proceso. No compararemos lenguajes ni atribuiremos al hardware una capacidad universal.

## Latencia no es una magnitud sin principio y final

Podemos medir desde que el usuario pulsa un botón hasta que ve el resultado. También desde que empieza una petición HTTP hasta que llega su body, o únicamente el tiempo dentro de un handler. Son fronteras diferentes.

Nuestro nuevo laboratorio conserva muestras de `http_req_duration` de k6: envío, espera y recepción de la respuesta. Esa métrica no incluye la espera inicial por una conexión libre ni el establecimiento de la conexión. Tampoco representa el recorrido completo de una persona por la interfaz.

Si añadimos DNS, TLS, retries o una cola antes del handler, un tiempo interno bajo puede convivir con una experiencia lenta. Antes de comparar dos informes, hay que comprobar que ambos cronometran la misma frontera. La [referencia de métricas de k6](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) permite revisar esa definición concreta.

## p50, p95 y p99 son posiciones de una distribución

Un **percentil** describe un umbral de una muestra ordenada. El **p50**, o mediana, queda en la zona central. p95 y p99 ayudan a mirar la cola, donde se encuentran las observaciones más lentas.

No son la media del cinco o del uno por ciento más lento. Tampoco garantizan que una petición futura vaya a estar por debajo de ese umbral.

En nuestros cálculos usamos **nearest-rank**: para una proporción `p` y `n` observaciones, elegimos la posición `ceil(p × n)`, contando desde uno. Archivo `src/statistics.ts`:

```typescript
export function percentile(values: readonly number[], p: number): number | null {
  if (!Number.isFinite(p) || p <= 0 || p > 1) throw new RangeError('percentile')
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new RangeError('sample')
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(p * sorted.length) - 1]!
}
```

Con `[10, 20, 30, 40, 100]`, p50 es 30 y p95 es 100. Una sola observación decide la cola de una muestra tan pequeña. Mostrar muchos decimales no añade información que no hemos recogido.

Devolvemos `null` si no hay observaciones. Un cero inventado diría que la latencia fue excelente cuando en realidad no se midió nada. También ordenamos una copia para no modificar la entrada de otra comprobación.

<img src="/assets/visuals/performance/P058.svg" alt="Una muestra necesita duración, resultado y frontera; se separan éxitos y errores, se calcula nearest-rank y se agregan distribuciones o buckets compatibles, indicando tamaño y método sin prometer el futuro." width="366" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/P058.svg).

## Un rechazo rápido también puede entrar en el p50

Construyamos una muestra ilustrativa, no una medición de red: dos éxitos de 80 y 100 ms y noventa y ocho errores de 1 ms. Extracto ejecutado de `tests/core.test.mjs`:

```javascript
  const report = summarize([{ ms: 80, status: 200 }, { ms: 100, status: 200 },
    ...Array.from({ length: 98 }, () => ({ ms: 1, status: 503 }))], 2)
  assert.equal(report.all.p50, 1)
  assert.equal(report.success.p50, 80)
  assert.equal(report.completedRps, 50)
  assert.equal(report.successfulRps, 1)
  assert.equal(report.errors, 98)
```

El throughput total es cincuenta respuestas por segundo, pero solo una por segundo corresponde a trabajo exitoso. Mirar únicamente el p50 de todas las respuestas premia el rechazo rápido.

Por eso guardamos distribuciones separadas para **todos**, **éxitos** y **errores**, junto a sus cantidades. Un p95 bajo entre los éxitos tampoco basta si solo dos peticiones llegaron a completarse. Necesitamos leer porcentaje de error y volumen al mismo tiempo.

Este ejemplo utiliza HTTP 200 como éxito. En una API real, un 200 con un resultado de negocio incorrecto puede seguir siendo un fallo para el usuario. El criterio tiene que representar la operación que importa, no limitarse a la familia de status.

## Por qué no se promedian los percentiles de dos instancias

Imagina que una instancia atendió mil peticiones rápidas y otra, diez lentas. Promediar sus p95 da el mismo peso a distribuciones con tamaños distintos y descarta cómo se reparten las observaciones dentro de cada una.

Ni siquiera ponderar los dos percentiles por su cantidad reconstruye, en general, el percentil global. Ya hemos perdido información. Necesitamos las muestras o una representación agregable de sus distribuciones.

Un **histograma** cuenta observaciones dentro de intervalos. Nuestro helper utiliza buckets no acumulativos con límites compartidos y un último bucket de desbordamiento. Por ejemplo, `[2, 5]` separa valores de hasta dos, mayores de dos hasta cinco y mayores de cinco.

Para sumar dos histogramas exigimos los mismos límites. Después sumamos sus conteos. No recuperamos los valores exactos de cada bucket: un percentil estimado a partir de ellos conserva esa incertidumbre. Tampoco hay que confundir este formato didáctico con el de cualquier backend de métricas, que puede utilizar buckets acumulativos u otra representación.

## Conservar método y muestra evita discrepancias falsas

Dos herramientas pueden obtener números algo distintos usando interpolación en lugar de nearest-rank. Eso no demuestra que una esté rota. Antes de investigar un decimal, hay que revisar el método y qué observaciones se incluyeron.

El laboratorio conserva las muestras HTTP, las métricas de k6 y nuestros cálculos separados en `evidence/load.json`. Podemos recalcularlos. El informe no contiene únicamente un p99 que ya no sabemos de dónde salió.

No mezclamos tampoco una ventana de cinco segundos bajo stress con otra de sesenta a baja carga para afirmar un único comportamiento estable. Cada escenario tiene su contexto.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p058/README.md) y [cálculos de distribuciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/src/statistics.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab test
pnpm --dir packages/performance-lab verify
```

## Garantías y límites

Los tests comprueban ejemplos de percentiles, entradas inválidas, distribuciones separadas y agregación de histogramas. Las mediciones HTTP son locales y sintéticas; sus ventanas no prueban capacidad de producción ni aportan intervalos de confianza.

La precisión de representación de un número no sustituye tamaño de muestra, repetición o control del entorno. Un p99 de cien observaciones sigue dependiendo de muy pocos puntos de la cola.

## Ejercicio: detectar una mejora que no existe

Compara un servicio con cien éxitos de 80 ms y otro con dos éxitos de 80 ms y noventa y ocho rechazos de 1 ms. Escribe qué dashboard necesitarías para no declarar ganador al segundo. Incluye el criterio de éxito y el denominador de cada tasa.

Seguimos con [open-loop y closed-loop](/posts/k6-modelos-carga-open-closed-loop): antes de interpretar la distribución también hay que entender cómo llegó el trabajo.

## Referencias

- [Google SRE: distribuciones, latencia y señales de servicio](https://sre.google/sre-book/monitoring-distributed-systems/).
- [k6: métricas HTTP y duración de iteraciones](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/).

Fuentes consultadas el 22 de octubre de 2026. Cálculos propios con nearest-rank; no se presentan como el algoritmo interno de k6.
