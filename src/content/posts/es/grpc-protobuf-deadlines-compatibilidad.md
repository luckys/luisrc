---
id: API-INTEGRATION-GRPC
title: 'gRPC: contratos Protobuf, deadlines y compatibilidad'
published: 2026-10-20T08:02:00Z
locale: es
translationKey: grpc-protobuf-deadlines-compatibilidad
slug: grpc-protobuf-deadlines-compatibilidad
draft: true
status: draft
level: intermedio
prerequisites: [P031]
description: 'Implementa GetOrder con gRPC y Protobuf. Comprueba metadata, errores, cancelación por deadline y la lectura de un cliente antiguo cuando el servidor añade un campo.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, grpc, protobuf, contratos, testing]
---

`await client.getOrder(...)` parece una llamada a una función, pero el pedido está en otro proceso. La llamada puede tardar, fallar antes de llegar o completar trabajo después de que quien la inició haya dejado de esperar. Usar **gRPC** no elimina esas posibilidades: nos da un contrato y herramientas para tratarlas.

Vamos a consultar el mismo estado de pedido que usamos con [HTTP y eventos](/posts/polling-eventos-estado-pedido). Esta vez definiremos una operación explícita, enviaremos una identidad de fixture en metadata y comprobaremos dos cosas que suelen olvidarse en una demo: cuánto esperamos y si un consumidor anterior sigue entendiendo la respuesta.

## RPC expresa una operación, no una lectura de una tabla

**RPC**, Remote Procedure Call, organiza la interfaz alrededor de operaciones. En lugar de diseñar únicamente representaciones y métodos HTTP, declaramos un servicio con `GetOrder` y sus mensajes de entrada y salida.

Este es `orders.proto`, el contrato ejecutado por el laboratorio:

```protobuf
syntax = "proto3";
package orders.v1;

service Orders { rpc GetOrder(GetOrderRequest) returns (Order); }
message GetOrderRequest { string id = 1; }
message Order {
  string id = 1;
  string status = 2;
  uint32 version = 3;
  string display_label = 4;
  reserved 5;
  reserved "legacy_note";
}
```

`syntax` selecciona la sintaxis proto3; no es la versión de la API. `package orders.v1` crea un namespace del contrato. Ese v1 tampoco obliga al runtime a rechazar cambios incompatibles: sigue siendo nuestra responsabilidad revisar qué modificamos.

Los mensajes describen datos de intercambio. No necesitamos publicar todas las columnas internas ni convertir cada método de una clase en un RPC. En particular, tenant no llega dentro de GetOrderRequest: el servidor lo obtiene del contexto autenticado. Un ID de pedido no debería permitir elegir otra organización.

El `uint32` acota la representación de version a un entero sin signo de 32 bits. No garantiza que la versión aumente ni que el pedido exista. También limita el crecimiento que esta demo admite; para un contador de larga vida habría que elegir un tipo adecuado y revisar su representación en cada lenguaje, incluidos los problemas de precisión de enteros grandes en JavaScript.

## Protobuf necesita los números de campo para interpretar los bytes

En el formato binario, el número identifica el campo. `status = 2` no significa «segunda propiedad del objeto» ni asigna un estado por defecto: reserva la etiqueta 2 para ese significado dentro de Order.

El servidor añade `display_label = 4`, pero el contrato antiguo del laboratorio solo conoce id, status y version. Al recibir la respuesta, el cliente antiguo decodifica los tres que entiende y omite el cuarto en el objeto que entrega a la aplicación. El test lo verifica mediante una llamada gRPC real con ese contrato anterior, no comparando dos objetos escritos a mano.

