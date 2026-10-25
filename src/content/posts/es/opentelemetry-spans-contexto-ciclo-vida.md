---
id: OBS-SPANS
title: 'Spans con OpenTelemetry: delimitar trabajo sin convertir cada función en una traza'
published: 2026-10-23T01:01:00Z
locale: es
translationKey: observability-span-lifecycle
slug: opentelemetry-spans-contexto-ciclo-vida
draft: true
status: draft
level: intermedio
prerequisites: [P059]
description: 'Crea spans con parent Context, atributos, eventos y status. Explica qué mide su duración, cómo cerrarlos ante errores y qué hacen el provider, processor y exporter.'
author: 'Luis Ramírez Calle'
series: 'Observabilidad: seguir una operación sin confundir señales'
tags: [opentelemetry, tracing, spans, typescript]
---

Un log dice que el worker empezó y otro que terminó. Podemos restar sus tiempos, pero seguimos sin ver qué parte del recorrido pertenece a la API, al envío del mensaje o al procesamiento del job.

Un **span** delimita una unidad de trabajo y la relaciona con otras. La decisión importante es dónde ponemos sus fronteras, no cuántos spans conseguimos generar.

Después de [separar las identidades de los logs](/posts/logs-estructurados-identidades-correlacion), usaremos esos límites para explicar un recorrido asíncrono. No instrumentaremos cada función auxiliar: necesitamos distinguir responsabilidades observables, no reproducir todo el call stack.

## Un span tiene principio y final, no necesariamente un hilo ocupado

Un span contiene identidad, nombre, tiempos, contexto y metadatos. Puede abarcar una petición HTTP, una consulta o el procesamiento de un mensaje.

Su duración incluye lo que ocurra entre inicio y fin: ejecución, esperas y pausas del proceso. Un span de 100 ms no demuestra que hayamos consumido 100 ms de CPU. Para esa pregunta necesitamos [CPU profiling](/posts/cpu-profiling-nodejs-muestras-cuello-botella).

Tampoco podemos sumar todas las duraciones y llamarlo latencia total. Dos spans pueden ejecutarse en paralelo o estar anidados. En nuestro fixture, el HTTP termina después de aceptar el job, mientras el worker continúa. La duración del span servidor no representa la finalización del trabajo asíncrono.

## Trace y parent forman un árbol; los links añaden otras relaciones

Los spans de una misma **trace** comparten trace ID. Cada span tiene su propio span ID y puede indicar un parent. Así distinguimos, por ejemplo, una llamada saliente del span servidor que la recibió.

Un parent no tiene que seguir abierto mientras se ejecuta su descendiente. Un productor puede terminar después de publicar un mensaje; el consumidor lo procesa más tarde. La relación expresa causalidad, no que ambos estén simultáneamente en el call stack.

Un **link** permite relacionar otro contexto sin convertirlo en parent. Resulta útil al abrir otra traza o al representar trabajo que depende de varios mensajes. Nuestro escenario `link` inicia una traza nueva para el worker y enlaza el productor. No implementa batches ni deduplica mensajes.

<img src="/assets/visuals/observability/OBS-SPANS.svg" alt="Un TracerProvider identifica el servicio, crea un span con parent Context, registra trabajo y eventos, lo cierra en finally y entrega el resultado a processor y exporter sin confundirlos con almacenamiento." width="335" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/observability/OBS-SPANS.svg).

## API, SDK, processor y exporter no hacen el mismo trabajo

La **API de OpenTelemetry** ofrece operaciones para instrumentar el código. El **SDK** decide cómo generar y procesar la telemetría. Usar la API sin una implementación configurada puede no producir datos exportados.

El **TracerProvider** crea tracers y configura recursos, sampling y processors. El recurso `service.name` identifica quién emite la señal. No es el nombre de una operación individual.

Un **processor** recibe los spans durante su ciclo de vida. Un **exporter** los entrega a algún destino. Ese destino puede ser memoria, un archivo o un receptor remoto. Ninguno de esos nombres significa, por sí solo, que ya exista un sistema de consulta.

En el laboratorio usamos `@opentelemetry/api` 1.10.0 y los paquetes de SDK 3.0.0, fijados en el lockfile. Esta versión usa `TracerProvider` de `@opentelemetry/sdk-trace`; no mezcles estos imports con un tutorial de otra generación del SDK.

