---
id: OBS-SAMPLING
title: 'Sampling de trazas: qué desaparece cuando no guardas todos los spans'
published: 2026-10-23T01:03:00Z
locale: es
translationKey: observability-trace-sampling
slug: sampling-trazas-parent-based-head-tail
draft: true
status: draft
level: intermedio
prerequisites: [OBS-PROPAGATION]
description: 'Distingue head sampling, ParentBased y tail sampling. Comprueba por qué un contexto no muestreado conserva IDs, pero sus logs pueden no tener una traza almacenada.'
author: 'Luis Ramírez Calle'
series: 'Observabilidad: seguir una operación sin confundir señales'
tags: [opentelemetry, sampling, tracing, observabilidad]
---

El log contiene un trace ID válido, pero no encontramos la traza. Eso puede ser un fallo del exporter o de la retención. También puede ser el resultado esperado del sampling.

**Tener contexto no implica haber almacenado spans.** Si no distinguimos ambas cosas, podemos pasar horas buscando un dato que decidimos no exportar.

En [el recorrido React → API → worker](/posts/propagacion-trazas-react-api-worker) hemos transportado contexto real. Ahora repetiremos ese trabajo con una decisión inicial de no muestrear, manteniendo los logs y las métricas del job.

## Head sampling decide antes de conocer el resultado

El **sampling** selecciona qué telemetría conservamos. No existe una política que sea gratuita y responda todas las preguntas: hay costes de instrumentación, exportación, procesamiento y almacenamiento.

El **head sampling** decide al empezar un recorrido. Puede hacerlo por proporción de trace IDs o según atributos disponibles en ese momento. Su ventaja es que puede evitar parte del trabajo posterior. Su límite es que aún no conoce cómo terminará la operación.

Un sampler que elija el 10 % de las trazas no garantiza capturar el 10 % de cada tipo de error, especialmente si es infrecuente. Tampoco significa que cada grupo consecutivo de diez peticiones vaya a contener exactamente una elegida.

No medimos aquí ahorro de CPU ni coste de backend. El fixture usa dos extremos, conservar o descartar el recorrido, para que la diferencia pueda verificarse sin depender de una muestra aleatoria pequeña.

## ParentBased conserva la decisión a lo largo del recorrido

Si cada servicio decide de manera independiente, puede almacenar piezas que luego no tienen su parent disponible. **ParentBased** utiliza la decisión del parent para sus descendientes, con políticas configurables según el tipo de parent.

En `src/tracing.ts`:

```typescript
    sampler: new ParentBasedSampler({ root: sampled ? new AlwaysOnSampler() : new AlwaysOffSampler() }),
```

`root` es la política para un span sin parent. No significa que cualquier span creado por ese provider vaya a ignorar una decisión remota. Los tests comprueban precisamente lo contrario: un parent remoto con flag `00` no produce spans exportados con esta configuración.

Para el escenario `unsampled`, React crea su recorrido con `sampled = false`. Se inyecta `traceparent` con la flag sampled desactivada. API y worker extraen ese contexto y respetan la decisión mediante ParentBased.

Que esto sea apropiado en el fixture no significa que debamos obedecer sin límites el header de un cliente público. Un atacante puede generar contexto con la flag activada. La política de la frontera debe decidir cuánto confiar, con qué límites y si iniciar una traza interna distinta.

<img src="/assets/visuals/observability/OBS-SAMPLING.svg" alt="Una decisión inicial desactiva la flag sampled, los servicios ParentBased no exportan spans pero mantienen contexto con IDs, y logs y métricas siguen registrando el trabajo sin garantizar una traza consultable." width="340" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/observability/OBS-SAMPLING.svg).

## El contexto no muestreado sigue teniendo identidad

El test crea un parent remoto no muestreado y abre un span hijo. Este no está recording, pero mantiene un SpanContext válido. Extracto de `tests/core.test.mjs`:

