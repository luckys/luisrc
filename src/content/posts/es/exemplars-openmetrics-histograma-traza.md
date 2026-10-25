---
id: OBS-EXEMPLARS
title: 'Exemplars: abrir una traza desde un histograma sin crear una serie por petición'
published: 2026-10-23T01:05:00Z
locale: es
translationKey: observability-openmetrics-exemplars
slug: exemplars-openmetrics-histograma-traza
draft: true
status: draft
level: intermedio
prerequisites: [OBS-METRICS]
description: 'Relaciona una observación de histograma con su trace ID y span ID mediante exemplars. Implementa un reservoir acotado, expone OpenMetrics y revisa sus límites de muestreo y soporte.'
author: 'Luis Ramírez Calle'
series: 'Observabilidad: seguir una operación sin confundir señales'
tags: [opentelemetry, openmetrics, exemplars, tracing]
---

El histograma muestra duraciones altas, pero no dice qué operación concreta podemos abrir para investigar. Añadir un trace ID como label resolvería la búsqueda a costa de crear potencialmente una serie por petición.

Un **exemplar** conecta una observación concreta con información de contexto sin convertir esa identidad en una dimensión de la serie. Permite pasar del agregado a un ejemplo, no recuperar todos los eventos que lo formaron.

Después de [agregar duraciones con OpenTelemetry](/posts/metricas-opentelemetry-histogramas-cardinalidad), construiremos esa conexión y la recorreremos en un visor con los resultados reales del laboratorio.

## Un exemplar no es otro bucket ni otro percentil

El histograma conserva recuentos y suma. Un exemplar retiene una muestra asociada: su valor y, en nuestro caso, trace ID y span ID.

Esa muestra no tiene por qué ser el máximo, el p99 ni una selección representativa de los errores. Depende de la política del **reservoir**, el conjunto acotado donde se guardan candidatos.

No conviene interpretar «abrir este exemplar» como «abrir la petición que explica toda la degradación». Podemos encontrar una pista útil, pero después hay que contrastarla con la distribución, otras trazas y el código.

## Hay que comprobar soporte en cada tramo

La especificación describe exemplars, pero eso no significa que cada SDK, exporter, Collector y backend implemente todas las piezas compatibles.

En la versión fijada aquí, **`@opentelemetry/sdk-metrics` 3.0.0**, la estructura pública de `DataPoint` no incluye exemplars y el SDK no los exporta. No vamos a presentar una opción de configuración inexistente como si bastara activarla.

Usaremos el SDK para agregar el histograma y un **reservoir propio** para conservar muestras correlacionadas. Después construiremos una exposición **OpenMetrics 1.0**. Esta separación forma parte del ejemplo; no es una implementación nativa de exemplars del SDK ni una recomendación de mantener un exporter casero en producción.

En un sistema real convendría elegir una integración soportada y comprobar la cadena completa: emisión, transporte, almacenamiento y enlace de consulta. Ver el trace ID en un texto no prueba que el backend lo indexe ni que la traza siga retenida.

<img src="/assets/visuals/observability/OBS-EXEMPLARS.svg" alt="Una duración se agrega en el SDK y una muestra sampled se conserva en un reservoir propio; OpenMetrics la añade fuera de los labels de serie y el visor resuelve trace ID y span ID solo si el span está disponible." width="350" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/observability/OBS-EXEMPLARS.svg).

## Un reservoir pequeño cuya política podamos explicar

Nuestra política guarda la **última observación con contexto sampled válido por bucket y resultado**. Hay cinco intervalos y dos resultados posibles, de modo que conserva como máximo diez entradas.

No hace selección aleatoria uniforme ni pondera por tiempo. Una muestra posterior puede sustituir otra anterior. Conservarla no altera el count ni la suma del histograma: todas las observaciones válidas siguen agregándose, tengan exemplar o no.

Parte de `record`, en `src/metrics.ts`:

```typescript
    histogram.record(seconds, { result }, ctx)
    const span = trace.getSpanContext(ctx)
    if (!span || !isSpanContextValid(span) || !(span.traceFlags & TraceFlags.SAMPLED)) return
    const found = boundaries.findIndex((upper) => seconds <= upper)
    const bucket = found < 0 ? boundaries.length : found
    reservoir.set(`${result}:${bucket}`, { result, bucket, value: seconds, traceId: span.traceId, spanId: span.spanId })
```

El archivo completo valida antes la duración y el vocabulario de resultados. La clave del Map no contiene trace ID. Eso limita el número de muestras, aunque procesemos muchos jobs.

La flag sampled hace que el contexto sea candidato, no garantiza que la exportación o la retención de la traza haya tenido éxito. El script de medición añade una comprobación más fuerte para esta campaña: cada exemplar final debe resolver a un span realmente archivado.

## El formato separa labels de serie y labels del exemplar

