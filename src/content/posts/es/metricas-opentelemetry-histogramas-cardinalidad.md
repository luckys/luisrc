---
id: OBS-METRICS
title: 'Métricas con OpenTelemetry: histogramas agregables y labels con límites'
published: 2026-10-23T01:04:00Z
locale: es
translationKey: observability-metrics-histogram-cardinality
slug: metricas-opentelemetry-histogramas-cardinalidad
draft: true
status: draft
level: intermedio
prerequisites: [OBS-SAMPLING, P058]
description: 'Registra duraciones con el SDK de OpenTelemetry y agrega buckets compatibles. Separa identidad y dimensiones, count y rate, y acumulación desde el arranque y ventanas de consulta.'
author: 'Luis Ramírez Calle'
series: 'Observabilidad: seguir una operación sin confundir señales'
tags: [opentelemetry, metricas, histogramas, cardinalidad]
---

Tenemos trazas detalladas de algunos jobs, pero necesitamos saber cuántos terminaron con error y cómo se distribuyeron sus duraciones. Abrir cada traza no es una forma práctica de responder esas preguntas.

Las **métricas** agregan observaciones. Precisamente por eso tenemos que decidir qué detalle conservan y qué identidades quedan fuera.

Después de [comprobar qué descarta el sampling](/posts/sampling-trazas-parent-based-head-tail), registraremos todos los jobs procesados por el fixture. No inferiremos su distribución contando solo las trazas seleccionadas.

## Counter, gauge e histogram no describen la misma magnitud

Un **counter** acumula incrementos: por ejemplo, jobs terminados desde el arranque. No es automáticamente «jobs por segundo». Para obtener una tasa necesitamos diferencias y tiempo, tratando también reinicios y huecos de observación.

Un **gauge** describe un valor observado, como el tamaño actual del backlog. Si aumenta de diez a veinte, no debemos sumar ambos valores y decir que hubo treinta pendientes.

Un **histogram** agrega observaciones de una distribución. Para duraciones permite conservar recuentos por intervalo, número total y suma. Elegimos este instrumento porque queremos contar observaciones y distinguir zonas de duración sin exportar cada muestra individual.

El laboratorio implementa el histograma. Counter y gauge se explican como alternativas; no afirmamos haber monitorizado un backlog real ni una tasa sostenida con cinco clics.

## La frontera de medida pertenece al contrato

Medimos desde el inicio del trabajo simulado del worker hasta su resultado. La unidad es **segundos**, no milisegundos. El valor incluye una espera artificial de unos 20 ms y el overhead ocurrido dentro de esa frontera.

No incluye la cola anterior al procesamiento, el fetch del navegador ni el tiempo hasta que una persona ve un resultado. Esas mediciones pueden ser útiles, pero necesitarían otro instrumento o una definición diferenciada.

Registramos tanto `ok` como `error`. Un fallo rápido no desaparece del total ni se convierte en éxito porque duró poco. Cuando consultemos una latencia habrá que decidir si queremos toda la distribución o la de un resultado concreto.

<img src="/assets/visuals/observability/OBS-METRICS.svg" alt="Cinco jobs generan duraciones en segundos; el atributo acotado result separa ok y error, OpenTelemetry agrega buckets, count y sum, y el resultado final contiene cuatro éxitos y un error sin labels de identidad." width="327" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/observability/OBS-METRICS.svg).

## Configurar buckets con significado para la pregunta

Usamos límites ilustrativos de `0.01`, `0.025`, `0.05` y `0.1` segundos, además del intervalo final sin límite superior. No son un SLO recomendado.

Con buckets explícitos, una observación cae en un único intervalo del agregado interno. En nuestro contrato, una duración igual al límite superior entra en ese bucket. Si solo sabemos que un valor está entre 25 y 50 ms, no podemos reconstruir si era 26 o 49 ms.

El `MeterProvider` configura una view para `job.duration`. Extracto de `src/metrics.ts`:

```typescript
    views: [{
      instrumentName: 'job.duration',
      attributesProcessors: [createAllowListAttributesProcessor(['result'])],
      aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries } },
    }]
```

Después crea el instrumento:

```typescript
  const histogram = provider.getMeter('observability-lab').createHistogram('job.duration', { unit: 's' })
```

El archivo completo importa estos símbolos desde los paquetes de OpenTelemetry, crea un reader de snapshots y registra el recurso `service.name`. El SDK agrega las observaciones; no calculamos buckets inventados para hacer coincidir una gráfica.

## Cardinalidad: el problema no es solo cuántas claves hay