```javascript
    const parent = extract({ traceparent: '00-11111111111111111111111111111111-2222222222222222-00' })
    await within(runtime.tracer, 'not-exported', parent, async (span) => {
      assert.equal(span.isRecording(), false)
      assert.equal(span.spanContext().traceFlags, TraceFlags.NONE)
      const log = operationLog('job.finished', 'op-001', 'req-001', 'ok', trace.setSpan(parent, span))
      assert.equal(log.trace_id, '11111111111111111111111111111111')
    })
```

La comprobación posterior confirma que el exporter recibió un array vacío. Por eso un log con esos IDs no demuestra que el backend tenga una traza que abrir.

En la campaña real del navegador, `unsampled` termina correctamente, registra dos eventos y añade una observación al histograma. Exporta **cero spans**. El test valida también el `-00` del header emitido por Chromium.

## Tail sampling ve más información, pero no resucita datos descartados

El **tail sampling** decide después de recibir información de los spans. Puede conservar, por ejemplo, recorridos lentos o con errores. Esa decisión posterior necesita recibir los datos candidatos y mantener estado mientras espera.

Si un SDK descartó spans al principio y no los envió, un Collector no puede reconstruirlos por conocer el resultado final. Una política tail necesita una estrategia compatible aguas arriba.

También tiene decisiones difíciles: cuánto esperar por una traza asíncrona, cómo enrutar sus spans al mismo evaluador, qué hacer si llegan tarde y cuánta memoria dedicar a trazas aún incompletas. Un job de horas puede no encajar en la misma política que una petición breve.

**Este laboratorio no implementa tail sampling.** La comparación es conceptual; solo hemos ejecutado la política ParentBased con raíces elegidas y no elegidas. No hay Collector, almacenamiento intermedio ni evaluación de trazas completas.

## No calcules el error rate global contando trazas elegidas por errores

Si una política conserva preferentemente errores, el conjunto almacenado deja de representar la proporción de tráfico de entrada. Dividir trazas fallidas por trazas guardadas puede producir un error rate sesgado.

Las métricas del fixture se registran por cada job procesado, con independencia del sampling de trazas. Esa separación nos permite contar cinco jobs aunque solo existan veinte spans, procedentes de los otros cuatro recorridos.

Eso tampoco convierte las métricas en infalibles. Un crash antes de registrarlas, pérdida de exportación o un denominador mal definido puede afectar a su interpretación. Lo útil es conocer la política de cada señal, no declarar una de ellas «la verdad» sin condiciones.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/obs-sampling/README.md) y [tests del contexto no muestreado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/observability-lab/tests/core.test.mjs):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/observability-lab test
```

El README explica cómo repetir la campaña de Chromium. La evidencia archivada conserva el recuento por escenario, los logs y los histogramas, no una estimación comercial del ahorro obtenido.

## Garantías y límites

El resultado sin spans está probado para la configuración y versiones fijadas del fixture. No demuestra que cualquier exporter o servicio vaya a respetar esa política. Tampoco distingue automáticamente entre sampling, pérdida de datos y retención vencida en un sistema real: para eso necesitamos observar el pipeline de telemetría.

## Ejercicio: no perder la operación cuando falta la traza

Añade una vista que busque por operation ID y muestre los logs aunque no existan spans archivados. Debe indicar «traza no disponible», sin inventar un árbol. Escribe una prueba con el escenario `unsampled`.

Seguimos con [métricas e histogramas agregables](/posts/metricas-opentelemetry-histogramas-cardinalidad).

## Referencias

- [OpenTelemetry: sampling](https://opentelemetry.io/docs/concepts/sampling/).
- [OpenTelemetry: sampling en JavaScript](https://opentelemetry.io/docs/languages/js/sampling/).
- [OpenTelemetry: sampler ParentBased](https://opentelemetry.io/docs/specs/otel/trace/sdk/#parentbased).
- [Collector: tail sampling processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor).

Fuentes consultadas el 23 de octubre de 2026. Las políticas tail se explican como alternativa, no como funcionalidad ejecutada.