Para entender la representación sin depender de timings, el test registra valores controlados. Al final hay tres observaciones `ok` que no superan 25 ms; una no tiene contexto muestreado. El reservoir conserva el valor sampled de 25 ms.

La línea correspondiente tiene esta forma. Los IDs se representan con marcadores para explicar la estructura; los tests verifican sus valores hexadecimales reales:

```text
job_duration_seconds_bucket{result="ok",le="0.025"} 3 # {trace_id="<trace-id>",span_id="<span-id>"} 0.025
```

Antes de `#` están los labels de la serie y su valor agregado. Después está el exemplar con su valor individual. No hemos creado una serie identificada por trace ID.

En OpenMetrics, los buckets de este histograma son **acumulativos**: el recuento de `le="0.05"` incluye las observaciones de los límites anteriores. El array interno del SDK guarda recuentos por intervalo. Nuestro serializador suma progresivamente para producir la exposición.

No copies el array interno directamente como si cada posición ya fuera acumulativa. El test comprueba un bucket, el count y el terminador `# EOF`. El endpoint responde con el content type de OpenMetrics 1.0.

## Recorrer resultados reales sin ejecutar servicios desde el blog

La campaña pulsa cinco escenarios desde React. Cuatro exportan cinco spans cada uno; `unsampled` exporta cero. Las cinco operaciones sí entran en la métrica. Los casos `broken` y `link` producen dos trazas, pero solo el segundo conserva una relación explícita entre ellas.

<img src="/assets/interactive/observability-series/signals.svg" alt="Gráfica derivada de cinco clics reales: ok y fail exportan cinco spans en una traza; broken y link cinco spans en dos trazas; unsampled no exporta spans, pero los cinco jobs se incluyen en métricas." width="380" height="420" loading="lazy" style="width:100%;height:auto" />

El visor permite seleccionar cada escenario y abrir los exemplars retenidos. Al pulsar uno, encuentra el caso y destaca el span correspondiente. Las tablas siguen mostrando trace ID y parent o link, para que la relación no dependa únicamente del color.

<iframe src="/assets/interactive/observability-series/explorer.html" title="Explorar spans, logs y exemplars de cinco operaciones archivadas" width="100%" height="1150" loading="lazy" style="border:1px solid #475569;border-radius:12px"></iframe>

[Abrir el visor en una página completa](/assets/interactive/observability-series/explorer.html).

El histograma mostrado es el acumulado final de los cinco escenarios, no una métrica distinta al seleccionar cada caso. La timeline usa duraciones observadas en una misma máquina. En hosts distintos habría que considerar clock skew; el ancho de las barras tampoco representa consumo de CPU.

## Código completo y pruebas

[Archivos y pruebas del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/obs-exemplars/README.md) e [implementación del reservoir y serializador](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/observability-lab/src/metrics.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/observability-lab test
```

El README describe cómo repetir Chromium y regenerar los assets. Los tests comprueban que una observación sin sampling suma al histograma sin reemplazar el exemplar, que la política conserva la última muestra elegible y que trace ID no aparece como label de bucket.

## Garantías y límites

El visor resuelve exemplars contra datos archivados del fixture. No hemos desplegado Prometheus, Grafana, un Collector ni un backend de trazas. El serializador se verifica mediante pruebas de contrato del formato usado; **no afirmamos haber probado ingestión por un servidor Prometheus**.

El reservoir no elimina muestras por tiempo ni conoce la retención de un backend. Tampoco cubre crash recovery, distribución entre réplicas o todos los tipos de instrumentos. Los IDs pueden relacionar actividad y necesitan una política de acceso aunque no sean labels de serie.

## Ejercicio: tratar una traza que ya no existe

Elimina del archivo de consulta el span referenciado por un exemplar, sin cambiar el histograma. Haz que el visor indique «traza no disponible» y conserve el agregado. Después añade un límite temporal al reservoir y comprueba que caducar una muestra no reduce count.

El siguiente bloque retoma [SLI, SLO y error budgets](/posts/sli-slo-error-budget-servicios): elegir qué medir para tomar decisiones de fiabilidad, no solo producir telemetría.

## Referencias

- [OpenTelemetry: exemplars en el modelo de métricas](https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exemplars).
- [OpenTelemetry: filtros y reservoirs](https://opentelemetry.io/docs/specs/otel/metrics/sdk/#exemplar).
- [OpenMetrics 1.0: especificación](https://prometheus.io/docs/specs/om/open_metrics_spec/).
- [Tipo DataPoint del SDK JavaScript 3.0.0](https://github.com/open-telemetry/opentelemetry-js/blob/v3.0.0/packages/sdk-metrics/src/export/MetricData.ts).

Fuentes consultadas el 23 de octubre de 2026. La gráfica procede de evidencia local archivada, no de tráfico de lectores del blog.
