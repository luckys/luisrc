---
id: P059
title: 'Logs estructurados: qué identifica una petición y qué identifica una operación'
published: 2026-10-23T01:00:00Z
locale: es
translationKey: observability-structured-logs-identities
slug: logs-estructurados-identidades-correlacion
draft: true
status: draft
level: intermedio
prerequisites: [OPS-SIGNALS]
description: 'Distingue request ID, operation ID, trace ID y span ID. Registra eventos con campos controlados y correlación verificable sin copiar headers, bodies o secretos.'
author: 'Luis Ramírez Calle'
series: 'Observabilidad: seguir una operación sin confundir señales'
tags: [observabilidad, logs, tracing, typescript]
---

La API respondió `202 Accepted`, pero el job terminó con error. Si buscamos únicamente errores HTTP, no encontramos nada. Si el worker escribe «falló», tampoco sabemos a qué solicitud corresponde.

El primer paso no es añadir más mensajes. Es decidir **qué hecho registra cada evento y qué identidad permite encontrar el resto del recorrido**.

Esta serie amplía [la introducción a observabilidad](/posts/observabilidad-logs-metricas-trazas-workers) con un laboratorio ejecutado desde **React** hasta un worker en otro proceso. Empezamos por los logs; después añadiremos spans, propagación, sampling, métricas y exemplars. El código usa **TypeScript** y **OpenTelemetry**, pero la distinción entre identidades no depende de esas herramientas.

## Request ID y operation ID responden preguntas distintas

Un **request ID** identifica una interacción con la API. Si una persona reintenta una solicitud, hay otra interacción HTTP, aunque la intención de negocio sea la misma.

Un **operation ID** identifica esa intención: generar un informe, preparar un envío o procesar una reserva. Puede sobrevivir a varias solicitudes, a un reinicio y a una reconciliación. Para que realmente lo haga, la aplicación debe persistirlo y reutilizarlo según sus reglas. Un nombre de campo no aporta esa garantía.

En nuestro fixture, la API genera `req-001` y `op-001`. El worker recibe ambos. Los dos eventos, aceptación y finalización, se pueden buscar por la misma operación. Solo hay un intento por job: no hemos implementado idempotencia ni recuperación durable.

Un sistema con retries necesitaría además distinguir **attempt ID** y **message ID**. No conviene colocar cuatro identificadores por costumbre, pero sí separar dos cosas que puedan repetirse de manera independiente. Un mensaje redeliverado puede conservar su message ID y originar otro intento de procesamiento.

## Trace ID no es la clave primaria del negocio

Un **trace ID** agrupa un recorrido de ejecución instrumentado. Cada unidad de trabajo dentro de él tiene su **span ID**.

Un job puede empezar en una traza y continuar en otra, enlazándolas de forma explícita. Además, el sampling puede descartar sus spans. Si usamos el trace ID como única referencia de atención al cliente, una decisión de observabilidad acaba condicionando la identidad del producto.

Conservamos `operation_id` para la intención y añadimos `trace_id` y `span_id` para investigar esa ejecución. No los hacemos intercambiables. Tampoco tratamos ninguno como prueba de autorización: conocer un ID no concede acceso a la operación.

<img src="/assets/visuals/observability/P059.svg" alt="Una interacción HTTP tiene request ID, la intención asíncrona tiene operation ID y el contexto aporta trace ID y span ID; un log conserva solo campos válidos que permitan conectar estos significados." width="356" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/observability/P059.svg).

## Structured logs: campos estables, no una frase que haya que adivinar

Un **structured log** representa el evento mediante campos con significado acordado. `event: job.finished` es más sencillo de consultar que cinco variaciones de «hemos acabado el trabajo».

Nuestra función recibe un vocabulario cerrado y un contexto explícito. Archivo `src/logging.ts`:

```typescript
export function operationLog(event: 'job.accepted' | 'job.finished', operationId: string,
  requestId: string, result: 'accepted' | 'ok' | 'error', ctx: Context) {
  if (!/^op-\d{3,8}$/.test(operationId) || !/^req-\d{3,8}$/.test(requestId)) {
    throw new TypeError('fixture IDs required')
  }
  const span = trace.getSpanContext(ctx)
  const correlation = span && isSpanContextValid(span)
    ? { trace_id: span.traceId, span_id: span.spanId }
    : {}
  return { event, operation_id: operationId, request_id: requestId, result, ...correlation }
}
```

