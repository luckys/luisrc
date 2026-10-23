---
id: PERF-SATURATION
title: 'Saturación y stress testing: medir trabajo útil y comprobar la recuperación'
published: 2026-10-22T10:02:00Z
locale: es
translationKey: performance-saturation-recovery
slug: saturacion-stress-testing-admision-recuperacion
draft: true
status: draft
level: intermedio
prerequisites: [PERF-MODELS]
description: 'Sobrecarga un fixture HTTP local, separa trabajo aceptado de rechazos y verifica recuperación. La CPU baja no garantiza que quede capacidad en el recurso limitado.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, stress-testing, saturation, backpressure]
---

El servidor responde unas 348 veces por segundo, pero solo completa alrededor de 190 operaciones útiles. Las demás son rechazos. Su CPU tampoco está cerca del cien por ciento.

No hay contradicción: hemos saturado un límite de admisión, no la capacidad de cálculo del procesador. La pregunta útil es **qué recurso impide aceptar más trabajo** y cómo se comporta el servicio al superarlo.

Usaremos [el generador open-loop](/posts/k6-modelos-carga-open-closed-loop) de la entrega anterior. El objetivo del **stress testing** es observar el comportamiento fuera de la carga que el fixture puede admitir, incluidos los rechazos y la recuperación posterior. No mediremos una API de producción ni un proveedor externo.

## El recurso limitado es una decisión explícita

El endpoint admite ocho operaciones simultáneas. Cada una espera artificialmente cuarenta milisegundos y luego responde. Si no hay hueco, devuelve `503` sin guardar la petición en una cola ilimitada.

Extracto de `src/server.ts`, dentro del handler de `/work`:

```typescript
      if (stats.active >= 8) { stats.rejected++; response.writeHead(503).end('overloaded'); return }
      stats.active++
      stats.maxActive = Math.max(stats.maxActive, stats.active)
      setTimeout(() => {
        stats.active--
        stats.accepted++
        response.writeHead(200, { 'content-type': 'text/plain' }).end('ok')
      }, 40)
```

La espera representa ocupación de un recurso, no un cálculo de cuarenta milisegundos. Podría ayudar a razonar sobre un pool o una dependencia lenta, pero el laboratorio no contiene ninguno de esos sistemas reales. El contador es local a un proceso.

Una cuenta ideal, `8 / 0.040`, da doscientas operaciones por segundo si cada hueco se reutilizara inmediatamente y no hubiera ningún otro coste. Es una referencia derivada de las condiciones impuestas, no una medición ni una promesa de capacidad.

<img src="/assets/visuals/performance/PERF-SATURATION.svg" alt="La oferta sube de cien a trescientas cincuenta llegadas por segundo; ocho operaciones esperan cuarenta milisegundos y las restantes reciben 503; se miden éxitos, rechazos y CPU, y después se baja la carga para verificar recuperación." width="385" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/PERF-SATURATION.svg).

## Leer la carga ofrecida junto al trabajo completado

La ejecución archivada contiene dos ventanas de stress con la misma configuración. Los conteos son observados, no una multiplicación de la tasa configurada por la duración nominal:

<div role="region" aria-label="Resultados locales de admisión y recuperación" tabindex="0" style="overflow-x:auto">
<div style="min-width:45rem">

| Escenario | Respuestas | Éxitos | Rechazos | Éxitos/s | p95 de éxitos |
| --- | --- | --- | --- | --- | --- |
| Open, 100/s | 500 | 500 | 0 | 99,38 | 41,55 ms |
| Open, 350/s, A | 1751 | 958 | 793 | 190,21 | 40,97 ms |
| Open, 350/s, B | 1751 | 953 | 798 | 189,06 | 41,11 ms |
| Recuperación, 25/s | 101 | 101 | 0 | 24,99 | 41,40 ms |

</div>
</div>

El denominador del throughput es la duración de ejecución registrada por k6, que incluye el cierre de las iteraciones en curso. Por eso no tiene que coincidir exactamente con dividir por los segundos nominales del escenario. Una llegada en un borde temporal también puede producir un conteo que no sea exactamente `rate × duration`.

<img src="/assets/interactive/performance-series/load-results.svg" alt="Gráfica derivada de las muestras locales: cerca de cien éxitos por segundo a carga cien; al ofrecer trescientos cincuenta, el trabajo útil ronda ciento noventa y aparecen rechazos; la recuperación a veinticinco no tiene errores." width="360" height="430" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/interactive/performance-series/load-results.svg).

