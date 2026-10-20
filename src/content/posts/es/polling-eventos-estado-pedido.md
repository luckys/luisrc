---
id: P031
title: 'Polling o eventos: seguir un pedido sin perder cambios'
published: 2026-10-20T08:00:00Z
locale: es
translationKey: polling-eventos-estado-pedido
slug: polling-eventos-estado-pedido
draft: true
status: draft
level: intermedio
prerequisites: [P020, P021]
description: 'Resuelve el mismo seguimiento de pedidos con polling condicional y SSE. Prueba ETags, replay, cursores vencidos y reconciliación sin confundir una demo local con un benchmark.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, http, polling, eventos, sse, testing]
---

Un pedido aparece como pendiente aunque ya está pagado. El backend guardó el cambio; la pantalla todavía no lo ha consultado. Antes de añadir un broker o cambiar de protocolo, necesitamos decidir cuánto retraso acepta esa pantalla y qué debe pasar si pierde la conexión.

Podemos resolverlo preguntando periódicamente por el estado, o abriendo una conexión para recibir cambios. Vamos a implementar ambas opciones sobre el mismo pedido, comprobar dónde pueden perder información y separar sus costes de las promesas que no podemos demostrar en un portátil.

Este artículo continúa los de [contratos](/posts/api-contrato-esquema-clientes) y [métodos HTTP](/posts/recursos-http-metodos-idempotencia). No necesita una cuenta cloud ni un proyecto de pagos.

## Estado actual y secuencia de cambios no responden a la misma pregunta

Una lectura de `GET /orders/o1` devuelve una representación:

```json
{ "id": "o1", "status": "pending", "version": 1 }
```

Es un **snapshot**, una vista del estado en el momento de la lectura. No es la lista de todo lo que le ha ocurrido al pedido. Si entre dos consultas pasó de pending a paid y luego a shipped, una nueva lectura puede devolver shipped sin mostrar paid.

Para pintar una etiqueta, quizá sea suficiente. Para ejecutar una acción por cada transición, no. Ese segundo requisito necesita un historial y reglas de entrega; consultar más deprisa no sustituye esas garantías.

En nuestro laboratorio, cada cambio incrementa una **versión por pedido**. North y South pueden tener ambos un o1: la clave interna también incluye el tenant. La versión describe esta fila, no una posición global de todos los pedidos.

## Polling condicional: preguntar sin transferir siempre el mismo JSON

El **polling** repite la lectura a intervalos. Podemos conservar el último **ETag** y enviarlo en `If-None-Match`. Si la representación no cambió, el servidor responde **304 Not Modified**, sin cuerpo. Esa respuesta permite reutilizar la copia local; no significa «el pedido no existe». La semántica está definida en [HTTP, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-304-not-modified).

En `http.mjs`, el servidor autentica primero, obtiene el snapshot autorizado y calcula su etiqueta:

```javascript
const etag = `"${tenant}:${snapshot.id}:${snapshot.version}"`
res.setHeader('etag', etag)
res.setHeader('cache-control', 'private, no-cache')
if (req.headers['if-none-match'] === etag) {
  res.writeHead(304)
  return res.end()
}
res.writeHead(200, { 'content-type': 'application/json' })
return res.end(JSON.stringify(snapshot))
```

`private` evita autorizar cachés compartidas; `no-cache` exige revalidación antes de reutilizar la respuesta. No significa «no almacenar». La etiqueta incorpora tenant, pedido y versión porque no queremos tratar representaciones de ámbitos distintos como si fueran la misma.

El ETag solo funciona si cambia cuando cambia la representación. En esta demo, todos sus campos dependen de esa versión. Añadir mañana un campo calculado que varíe sin incrementarla rompería esa premisa. Tampoco hemos implementado un parser HTTP completo de listas de ETags o validadores débiles: el cliente de prueba devuelve exactamente la etiqueta recibida.

El cliente distingue 200 y 304. Si llega un 304, conserva tanto el JSON anterior como su versión. Además fija un timeout y rechaza redirects. En una aplicación real, el bucle debería esperar a que termine una lectura antes de programar la siguiente, aplicar backoff y jitter tras fallos, y dejar de consultar cuando la pantalla ya no lo necesita. Un `setInterval` que acumula requests lentos crea otro problema.

## El intervalo intercambia frescura por lecturas

Con N pantallas activas y un intervalo Δ, la tasa aproximada de peticiones es **N / Δ**, si todas mantienen ese ritmo y no hay reintentos. Es una estimación de carga, no una medición de capacidad.

Un cambio ocurrido justo después de una lectura puede esperar casi Δ antes de la siguiente, además del tiempo de red y procesamiento. Con cambios distribuidos uniformemente entre lecturas, sin fallos y con un intervalo fijo, la espera media atribuible al calendario sería Δ/2. Si esas condiciones no se cumplen, esa media no describe el sistema.

Un 304 ahorra el cuerpo de la respuesta. **No elimina la petición**, la autenticación, el enrutamiento ni el trabajo necesario para comprobar si hubo cambios. Según cómo construyas la etiqueta, incluso puede exigir una consulta a la base de datos.

[Prueba la línea de tiempo interactiva](/assets/interactive/api-integration/explorer.html). Cambia el intervalo y observa qué versiones ve cada lectura. Es una simulación de doce segundos, sin sockets ni medición de latencia. Con un intervalo de seis segundos, la lectura de t=6 ya ve la versión 3 y no llega a mostrar la 2.

## Recibir eventos evita preguntar por cada cambio, no evita las desconexiones

