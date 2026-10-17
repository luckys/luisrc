---
id: P073
title: 'SSE y WebSockets: reconectar no recupera los eventos que has perdido'
published: 2026-10-17T05:06:00Z
locale: es
translationKey: frontend-realtime-reconnection
slug: sse-websockets-reconexion-eventos-perdidos
draft: true
status: draft
level: intermedio
prerequisites: [P069, DIST-FAILURES]
description: 'Elige transporte y define replay, secuencias y snapshots para recuperar una interfaz tras perder conexión.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, sse, websockets, sistemas-distribuidos]
---

El panel indica «Conectado», pero muestra un pedido pendiente que terminó hace un minuto. La conexión se recuperó; los cambios ocurridos durante el corte no. Un indicador verde no demuestra que la vista esté actualizada.

Necesitamos separar cómo transportar mensajes de cómo reconstruir el estado. Partimos del [estado remoto del cliente](/posts/estado-cliente-servidor-optimismo-races) y de los [fallos parciales](/posts/fallos-parciales-timeout-resultado-desconocido).

## Polling, SSE y WebSockets resuelven necesidades distintas

Con **polling**, el cliente consulta periódicamente. Puede bastar si aceptamos unos segundos de antigüedad. Hay que evitar consultas solapadas, pausar tras errores y considerar pestañas ocultas. **Long polling** mantiene abierta la consulta hasta un cambio o un límite; después abre otra.

**Server-sent events**, o **SSE**, entrega eventos desde el servidor mediante una respuesta HTTP. **EventSource** incorpora reconexión y un formato con `id`, `event` y `data`. La [especificación HTML](https://html.spec.whatwg.org/multipage/server-sent-events.html) define el mecanismo, no la persistencia de tus eventos.

**WebSocket** ofrece comunicación bidireccional. Puede encajar cuando ambos lados envían mensajes frecuentes. La aplicación sigue necesitando autenticación, límites y recuperación. Recibir notificaciones no obliga a elegirlo.

En la demo mantenemos los comandos HTTP y recibimos notificaciones por SSE. El experimento no necesita un segundo canal bidireccional.

<img src="/assets/visuals/frontend-series/P073.svg" alt="Tras aplicar la secuencia 7, el cliente pierde 8, 9 y 10; al reconectar pide replay si hay historia o un snapshot si esa historia ya caducó." width="808" height="774" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P073.svg).

## La última secuencia aplicada permite pedir lo que falta

El servidor del laboratorio numera eventos y conserva los diez últimos en memoria. El cliente registra la secuencia aplicada. Ignora una repetida y deja de asumir continuidad si falta una posición.

Archivo: `frontend-tiempo-real/src/data.ts`, función completa.

```typescript
export function acceptEvent(last: number, next: number) {
  if (next <= last) return 'duplicate'
  return next === last + 1 ? 'apply' : 'resync'
}
```

Esta regla requiere enteros consecutivos de un único flujo. No sirve directamente para IDs opacos, particiones o secuencias globales filtradas por permisos. El cursor debe corresponder al flujo observable por ese cliente.

Al reconectar automáticamente, EventSource puede enviar **Last-Event-ID**. Cuando nuestra vista crea otra instancia utiliza `after`. El servidor acepta ambas formas y da prioridad a la cabecera. La [guía de SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) explica el formato del stream.

## Replay y snapshot necesitan una frontera de continuidad

Si conservamos todos los eventos posteriores al cursor, los reenviamos en orden: **replay**. Si el cliente quedó demasiado atrás, enviamos `reset` con un **snapshot** y la secuencia actual.

Aquí todo el estado es el contador, de modo que ese snapshot basta. Un panel de pedidos necesitaría recuperar los pedidos y relacionarlos con un punto del stream. Leer datos y abrir después la conexión sin coordinar ambos pasos deja una ventana donde perder cambios.

La demo prepara replay y suscripción en un turno síncrono del proceso Node. No demuestra cómo obtener un corte consistente entre una base de datos y varios servidores.

## Heartbeats no certifican consistencia

Un comentario de **heartbeat** cada quince segundos mantiene actividad, pero no demuestra que el negocio avance ni sustituye la configuración de proxies. Para reconexiones masivas hay que considerar espera y jitter.

También necesitamos límites de conexiones y políticas para consumidores lentos. Ignorar el buffering de un cliente que no lee puede consumir memoria. El servidor didáctico no implementa esos controles.

EventSource nativo restringe la configuración de cabeceras arbitrarias. La identidad requiere un diseño explícito; poner tokens sensibles en la URL puede filtrarlos en registros. La demo no implementa autenticación.

## Qué comprueba la prueba real

[Descarga el laboratorio](/assets/examples/frontend-tiempo-real-lab.zip). Desde `frontend-tiempo-real/`, ejecuta:

```bash
pnpm test:browser --grep SSE
```

La prueba genera un evento, desconecta la vista, produce doce más y reconecta. Como solo conservamos diez, exige recuperar el snapshot y comprobar la secuencia. El test unitario prueba duplicados y huecos por separado.

No simulamos el transporte con un array en React: el navegador mantiene una conexión SSE real con el servidor local. No se ejecutan WebSockets ni un despliegue detrás de proxy.

## Garantías y límites

La historia permite replay mientras conserve el intervalo necesario; después se reemplaza el contador por un snapshot. Reiniciar pierde historia y reinicia IDs. En producción habría que identificar también la época del flujo y utilizar almacenamiento adecuado.

Un transporte activo no conserva lo que la aplicación dejó de retener. La recuperación forma parte del protocolo de aplicación.

## Ejercicio: recuperar dos eventos sin reset

Añade una prueba con dos eventos durante el corte. Deben recuperarse sin `reset`. Después repite un ID: no debe aplicar dos veces el efecto lógico. No confundas contar mensajes recibidos con aplicar cambios únicos.

Seguimos con [ediciones desconectadas que deben conservar aportaciones concurrentes](/posts/crdt-yjs-offline-convergencia).

## Referencias

- [HTML Standard: server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html).
- [MDN: usar SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events).
- [MDN: WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).

Fuentes consultadas el 17 de octubre de 2026. Replay y snapshot son contratos de la demo, no garantías añadidas por SSE.