La **cardinalidad** depende de las combinaciones distintas de valores. Un atributo `result` con `ok` y `error` genera dos grupos en nuestro fixture. Añadir `operation_id` podría crear un grupo nuevo por job.

Una URL con IDs o query strings tiene un riesgo parecido. Para HTTP suele ser más útil una ruta estable, como `/jobs`, que la URL concreta de cada operación. Email, tokens e identidades de clientes tampoco deberían convertirse accidentalmente en labels.

El helper admite un resultado cerrado y rechaza valores arbitrarios. Además, la view conserva solo `result`. Son defensas diferentes: una limita los valores que emitimos y otra las claves que llegan a ese agregado.

La prueba registra cien observaciones `ok` y una `error`; comprueba dos puntos agregados y un único atributo por punto. Eso no es un benchmark de millones de series, sino una verificación del contrato elegido.

Los SDKs y backends pueden tener límites adicionales de cardinalidad. No conviene depender de que esos límites arreglen un modelo de datos equivocado: el overflow o descarte también afecta a la interpretación.

## Count y sum permiten contrastar el resultado

En la campaña de navegador terminan cinco jobs: **cuatro `ok` y uno `error`**. El escenario sin sampling también entra en el histograma. Las dos series tienen count cuatro y uno, respectivamente.

En la prueba determinista usamos cincuenta valores de 20 ms y cincuenta de 60 ms. El resultado esperado para `ok` es count 100 y sum aproximadamente cuatro segundos. La tolerancia de comparación cubre la representación de números en coma flotante, no una incertidumbre de medición.

Archivo `tests/metrics.test.mjs`:

```javascript
    assert.deepEqual(ok.value.buckets.counts, [0, 50, 0, 50, 0])
    assert.equal(ok.value.count, 100)
    assert.deepEqual(Object.keys(ok.attributes), ['result'])
```

`sum / count` daría una media de 40 ms en esa muestra. No permite reconstruir su p99. Para interpretar percentiles y agregación, conviene tener presente [la distribución que sí hemos conservado](/posts/latencia-percentiles-histogramas-errores).

## Agregar requiere compatibilidad y una ventana definida

Dos instancias pueden combinar sus buckets si representan el mismo instrumento, unidad, límites, dimensiones y periodo compatible. No se consigue lo mismo promediando el p95 de cada una.

Nuestro reader conserva valores **acumulados desde la primera observación del proceso**. Pedir otro snapshot no reinicia el histograma. Para una ventana de cinco minutos necesitaríamos diferenciar acumulaciones compatibles o consultar un backend que trate ese modelo correctamente.

También importa la identidad del emisor: sumar dos lecturas acumuladas de la misma instancia duplicaría observaciones. Sumar count entre procesos distintos y agruparlo en el tiempo exige tratar sus timestamps y reinicios.

No implementamos aquí una base de series temporales ni consultas PromQL. Enseñamos la estructura que esas herramientas recibirían y las condiciones que no deberían perderse al agregar.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/obs-metrics/README.md) e [implementación del instrumento](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/observability-lab/src/metrics.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/observability-lab test
```

El endpoint local `/metrics` expone una representación OpenMetrics construida desde el snapshot del SDK. En el siguiente post veremos por qué sus buckets acumulativos no tienen la misma representación que el array de recuentos internos.

## Garantías y límites

Probamos unidades, límites, validación, count, sum y separación por resultado. La campaña registra cinco trabajos locales, no tráfico representativo ni una medición de capacidad.

Un crash antes de `record` puede dejar trabajo sin observación. No hay exportación durable, scraping periódico o alertas ejecutadas. Los datos del visor están archivados; no son métricas en vivo del blog.

## Ejercicio: medir también la espera del job

Añade un timestamp de publicación y otro de comienzo de procesamiento. Define un histograma para espera, separado del de ejecución. Explica qué cambia si API y worker dejan de compartir reloj y escribe un test con tiempos controlados antes de utilizar timestamps de máquinas diferentes.

Seguimos con [exemplars y el salto de una métrica a una traza](/posts/exemplars-openmetrics-histograma-traza).

## Referencias

- [OpenTelemetry: modelo de datos de métricas](https://opentelemetry.io/docs/specs/otel/metrics/data-model/).
- [OpenTelemetry: views y agregación](https://opentelemetry.io/docs/specs/otel/metrics/sdk/).
- [Prometheus: histogramas y summaries](https://prometheus.io/docs/practices/histograms/).
- [SDK de métricas JavaScript 3.0.0](https://github.com/open-telemetry/opentelemetry-js/tree/v3.0.0/packages/sdk-metrics).

Fuentes consultadas el 23 de octubre de 2026. Los límites de buckets son una elección didáctica del fixture.