Que ese cambio sea legible en binario no autoriza a cambiar cualquier cosa. Reutilizar el número 2 para otro dato haría que lectores antiguos lo interpretasen con el significado anterior. Si retiramos un campo, reservar su número y, cuando corresponda, su nombre ayuda a impedir que alguien lo recicle después. Son [recomendaciones explícitas de Protobuf](https://protobuf.dev/best-practices/dos-donts/).

Tampoco basta con preguntar si un payload «se puede decodificar». Cambiar la unidad, el significado de un estado o el comportamiento ante un ID ausente puede romper al consumidor sin producir un error de parsing. Si hay una pasarela **ProtoJSON**, los nombres y otras reglas de ese formato también forman parte de la revisión; nuestro test demuestra únicamente esta evolución binaria concreta.

En proto3, los campos escalares sin `optional` tienen presencia implícita: el valor por defecto puede no distinguirse de la ausencia en la API que usemos. Por eso `string id = 1` no valida que el cliente envíe un ID útil. El servidor rechaza el string vacío como **INVALID_ARGUMENT**. La [guía de proto3](https://protobuf.dev/programming-guides/proto3/) detalla tipos, presencia y evolución; un schema no sustituye las reglas del servicio.

## La demo carga el contrato en runtime, no genera TypeScript

Para mantener pequeño el ejercicio usamos **@grpc/grpc-js** y **@grpc/proto-loader**. Este último carga los `.proto` al iniciar el proceso. No hay un paso oculto con protoc ni código TypeScript generado.

Es una de las opciones documentadas en el [tutorial de gRPC para Node](https://grpc.io/docs/languages/node/basics/). En un proyecto con consumidores en Go, Java o C#, normalmente querríamos integrar generación y verificación de contratos en su build. Añadir type generation aquí sería un ejercicio distinto; no atribuyamos comprobación estática a los objetos dinámicos de esta demo.

El cliente recibe una dirección loopback y usa el contrato actual o el anterior. El helper `getOrder` de `rpc.mjs` convierte la API de callbacks en una promesa:

```javascript
export function getOrder(client, id, { token = 'fixture-north', timeoutMs = 2000 } = {}) {
  const metadata = new grpc.Metadata()
  metadata.set('authorization', `Bearer ${token}`)
  return new Promise((resolve, reject) =>
    client.getOrder(
      { id },
      metadata,
      { deadline: new Date(Date.now() + timeoutMs) },
      (error, order) => (error ? reject(error) : resolve(order)),
    ),
  )
}
```

El token por defecto es **público y ficticio**. Solo hace cómoda la ejecución local. Cambiarlo por una clave real sin cambiar el transporte y el verificador no convertiría este código en autenticación segura.

## Un deadline limita la espera; el servidor debe abandonar el trabajo pendiente

Un **deadline** fija el instante hasta el que la llamada puede seguir pendiente. Aquí lo calculamos a partir de un presupuesto de dos segundos. No hemos medido que dos segundos sea el valor correcto: es una política de la demo.

<img src="/assets/visuals/api-contracts/API-INTEGRATION-GRPC.svg" alt="El cliente inicia GetOrder con metadata y deadline. El servidor valida identidad y pedido. Si termina a tiempo, devuelve Order; si vence el plazo, el cliente recibe DEADLINE_EXCEEDED y el handler debe cancelar su trabajo pendiente." width="266" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-INTEGRATION-GRPC.svg).

El test introduce un timer de trabajo de cinco segundos y da al cliente cien milisegundos. No duerme cinco segundos: espera **DEADLINE_EXCEEDED** y después comprueba que el handler recibió la cancelación y eliminó su timer.

Cancelar no interrumpe mágicamente cualquier función. Si el handler ya lanzó una consulta o una llamada downstream, debe propagar una señal que ese adaptador soporte y dejar de programar trabajo nuevo. Nuestra prueba cubre un timer cancelable, no un driver SQL ni un proceso externo.

En una cadena de servicios, cada salto no debería reiniciar alegremente el presupuesto completo. Si del segundo inicial quedan cien milisegundos, dar otro segundo al siguiente servicio alarga la espera que queríamos limitar. La [guía de deadlines de gRPC](https://grpc.io/docs/guides/deadlines/) explica el presupuesto y la necesidad de detener el trabajo que la aplicación haya iniciado.

Un timeout tampoco es un rollback. Para GetOrder, repetir la lectura resulta razonable según la política de reintentos. Si fuera CreateOrder, perder la respuesta no demostraría que el pedido no se creó. Necesitaríamos idempotencia y una forma de consultar el resultado antes de reintentar una operación con efectos.

## Metadata transporta identidad; el contrato no decide permisos

El servidor lee una única entrada authorization, reconoce una de dos identidades de fixture y obtiene su tenant. Después busca la clave compuesta tenant/pedido. El mismo o1 devuelve pending para North y cancelled para South; o2 no existe para South.

Los tests distinguen tres fallos:

- **UNAUTHENTICATED**: la credencial de fixture no es válida.
- **INVALID_ARGUMENT**: el ID no cumple el formato admitido.
- **NOT_FOUND**: no hay pedido visible en ese tenant.

Para una política con permisos por recurso necesitaríamos además decisiones como las del [artículo de autorización](/posts/autorizacion-rbac-abac-permisos-recursos) y mapear sus errores sin revelar datos sensibles. Un `.proto` tipado no añade esa política.

Los sockets de la demo usan HTTP/2 sin TLS exclusivamente en 127.0.0.1. No se ha configurado **mTLS**, validación de JWT, OAuth, revocación o gestión de certificados. La [guía de autenticación de gRPC](https://grpc.io/docs/guides/auth/) describe credenciales de canal y de llamada; enviar metadata por un canal inseguro fuera del fixture expondría su contenido.

## Cuándo compensa introducir gRPC

Puede encajar cuando varios servicios controlados necesitan un contrato de operaciones compartido, clientes para varios lenguajes y herramientas para deadlines y streaming. También añade decisiones de distribución de schemas, generación o carga de clientes, observabilidad e infraestructura compatible.

El navegador no puede usar sin más el mismo cliente Node de esta demo. Opciones como gRPC-Web requieren revisar cliente, proxy y capacidades de streaming. Para una API pública consumida con curl o desde páginas web, una interfaz HTTP con JSON puede ser más accesible.

Aquí implementamos un **RPC unary**, un mensaje de entrada y uno de salida. gRPC también tiene server streaming, client streaming y streaming bidireccional. No hemos probado esos modos ni asumimos que un stream sea un historial durable de negocio.

No hay un benchmark que enfrente gRPC con REST. El tamaño de los mensajes, la compresión, la reutilización de conexiones y el trabajo del servidor pueden cambiar la comparación. «Usa Protobuf» no permite deducir la latencia de tu operación.

## Código del artículo

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-integration-grpc/README.md) incluye el [contrato actual](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/orders.proto), el [contrato anterior](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/orders-legacy.proto), el [cliente y servidor](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/rpc.mjs) y sus [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/tests/integration.test.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/api-integration test
```

Prueba primero el consumidor antiguo contra el servidor actual. Después revisa si ese cambio conservaría también el significado de los datos, no solo sus bytes. En la [última entrega del bloque](/posts/elegir-integracion-rest-callbacks-subscriptions-eventos) juntamos estas decisiones sin tratar protocolos, estilos de API y garantías de entrega como si fueran alternativas equivalentes.
