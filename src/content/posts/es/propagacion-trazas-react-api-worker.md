---
id: OBS-PROPAGATION
title: 'Propagar una traza desde React hasta un worker en otro proceso'
published: 2026-10-23T01:02:00Z
locale: es
translationKey: observability-react-worker-propagation
slug: propagacion-trazas-react-api-worker
draft: true
status: draft
level: intermedio
prerequisites: [OBS-SPANS, DIST-QUEUES]
description: 'Transporta contexto W3C por HTTP y metadata de mensajes. Compara parent, link y carrier perdido con cinco spans reales desde React hasta un worker Node separado.'
author: 'Luis Ramírez Calle'
series: 'Observabilidad: seguir una operación sin confundir señales'
tags: [opentelemetry, react, tracing, workers]
---

La interfaz, la API y el worker generan spans, pero el visor muestra tres recorridos independientes. Hemos instrumentado el trabajo; lo que falta es transportar la relación entre sus partes.

**Crear spans no propaga el contexto por la red.** Para conectar dos procesos hay que serializarlo en un carrier y reconstruirlo al recibirlo.

Después de [delimitar los spans](/posts/opentelemetry-spans-contexto-ciclo-vida), vamos a cruzar dos fronteras reales: una petición HTTP desde **React** y un mensaje asíncrono hacia otro proceso **Node.js**. El transporte del mensaje será IPC local, no un broker durable.

## Context, carrier y propagator: tres piezas diferentes

Un **Context** es el contenedor que usa la instrumentación para relacionar el trabajo. Puede incluir el SpanContext, con trace ID, span ID, flags y otros datos. No podemos pasar ese objeto de memoria directamente a otro proceso y esperar que siga funcionando.

Un **carrier** es el soporte serializable: headers HTTP o metadata de un mensaje. El **propagator** sabe escribir y leer una representación acordada de ese contexto.

En el laboratorio usamos **W3C Trace Context**. Un `traceparent` de versión `00` contiene trace ID, parent ID y flags. El parent ID representa el span del emisor; el receptor crea su propio span ID.

No construimos esos IDs concatenando cadenas del negocio. `inject` y `extract`, en `src/tracing.ts`, usan `W3CTraceContextPropagator`. Una entrada inválida se ignora como contexto de traza y el servicio puede empezar otra. El test incluye un header malformado y IDs de ceros, que no son válidos.

## React: inyectar el contexto de la llamada HTTP

Al pulsar el botón creamos `ui.submit`. Dentro delimitamos `POST /jobs client`, de tipo **CLIENT**. El contexto que enviamos pertenece a este último, no simplemente al primer span que encontremos.

Extracto de `web/app.tsx`, dentro del callback del span HTTP:

```typescript
          const headers = { 'content-type': 'application/json', ...inject(trace.setSpan(uiCtx, httpSpan)) }
          const response = await fetch('/jobs', { method: 'POST', headers, body: JSON.stringify({ scenario }) })
          if (response.status !== 202) throw new Error('fixture rejected request')
          const accepted = await response.json()
```

El archivo completo crea ambos spans y pasa `uiCtx` explícitamente. Así no dependemos de que un context manager del navegador conserve el span activo a través de todos los `await`.

Elegimos instrumentación manual de esta acción para enseñar dónde se establece el parent. No captura automáticamente todas las llamadas fetch, navegaciones, renders o errores de React. Tampoco mide Web Vitals.

La demo es **same-origin**: el navegador recibe la página y llama a la misma API local. Si separas los orígenes, debes revisar CORS, preflight y los headers admitidos. No envíes contexto a cualquier dominio usando una regla demasiado amplia.

<img src="/assets/visuals/observability/OBS-PROPAGATION.svg" alt="React crea los spans de interacción y cliente, la API extrae traceparent y publica metadata; otro proceso extrae ese carrier y crea el span consumidor conectado al productor, mediante HTTP e IPC locales." width="317" height="754" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/observability/OBS-PROPAGATION.svg).

## La API extrae el parent remoto y publica otro contexto

La API lee `traceparent` de la petición, lo extrae sobre `ROOT_CONTEXT` y crea `POST /jobs` como span **SERVER**. El resultado esperado es que el span cliente del navegador sea su parent remoto.

Después abre `jobs publish`, de tipo **PRODUCER**, y prepara el mensaje. Extracto de `src/server.ts`:

```typescript
    await within(telemetry.tracer, 'jobs publish', serverCtx, async (publishSpan) => {
      const metadata = inject(trace.setSpan(serverCtx, publishSpan))
      const envelope: Envelope = { ...job, metadata: job.scenario === 'broken' ? {} : metadata }
      worker.send(envelope)
      publishSpan.addEvent('job.sent')
    }, { kind: SpanKind.PRODUCER, attributes: { 'lab.operation_id': job.operationId } })
```

La variante `broken` borra el carrier a propósito. No es una recomendación de diseño: nos permite comprobar qué rompe la continuidad de la traza sin cambiar el resultado del job.

La API devuelve 202 después de enviar al canal IPC. Eso no garantiza que un broker haya persistido el mensaje. No hay broker en este fixture y tampoco una Outbox: un crash puede perder el trabajo. [La entrega asíncrona](/posts/colas-ack-leases-trabajos-duplicados) requiere otras garantías distintas de la observabilidad.

## El worker reconstruye contexto, no reutiliza un objeto del servidor

El worker tiene otro PID, otro provider y su propio context manager. Recibe un objeto serializado con metadata, operation ID y request ID. `extract(message.metadata)` reconstruye un Context con parent remoto.

Para el caso normal crea `jobs process`, de tipo **CONSUMER**, usando ese parent. El SDK genera un span nuevo con el mismo trace ID. El span productor ya puede haber terminado.

En la variante `link`, el worker usa `ROOT_CONTEXT` como parent y añade un link al contexto extraído. Obtenemos otra traza relacionada, no un descendiente en la misma traza. Esa decisión puede ser útil en trabajos de larga duración; no debe tomarse solo para que un diagrama resulte más cómodo.

No propagamos baggage. Tampoco copiamos la petición completa en metadata: el mensaje lleva los campos que necesita este fixture.

## Qué comprobamos desde un navegador real

El script `scripts/measure.mjs` pulsa cinco botones en Chromium. Inspecciona el header emitido, espera a que el worker termine y valida el árbol de spans. No sustituye el navegador por una llamada HTTP hecha desde el propio test.

En el caso `ok`, el orden causal es:

1. `ui.submit`, en `jobs-web`.
2. `POST /jobs client`, descendiente del primero.
3. `POST /jobs`, en `jobs-api`, con parent remoto cliente.
4. `jobs publish`, descendiente del servidor.
5. `jobs process`, en `jobs-worker`, con parent remoto productor.

Los cinco comparten trace ID. Al perder el carrier aparecen dos trazas sin enlace. Con `link`, aparecen dos trazas pero el consumidor conserva una referencia al productor. El resultado `ok` del negocio no basta para distinguir esos tres casos.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/obs-propagation/README.md) y [script de navegador](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/observability-lab/scripts/measure.mjs):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/observability-lab test
pnpm --filter @luisrc-examples/observability-lab build:ui
pnpm --filter @luisrc-examples/observability-lab start
```

`start` imprime una URL loopback con puerto libre. Abre esa URL para probar React. `pnpm --filter @luisrc-examples/observability-lab measure` repite la campaña y sobrescribe la evidencia local archivada. Requiere el Chromium de Playwright instalado; el README explica ese paso opcional.

## Garantías y límites

Verificamos HTTP real, procesos separados, parent remoto, links y pérdida deliberada del carrier. Dos solicitudes concurrentes mantienen trazas diferentes. No verificamos TLS, broker, retries, crash recovery ni propagación cross-origin.

Los spans del navegador se envían a un receptor JSON del fixture; **no es OTLP**. No hay Collector ni backend. Los headers de tracing son entrada no confiable: el ejemplo acepta contexto del cliente para enseñar continuidad, no como política recomendada para cualquier frontera pública. En producción hay que decidir dónde reiniciar contexto, qué atributos admitir y quién puede imponer decisiones de sampling.

## Ejercicio: transportar un mensaje por otra frontera

Sustituye IPC por un transporte local que conozcas. Conserva un test que compruebe el parent remoto del consumidor y otro que pierda metadata deliberadamente. Si incorporas persistencia, separa la evidencia de entrega de la evidencia de tracing: una no demuestra la otra.

Seguimos con [sampling y trazas ausentes](/posts/sampling-trazas-parent-based-head-tail).

## Referencias

- [W3C Trace Context](https://www.w3.org/TR/trace-context/).
- [OpenTelemetry: propagación en JavaScript](https://opentelemetry.io/docs/languages/js/propagation/).
- [OpenTelemetry: seguridad de la propagación](https://opentelemetry.io/docs/concepts/context-propagation/#security-best-practices).
- [OpenTelemetry: convenciones para messaging spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/).

Fuentes consultadas el 23 de octubre de 2026. El fixture instrumenta una interacción concreta, no una aplicación React completa.
