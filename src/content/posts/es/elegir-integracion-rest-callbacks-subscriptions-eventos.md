---
id: API-INTEGRATION-CHOICE
title: 'Elegir una integración: REST, callbacks, subscriptions y eventos'
published: 2026-10-20T08:03:00Z
locale: es
translationKey: elegir-integracion-rest-callbacks-subscriptions-eventos
slug: elegir-integracion-rest-callbacks-subscriptions-eventos
draft: true
status: draft
level: intermedio
prerequisites: [P031, API-INTEGRATION-GRAPHQL, API-INTEGRATION-GRPC]
description: 'Elige una integración por sus requisitos de sincronía, contrato y recuperación. Distingue REST, GraphQL y gRPC de polling, callbacks, subscriptions y eventos durables.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, arquitectura, graphql, grpc, webhooks, eventos]
---

«¿Usamos REST o eventos?» parece una decisión concreta, pero mezcla preguntas distintas. Un servicio puede aceptar una petición HTTP, responder con un recurso y publicar después un evento. Y una API GraphQL puede consultarse mediante polling.

Después de implementar [seguimiento por polling y SSE](/posts/polling-eventos-estado-pedido), [lecturas GraphQL](/posts/graphql-resolvers-n-mas-uno-dataloader) y un [RPC con gRPC](/posts/grpc-protobuf-deadlines-compatibilidad), podemos elegir con más precisión: qué contrato necesitamos, cuándo espera el consumidor una respuesta y cómo recuperará lo que no recibió.

## Separa el contrato, el patrón de interacción y la entrega

El **contrato** define qué operaciones o datos exponemos y cómo interpretarlos. El **patrón de interacción** describe quién inicia cada intercambio y si espera un resultado en esa llamada. Las **garantías de entrega** explican qué ocurre ante duplicados, caídas o consumidores desconectados.

Estas dimensiones se relacionan, pero una no determina automáticamente las otras:

<div role="region" aria-label="Dimensiones de una integración" tabindex="0" style="overflow-x:auto">

| Dimensión           | Ejemplos                                    | Lo que todavía hay que decidir                    |
| ------------------- | ------------------------------------------- | ------------------------------------------------- |
| Interfaz y contrato | Recursos HTTP, GraphQL, RPC con Protobuf    | Autorización, límites, compatibilidad y semántica |
| Interacción         | Request/response, polling, callback, stream | Cuánto esperar, cuándo reconectar y cómo cancelar |
| Recuperación        | Snapshot, cursor, replay, inbox             | Retención, duplicados, huecos y efectos repetidos |

</div>

**REST** es un estilo arquitectónico, no un sinónimo de «cualquier JSON por HTTP». Nuestra demo utiliza recursos, métodos y validadores HTTP; no pretende demostrar todas las restricciones de REST. Lo importante para la comparación es qué ofrece ese contrato de recursos y qué necesita su consumidor.

**GraphQL** da un schema y una forma de seleccionar datos relacionados. No convierte la lectura en asíncrona ni elimina N+1. **gRPC** organiza operaciones con mensajes y un runtime de llamadas remotas. Un método unary sigue siendo request/response aunque su API en Node devuelva una promesa.

## Request/response encaja cuando necesitamos una respuesta ahora

Si el servicio de atención abre un pedido, necesita su estado actual para dibujar la pantalla. Una lectura HTTP puede ser suficiente. Si otro servicio consulta un contrato interno compartido con varios lenguajes, gRPC puede encajar. Si varias pantallas necesitan combinaciones distintas de campos relacionados, GraphQL merece evaluarse.

Ninguna elección evita que el consumidor dependa de la disponibilidad de quien responde. Una llamada larga ocupa recursos y puede superar el presupuesto de la petición original. Añadir retries a todas las capas puede empeorar una dependencia saturada.

Para un trabajo que tarda minutos, podemos aceptar la solicitud y devolver **202 Accepted** con una referencia a su estado, en lugar de mantener abierta la petición original. Un 202 significa aceptación para procesamiento, no finalización exitosa. El consumidor consulta el recurso de operación o recibe una notificación posterior. Esa semántica debe quedar en el contrato, incluidos fallos y caducidad.

No hemos implementado una cola de trabajos en este laboratorio. El pedido cambia desde el harness de pruebas: sirve para contrastar las lecturas, no para fingir un workflow durable.

## Callback y webhook: el proveedor inicia una petición posterior

En un **callback**, el resultado llega mediante otra llamada al consumidor. Imagina una exportación: el cliente solicita el trabajo y proporciona un destino previamente autorizado; al terminar, el proveedor envía una petición HTTP a ese destino.

Un **webhook** suele notificar hechos a endpoints registrados, por ejemplo order.shipped. Los términos se solapan según el producto. Lo importante es especificar quién registra el destino, qué hecho dispara la petición y qué respuesta cuenta como recepción.