## Un p95 estable puede ser parte de la protección

El p95 de las operaciones aceptadas sigue cerca de cuarenta y un milisegundos. Eso no significa que el servicio haya procesado las 350 llegadas por segundo: dejó fuera muchas.

Rechazar pronto puede impedir que una cola crezca sin límite y alargue la espera de todas las peticiones. Tiene un coste visible: parte del trabajo no se atiende. Hay que comprobar si el cliente puede reintentar, con qué política y sin duplicar efectos.

Este ejemplo no implementa esos retries. Si los clientes reintentaran inmediatamente cada `503`, cambiarían la carga ofrecida y podrían agravar la saturación. No podemos inferir su comportamiento a partir del endpoint aislado.

## CPU baja no significa que sobre capacidad de admisión

Durante las dos ventanas de stress, la CPU consumida por el proceso del servidor equivale aproximadamente al 4,6 % y al 5,7 % de un núcleo durante cada intervalo. No es una lectura de utilización de toda la máquina ni una garantía de precisión al decimal.

El dato encaja con el mecanismo conocido: la mayor parte del tiempo de cada operación es una espera, y el límite de ocho está impuesto por la aplicación. Comprar más CPU o reescribir el contador no elimina ese límite.

En otro servicio, el recurso podría ser CPU, conexiones, memoria, IOPS o la cuota de una API. Las métricas ayudan a formular una hipótesis; la configuración y las pruebas del recurso concreto permiten contrastarla. No estamos diagnosticando una base de datos a partir de este timer.

## Thresholds que no premian el rechazo rápido

El script de k6 conserva estas condiciones:

```javascript
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    dropped_iterations: ['count==0'],
    'http_req_duration{expected_response:true}': ['p(95)<200'],
  },
```

El límite de latencia entre respuestas consideradas correctas puede pasar mientras la tasa de error falla. Esa es una información importante, no una molestia que debamos quitar para dejar la ejecución verde.

Las fases de stress salen con el código de incumplimiento esperado. El harness exige además rechazos reales y cero iteraciones descartadas. Así distingue sobrecarga observada del servidor de un generador que ni siquiera envió la carga prevista.

## La prueba no termina al alcanzar el límite

Después de las dos ventanas de stress bajamos a veinticinco llegadas por segundo. Las 101 respuestas observadas son exitosas y el contador de operaciones activas vuelve a cero entre fases.

Eso verifica recuperación de este fixture bajo esa secuencia concreta. No hemos demostrado recuperación tras una caída de proceso, un pool bloqueado o una cola acumulada en disco. Aquí no existe esa cola.

Repetir dos ventanas también ayuda a detectar una diferencia evidente, pero no aporta por sí solo un intervalo estadístico ni una capacidad sostenible certificada. Para decidir un límite operativo harían falta una carga representativa, márgenes y un entorno apropiado.

## Código completo y pruebas

[Archivos de la entrega](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/perf-saturation/README.md) y [runner acotado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/scripts/measure-load.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab tools:install
pnpm --dir packages/performance-lab measure:load
```

## Garantías y límites

HTTP real, procesos separados y una sola máquina compartida. Espera y admisión sintéticas, sin SQL, TLS, retries, balanceador, réplicas ni tráfico de usuarios. Las métricas guardan las muestras de cada fase, no solo la tabla redondeada.

No recomendamos extrapolar 190 operaciones por segundo a otro sistema ni considerar este valor un SLO. Es el resultado local de una política que conocemos de antemano.

## Ejercicio: decidir dónde esperar

Diseña una variante con cola limitada y presupuesto total de espera. Antes de implementarla, define qué contará como rechazo y qué latencia verá una petición que espere antes de ser admitida. No midas solo los cuarenta milisegundos posteriores al acceso al recurso.

La siguiente entrega estudia [carga sostenida y ventanas temporales](/posts/soak-testing-carga-sostenida-ventanas): admitir el trabajo ahora no demuestra que el servicio siga igual una hora después.

## Referencias

- [Google SRE: manejar sobrecarga](https://sre.google/sre-book/handling-overload/).
- [k6: criterios de aceptación mediante thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/).

Fuentes consultadas el 22 de octubre de 2026. Conteos y muestras en evidence/load.json; tabla con redondeo solo para lectura.