El archivo completo importa `trace`, `isSpanContextValid` y el tipo `Context` de `@opentelemetry/api`. La función devuelve un objeto; el fixture lo archiva en memoria. **No es un pipeline de logs de producción**: faltan, entre otras cosas, timestamps de emisión, niveles, transporte, retención y controles de acceso.

La validación de IDs es deliberadamente estrecha porque los genera este laboratorio. No es una recomendación de IDs secuenciales para una API pública. Si cambiamos el formato, tendremos que adaptar el contrato y sus tests.

En runtime también validamos las entradas HTTP del fixture. Los tipos de TypeScript no inspeccionan por sí solos un body recibido de la red.

## Una allowlist evita registrar la petición completa

La función no recibe un `request` que luego serializa. Selecciona los campos que necesita. Así resulta más difícil que un nuevo header o una propiedad del body termine en los logs sin revisión.

La prueba HTTP envía un `authorization` ficticio y un email de prueba. Después comprueba que no aparecen en el estado archivado. Otra prueba rechaza una cadena arbitraria donde se esperaba un ID del fixture.

Eso no demuestra ausencia de toda información sensible. Un ID opaco también puede vincular actividad de una persona; hay que controlar quién puede consultarlo y durante cuánto tiempo. Un mensaje de excepción puede contener una URL con credenciales. Por eso el ejemplo registra una causa controlada, no copia `error.message` sin revisar.

Evitar el body completo tiene un coste: quizá falte un dato para investigar. La alternativa no tiene que ser registrar todo. Podemos añadir un campo específico, documentar su finalidad y probar que no contiene información prohibida.

## Correlacionar no es afirmar que encontramos la causa

En el escenario `fail` obtenemos dos hechos:

- `job.accepted`, con resultado `accepted` en la API.
- `job.finished`, con resultado `error` en el worker.

Ambos tienen el mismo operation ID y request ID. Comparten trace ID, pero no span ID: pertenecen a unidades de trabajo diferentes. Esto permite localizar el fallo sin afirmar que el HTTP 202 fue incorrecto.

La relación temporal tampoco prueba por sí sola la causa. Un span con error ayuda a localizar una frontera; todavía necesitamos entender qué esperaba el código, qué ocurrió y qué consecuencias tuvo. El error del fixture es deliberado, no un diagnóstico de un proveedor externo.

## Código completo y pruebas

[Archivos y pruebas del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p059/README.md). El código de laboratorio está fuera del blog:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/observability-lab test
```

La [implementación de logs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/observability-lab/src/logging.ts) y los tests comprueban campos permitidos, contexto ausente, contexto no muestreado y dos solicitudes concurrentes con trazas distintas.

## Garantías y límites

El fixture conserva dos eventos por job y no registra headers o bodies completos. API y worker corren en procesos distintos, pero sus resultados se reúnen en memoria. Al cerrar el proceso se pierden.

No hay autenticación, redacción universal de secretos, búsqueda distribuida ni retención durable. La correspondencia de request y operación es uno a uno en la demo; fuera de ella, no debe suponerse.

## Ejercicio: investigar un retry sin mezclar intentos

Añade un segundo intento que conserve operation ID y reciba otro attempt ID. Escribe un test que permita encontrar los dos intentos de la misma operación sin contarlos como dos operaciones de negocio. Después decide qué campos no deberían aparecer nunca en sus eventos.

Seguimos con [el ciclo de vida de un span](/posts/opentelemetry-spans-contexto-ciclo-vida), para delimitar el trabajo que esos logs describen.

## Referencias

- [OpenTelemetry: modelo de logs](https://opentelemetry.io/docs/specs/otel/logs/data-model/).
- [OWASP: Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [OpenTelemetry: contexto y correlación](https://opentelemetry.io/docs/concepts/context-propagation/).

Fuentes consultadas el 23 de octubre de 2026. Los datos del laboratorio son ficticios.