Extracto de `src/tracing.ts`:

```typescript
  const provider = new TracerProvider({
    resource: resourceFromAttributes({ 'service.name': service }),
    sampler: new ParentBasedSampler({ root: sampled ? new AlwaysOnSampler() : new AlwaysOffSampler() }),
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  })
```

El exporter del archivo completo serializa una selección de campos en un array. Elegimos **SimpleSpanProcessor** para inspeccionar inmediatamente una demo pequeña. Una aplicación con tráfico debe valorar batching, límites de cola, flush y comportamiento al apagar. No hemos medido el coste de ninguna de esas opciones.

## Cerrar el span también cuando falla el trabajo

El helper `within` recibe un tracer, un parent Context, una función asíncrona y opciones. Su parte central es:

```typescript
  const span = tracer.startSpan(name, options, parent)
  try {
    return await context.with(trace.setSpan(parent, span), () => work(span))
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR })
    // La causa pertenece al vocabulario del fixture, no a mensajes de error arbitrarios.
    span.addEvent('job.failure', { 'error.type': 'controlled_failure' })
    throw error
  } finally {
    span.end()
  }
```

`finally` cierra el span tanto si obtenemos un valor como si la promesa falla. El helper vuelve a lanzar el error para no cambiar silenciosamente el contrato del programa. Instrumentar no debería convertir un fallo de negocio en un éxito.

El código mantiene una causa controlada. No vuelca una excepción completa que podría incluir información sensible. En otro sistema puede ser apropiado registrar una excepción revisada, pero eso requiere su propia política de datos.

`context.with` activa un contexto durante el callback mediante el context manager configurado. En Node instalamos **AsyncLocalStorageContextManager**. Además, pasamos los contextos explícitamente en las fronteras importantes. En el navegador no dependemos de conservar contexto automáticamente a través de cada `await`.

## Un evento no necesita otro span

Usamos `job.accepted` como evento dentro del span servidor y `job.sent` dentro del productor. Son hitos, no trabajos con una duración propia que necesitemos medir.

Los **attributes** describen la operación, como la ruta `/jobs`. Los **events** describen hechos ocurridos durante ella. El **status** resume su resultado desde la perspectiva de ese span.

En `fail`, el servidor devuelve 202 y su status queda `UNSET`, que no significa «pendiente de finalizar el span». Es el valor de status que no hemos cambiado. El worker sí termina con `ERROR`, porque su trabajo falla. Marcar toda la traza como una única respuesta HTTP escondería esa diferencia.

## Código completo y pruebas

[Archivos y pruebas del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/obs-spans/README.md) y [helper completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/observability-lab/src/tracing.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/observability-lab test
pnpm --filter @luisrc-examples/observability-lab typecheck
```

El test de ciclo de vida crea parent y child, provoca un error y comprueba que ambos se exportan, mantienen el mismo trace ID y quedan relacionados por span ID. Los tests HTTP verifican además la separación entre el 202 y el resultado del worker.

## Garantías y límites

Generamos spans reales con el SDK y los inspeccionamos mediante un exporter propio. No hay Collector, OTLP, almacenamiento remoto o interfaz Jaeger. `forceFlush()` solicita procesar telemetría pendiente; no demuestra retención durable en un backend.

El fixture usa nombres estables para los spans. No crea un nombre distinto por ID ni pretende que una traza sustituya a un profiler o a todas las métricas.

## Ejercicio: encontrar un límite que falte

Añade una operación interna al worker con dos pasos que puedan fallar por separado. Decide si necesitas dos spans, dos eventos o un único atributo. Justifica qué pregunta nueva podrías responder con esa elección y escribe un test que compruebe el cierre cuando falla el segundo paso.

El siguiente artículo explica [cómo transportar el contexto entre React, HTTP y el worker](/posts/propagacion-trazas-react-api-worker).

## Referencias

- [OpenTelemetry: conceptos de traces](https://opentelemetry.io/docs/concepts/signals/traces/).
- [SDK de tracing JavaScript 3.0.0](https://github.com/open-telemetry/opentelemetry-js/blob/v3.0.0/packages/sdk-trace/README.md).
- [OpenTelemetry: API de traces](https://opentelemetry.io/docs/specs/otel/trace/api/).

Fuentes consultadas el 23 de octubre de 2026. El ejemplo fija versiones; no presupone compatibilidad entre versiones mayores.