En OpenAPI 3.1 podemos describir **callbacks** asociados a una operación y **webhooks** en la sección correspondiente. La [especificación de OpenAPI](https://spec.openapis.org/oas/v3.1.1.html#callback-object) distingue esas formas de documentar la interacción. Ninguna de ellas implementa por sí sola la entrega o sus reintentos.

Aceptar una URL arbitraria de callback abre una frontera de seguridad. El proveedor podría acabar consultando un servicio interno, siguiendo un redirect o enviando credenciales a otro origen. Aplican los controles del [artículo sobre SSRF](/posts/ssrf-destinos-permitidos-redirecciones): destinos autorizados, validación al conectar y política de salida, no solo una comprobación de que el texto empieza por https.

El receptor también tiene trabajo: verificar quién envió el mensaje, comprobar integridad y frescura, persistirlo si promete aceptación durable y evitar repetir efectos ante reintentos. Una firma válida no demuestra que el evento sea nuevo ni que llegue en orden. El tutorial de [webhooks, firmas e inbox](/posts/webhooks-firmas-inbox-eventos-desordenados) desarrolla ese mecanismo con su propio laboratorio; no lo duplicaremos aquí.

## Subscriptions: mantener interés en una fuente de cambios

Una **subscription** expresa interés continuado: «envíame futuras actualizaciones de este pedido». No es una petición HTTP independiente que el proveedor haga al endpoint del consumidor; el cliente mantiene o restablece el canal elegido.

En GraphQL, una operación subscription tiene un campo raíz y selecciona la forma del resultado de cada actualización. El schema puede describirla sin decidir por sí solo el transporte. La [documentación de subscriptions de GraphQL](https://graphql.org/learn/subscriptions/) explica ese modelo y sus costes operativos.

WebSocket y SSE son opciones de transporte, no garantías de replay. La reconexión puede abrir un canal nuevo y perder lo ocurrido en medio si el sistema no conserva eventos. También hay que resolver la carrera entre la lectura inicial y el inicio de la suscripción.

Nuestro laboratorio implementa **SSE propio**, no el protocolo de subscriptions de GraphQL ni una subscription gRPC. Su snapshot y su cursor prueban una estrategia de recuperación local. No sería correcto cambiar la etiqueta y afirmar que ya hemos verificado esos otros protocolos.

Una conexión larga también alarga la vida del contexto de seguridad. Si el usuario pierde permisos, no basta con que se autenticara una vez al conectar. Necesitamos una política de revalidación, expiración o cierre, además de límites por consumidor y tratamiento de backpressure. En esta demo la identidad de fixture es fija y el servidor termina los streams a los treinta segundos; eso no demuestra revocación en tiempo real.

## Eventos: publicar un hecho no garantiza que alguien lo procese

Un **evento** describe algo que ocurrió, como OrderShipped. Un **comando** pide que algo ocurra, como ShipOrder. Confundirlos genera contratos ambiguos: recibir el comando no demuestra que el pedido ya esté enviado.

Publicar un hecho puede reducir la necesidad de conocer a todos sus consumidores, pero mantiene acoplamiento al schema, significado y política de retención. Una aplicación que depende de cada evento sigue dependiendo de que el sistema lo conserve y permita recuperarlo.

<img src="/assets/visuals/api-contracts/API-INTEGRATION-CHOICE.svg" alt="Para elegir una integración se concreta si se necesita una respuesta inmediata o una actualización posterior. Después se decide entre lectura periódica, canal de cambios o callback y se define recuperación, identidad y límites para la opción elegida." width="284" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-INTEGRATION-CHOICE.svg).

Si el estado se confirma en SQL y el evento se publica en otro sistema, hay dos efectos que pueden separarse por una caída. El [transactional outbox](/posts/transactional-outbox-inbox-eventos) conserva la intención de publicación junto con el cambio de negocio; un publicador puede enviarla después. Esa separación implica retraso, reintentos y posibles duplicados. No convierte la entrega en exactly once.

Nuestro historial en memoria no sustituye ese mecanismo. Si el proceso se reinicia, pierde tanto pedidos como eventos. Solo demuestra replay dentro de la retención de un proceso activo.

## Para el pedido del ejercicio no necesitamos cinco interfaces en producción

La misma operación se ha expuesto de varias formas para aprender. Eso no es una recomendación de mantenerlas todas.

Para una pantalla con tolerancia de varios segundos, empezaría por lectura HTTP y polling condicional. Es fácil de inspeccionar y permite recuperar el estado actual tras un fallo. Si el requisito exige cambios continuos, evaluaría snapshot más SSE y un historial recuperable. Mediría conexiones activas, retraso desde confirmación hasta visualización y frecuencia de resync, no solo requests por segundo.

Si un partner necesita enterarse aunque su proceso se desconecte, una conexión abierta no basta. Consideraría webhook con entrega persistente y reintentos, o consumo de eventos con retención y offsets, según la relación entre sistemas. La política de caducidad y qué hacer con un consumidor permanentemente caído debe quedar escrita.

GraphQL puede aportar valor a la composición de pantallas y gRPC a contratos entre servicios. No los añadiría solo para sustituir un GET sencillo por otra sintaxis. En el ejercicio GraphQL reduce cuatro lecturas de repositorio a dos **cuando añadimos batching**; ese dato no decide qué interfaz necesita el producto.

## Un cambio compatible necesita consumidores que sigan funcionando

En recursos HTTP, revisamos representación, errores, métodos y significado. En GraphQL, los documentos existentes deben continuar validando y obteniendo la semántica prometida. En Protobuf, conservamos etiquetas y probamos clientes anteriores. En eventos, puede haber mensajes antiguos almacenados que se consuman mucho después del despliegue.

Versionar el nombre no elimina esa convivencia. Antes de retirar una forma de contrato necesitamos saber qué consumidores siguen usándola y cómo van a migrar. Los [contract tests y la deprecación](/posts/versionado-api-deprecacion-migracion-consumidores) ayudan a convertir esa decisión en un cambio comprobable.

## Código del artículo y ejercicio de decisión

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-integration-choice/README.md) enlaza el [README de límites](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/README.md), la [demo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/demo.mjs) y la [evidencia reproducible](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/results/experiment.json).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/api-integration test
pnpm --dir packages/api-integration demo
```

Escribe una decisión para una pantalla interna y otra para un partner desconectado durante una hora. Para cada una, concreta el retraso permitido, si necesita el estado actual o todas las transiciones, quién verifica identidad y permisos, cuánto se retienen los mensajes y qué ocurre al perderlos. Si una alternativa no responde a esas preguntas, todavía falta diseño aunque ya tengamos elegido el protocolo.