La alternativa usa **Server-Sent Events (SSE)**. Tras obtener el snapshot v1, el cliente abre `GET /orders/o1/events?after=1`. El servidor mantiene la respuesta abierta y envía un frame por cambio:

```text
id: 2
event: order
data: {"schemaVersion":1,"orderId":"o1","version":2,"status":"paid"}

```

El salto de línea vacío termina el frame. Aquí el `id` coincide con la versión del pedido. `schemaVersion` tiene otra responsabilidad: identificar la forma del mensaje. Cambiar el pedido a v2 no convierte su contrato de eventos en schema v2.

<img src="/assets/visuals/api-contracts/P031.svg" alt="La pantalla obtiene snapshot versión 1. Si el pedido cambia antes de suscribirse, el historial reproduce la versión 2. La conexión activa recibe versión 3. Un cursor fuera de retención exige una nueva lectura." width="247" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P031.svg).

Hay una carrera fácil de pasar por alto: el cambio puede ocurrir **después del snapshot y antes de abrir el stream**. Nuestro servidor conserva un historial acotado por pedido y reproduce las versiones posteriores al cursor antes de entregar cambios nuevos. El test fuerza exactamente ese hueco.

La lectura del historial y el registro del listener ocurren sin `await`, en el mismo turno síncrono de un proceso Node. Eso evita una intercalación en esta implementación. No demuestra atomicidad entre una base de datos y un broker. Con varios procesos necesitaríamos un mecanismo común que no perdiera el evento al confirmar el estado, como el [transactional outbox](/posts/transactional-outbox-inbox-eventos).

## Un cursor no es una promesa de retención infinita

El historial guarda veinte cambios por pedido. Si el cliente pide una versión demasiado antigua, recibe **410** antes de abrir SSE. Esa elección significa «necesitas un snapshot nuevo»; no «el pedido se ha borrado». Es parte de nuestro contrato, no una regla universal de SSE.

El consumidor también comprueba los mensajes antes de aplicarlos. Este es el cuerpo completo de la función `applyEvent` de `orders.mjs`:

```javascript
export function applyEvent(current, event) {
  if (
    event?.schemaVersion !== 1 ||
    event.orderId !== current.id ||
    !Number.isSafeInteger(event.version) ||
    event.version < 1 ||
    !statuses.has(event.status)
  )
    throw new Error('invalid_event')
  if (event.version <= current.version) return current
  if (event.version !== current.version + 1) throw new Error('resnapshot_required')
  return { id: current.id, status: event.status, version: event.version }
}
```

`statuses` es el conjunto cerrado de cuatro estados del archivo. Un duplicado o una versión antigua no modifica la proyección; un hueco obliga a reconciliar con un snapshot. Aunque estos eventos incluyen el estado completo y podríamos diseñar otra política, elegimos detectar el hueco para no ocultarlo.

Esto no proporciona **exactly once**. Solo evita aplicar dos veces la misma versión a esta proyección. No autoriza ejecutar cobros, emails o cualquier efecto externo una sola vez. Esos consumidores necesitan su propia idempotencia y persistencia.

Si se cierra la conexión, el cliente de la demo termina con un error explícito. No hemos construido un bucle automático de reconexión. El test sí demuestra la recuperación obteniendo otro snapshot y abriendo el stream desde esa versión. El artículo de [SSE, reconexión y eventos perdidos](/posts/sse-websockets-reconexion-eventos-perdidos) desarrolla el cliente de interfaz con más detalle.

## Qué muestra la ejecución y qué no permite concluir

La demo hace una lectura inicial, otra sin cambios y dos después de cambiar el estado. El consumidor de eventos hace su propia lectura inicial y mantiene una conexión SSE. Ambos terminan en shipped, versión 3.

<div role="region" aria-label="Recuentos del experimento de seguimiento de pedido" tabindex="0" style="overflow-x:auto">

| Consumidor          |            Peticiones HTTP | Actualizaciones posteriores al snapshot | Estado final |
| ------------------- | -------------------------: | --------------------------------------: | ------------ |
| Polling condicional |      4: 200, 304, 200, 200 |                        2 cuerpos nuevos | shipped, v3  |
| Snapshot más SSE    | 2: un snapshot y un stream |                                2 frames | shipped, v3  |

</div>

Estos recuentos pertenecen a **esa secuencia**, no a todos los usos posibles. La conexión SSE sigue ocupando recursos, requiere límites y puede sufrir cortes de proxies. El laboratorio admite como máximo dieciséis streams simultáneos, los termina a los treinta segundos y corta una respuesta si su buffer indica un consumidor lento, en lugar de crear una cola sin límite.

No hemos medido p95, CPU, ancho de banda o coste económico. Tampoco tenemos almacenamiento durable, broker, varias réplicas, TLS o autorización reevaluada durante el stream. Las identidades son dos strings públicos de fixture. No sirven para desplegar el servicio.

## Código del artículo

El [índice de P031](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p031/README.md) reúne [servidor HTTP](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/http.mjs), [estado y replay](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/orders.mjs), [clientes](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/clients.mjs) y [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/tests/integration.test.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/api-integration test
pnpm --dir packages/api-integration demo
```

Antes de elegir, escribe dos requisitos: cuánto puede tardar la pantalla en enterarse y si necesita el estado actual o cada transición. Si un snapshot cada pocos segundos cumple el contrato, el polling puede ser una solución suficiente. Si necesitas cambios continuos, diseña también cómo recuperar lo ocurrido mientras nadie escuchaba.
