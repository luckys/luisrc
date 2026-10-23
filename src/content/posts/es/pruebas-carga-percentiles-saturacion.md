---
id: OPS-LOAD
title: 'Pruebas de carga: leer percentiles sin esconder la saturación'
published: 2026-10-17T04:02:00Z
locale: es
translationKey: reliable-load-tests
slug: pruebas-carga-percentiles-saturacion
draft: true
status: draft
level: intermedio
prerequisites: [OPS-SIGNALS, DESIGN-REQUIREMENTS]
description: 'Interpreta latencia, throughput y rechazos juntos con una medición HTTP local reproducible. Un percentil bajo puede ocultar un servicio que rechaza casi todo.'
author: 'Luis Ramírez Calle'
series: 'Probar y operar servicios fiables'
tags: [rendimiento, testing, percentiles, benchmarking]
---

Subimos la carga y la mediana baja. Parece una victoria hasta que miramos los status: el servicio está rechazando trabajo rápidamente. Una respuesta de error de dos milisegundos también entra en los percentiles si no distinguimos qué estamos midiendo.

Después de [definir señales](/posts/observabilidad-logs-metricas-trazas-workers), mediremos un servicio sintético para observar ese efecto. La meta no es atribuir rendimiento a Node.js, sino aprender a leer una prueba sin separar la latencia del resultado.

La serie específica de [latencia, carga y profiling](/posts/latencia-percentiles-histogramas-errores) amplía este punto con k6 en otro proceso, distribuciones por resultado y perfiles reales. Este laboratorio introductorio conserva sus condiciones y sus mediciones originales.

## Qué significa un percentil de una muestra

El **p95** señala un umbral bajo el que queda aproximadamente el 95 % de las observaciones, según el método de cálculo. No es la media de las peticiones lentas ni significa que cada usuario reciba ese tiempo.

En el laboratorio usamos **nearest-rank**: ordenamos valores y tomamos la posición `ceil(0.95 × n)`. Con `[10, 20, 30, 40, 100]`, devuelve 100. Es un ejemplo calculado, no un resultado de red.

Los percentiles de dos instancias no se promedian para obtener el percentil global. Necesitamos sus distribuciones o una estructura agregable apropiada. Un histograma también requiere elegir límites y entender su precisión.

## Un servidor pequeño con saturación deliberada

El servidor del experimento acepta cuatro operaciones simultáneas. Cada una espera artificialmente 20 ms antes de responder. Las demás reciben `503`. Ese tiempo es una condición impuesta, no una capacidad inferida de hardware.

Archivo: `reliable-services/tools/load.mjs` (extracto).

```javascript
let active = 0
const server = createServer((_request, response) => {
  if (active >= 4) {
    response.writeHead(503)
    response.end('overloaded')
    return
  }
  active++
  setTimeout(() => {
    active--
    response.writeHead(200)
    response.end('ok')
  }, 20)
})
```

El archivo completo incluye imports, escucha únicamente en loopback con puerto efímero, cliente y cierre del servidor. Tras cinco solicitudes de warm-up ejecuta tres etapas de 120 solicitudes, con concurrencias 1, 4 y 12. Guarda cada muestra y su status.

<img src="/assets/visuals/reliable-services/OPS-LOAD.svg" alt="La prueba combina un generador closed-loop con un servicio sintético limitado a cuatro operaciones, y registra tanto latencias como respuestas 200 y 503." width="648" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/OPS-LOAD.svg).

## Leer el experimento con todos sus resultados

<img src="/assets/visuals/reliable-services/load-results.svg" alt="Medición local: las etapas con concurrencia 1 y 4 aceptaron las 120 solicitudes; con concurrencia 12 hubo 12 aceptadas y 108 rechazos." width="900" height="450" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/reliable-services/load-results.svg).

La gráfica procede de `results/load.json`, no de valores dibujados a mano. En esa ejecución, la mediana pasó de unos **23.17 ms** con concurrencia 4 a **3.58 ms** con concurrencia 12. Sin embargo, en la última etapa **108 de 120 respuestas fueron rechazos**.

El script imprime throughput total, throughput exitoso y percentiles que incluyen errores. El trabajo exitoso pasó de unos 170 a 166 resultados por segundo en esas etapas. La mejora aparente de mediana no representó más trabajo útil. Son observaciones de esta ejecución, no una diferencia estadísticamente estable.

Para una investigación real añadiríamos distribuciones separadas de éxito y fallo y latencia total de negocio. Hay que leer cantidad, duración y resultado juntos.

## Closed-loop puede ocultar presión

En un modelo **closed-loop**, cada cliente espera la respuesta antes de lanzar su siguiente petición. Si el servidor tarda más, los clientes generan menos solicitudes por segundo. No representa una tasa externa que sigue llegando independientemente de la lentitud.

Un modelo **open-loop** programa llegadas según una tasa y permite observar cola y retrasos bajo esa presión, siempre que el generador tenga capacidad. Herramientas como k6 ofrecen distintos executors; elegir uno forma parte del experimento, no es una opción cosmética.

Para investigar una API real registraríamos versión, hardware, dataset, configuración, pool, cachés y repeticiones. Un profiler de CPU o memoria ayudaría a localizar el cuello de botella. El percentil por sí solo no dice si la causa es cálculo, bloqueo, GC o una consulta.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/ops-load/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

Esta es una ejecución real de HTTP local, pero **cliente y servidor comparten proceso y máquina**. No mide PostgreSQL, proveedores, tráfico real, stress prolongado ni capacidad de producción. La muestra por etapa es pequeña y no aporta intervalos estadísticos.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/tools/load.mjs). Desde `reliable-services/`:

```bash
node tools/load.mjs
```

El comando reemplaza el resultado local y puede obtener valores distintos. El gráfico del blog conserva la ejecución documentada en el repositorio hasta regenerarse.

## Ejercicio: separar lo que parecía una mejora

Calcula p95 solo de éxitos y compara throughput exitoso con total. Explica qué cambia al contar los `503` como respuestas rápidas. No concluyas capacidad sostenible a partir de esta única ejecución.

La siguiente entrega define [SLI, SLO y error budget](/posts/sli-slo-error-budget-servicios) para decidir qué resultados nos importan.

## Referencias

- [Grafana k6: open y closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/).
- [Google SRE: monitoring y distribuciones de latencia](https://sre.google/sre-book/monitoring-distributed-systems/).
- [Node.js 24: performance measurement APIs](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html).

Fuentes consultadas el 17 de octubre de 2026. Condiciones y muestras en `results/load.json`.
