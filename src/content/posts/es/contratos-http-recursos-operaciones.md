---
id: API-HTTP
title: 'Contratos HTTP: crear un recurso no es completar una operación'
published: 2026-10-17T01:02:00Z
locale: es
translationKey: reliable-http-contracts
slug: contratos-http-recursos-operaciones
draft: true
status: draft
level: intermedio
prerequisites: [API-MONEY]
description: 'Diseña recursos, estados y respuestas HTTP que distingan aceptación, creación y finalización sin depender de un framework.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [http, api, contratos, backend]
---

La API devuelve `200 OK` y la interfaz muestra «reserva confirmada». El servidor solo había guardado la solicitud: el proveedor todavía no había respondido. Ambos equipos entendieron cosas distintas del mismo éxito HTTP.

Un **contrato** debe explicar qué significa una respuesta, no solo qué propiedades contiene. Esta entrega de **APIs y seguridad sin atajos** diseña ese acuerdo antes de elegir un framework. Necesitas la representación de [Money](/posts/dinero-tipos-validacion-typescript) y HTTP elemental.

## Recursos y procesos tienen tiempos diferentes

Un recurso es algo que la API identifica y sobre lo que ofrece operaciones. Puede representar una intención en curso: crear `/operations/o1` no obliga a que el trabajo externo haya terminado.

Nuestra API de ejemplo acepta una solicitud, guarda una operación consultable y permite leer su estado. **`201 Created`** indica creación de ese recurso. Su campo `status` puede seguir siendo `processing`.

**`202 Accepted`** sirve cuando aceptamos procesar una solicitud cuyo procesamiento no está completado. No promete éxito futuro. Debe acompañarse de una forma útil de consultar el progreso cuando el diseño lo permita. Elegir entre ambos depende de qué recurso y qué compromiso ha hecho realmente el servidor.

<img src="/assets/visuals/reliable-services/API-HTTP.svg" alt="El cliente crea una operación en la API, recibe su identificador y consulta su estado mientras un worker habla con el proveedor." width="508" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-HTTP.svg).

## Escribe primero el significado de cada operación

| Operación                       | Compromiso del servidor                  | Respuesta orientativa                     |
| ------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `POST /orders`                  | Guardar un pedido válido                 | `201` y su localización                   |
| `GET /orders/o1`                | Leer una representación autorizada       | `200` o error definido                    |
| `POST /orders/o1/cancellations` | Solicitar una cancelación permitida      | Depende del recurso creado y su ejecución |
| `GET /operations/p1`            | Consultar progreso, no repetir el efecto | `200`, incluso si sigue pendiente         |

Esta tabla es una decisión didáctica, no una convención universal. Modelar cancelaciones como recursos permite registrar una solicitud con identidad propia. Un endpoint de comando también puede ser razonable; lo importante es no disfrazar una acción con efectos como una lectura.

**`GET`** es safe: el cliente no solicita un cambio de estado de negocio. Eso no impide efectos incidentales, como logs. **Idempotent** significa que repetir una solicitud idéntica tiene el mismo efecto pretendido que hacerla una vez, no que todas sus respuestas deban ser iguales. Un segundo `DELETE` podría devolver otro código sin invalidar esa propiedad.

## El caso de uso puede existir antes que el router

Archivo: `servicios-fiables/src/service.ts` (extracto).

```typescript
export async function createOrder(
  writer: OrderWriter,
  id: string,
  input: unknown,
): Promise<Order> {
  const order: Order = { id, money: parseCommand(input), status: 'created' }
  await writer.save(order)
  return order
}
```

Los tipos y las importaciones están en el archivo completo. El caso de uso valida, construye y espera a que el writer confirme. El adaptador HTTP tendrá que traducir ese resultado a status, headers y JSON. No respondemos «creado» antes de que `save` termine.

El writer del test es un fake en memoria. Permite comprobar el orden y la propagación de errores, pero no demuestra durabilidad. Esa garantía dependerá de una transacción y de la configuración real de almacenamiento.

## El cliente también necesita conocer el camino de error

El contrato debe describir entrada, salida, códigos de error, autorización, límites de tamaño y comportamiento ante repetición. Añadir un ejemplo de éxito en OpenAPI no cubre todo eso.

Tampoco conviene tratar una desconexión como una respuesta negativa del negocio. Si se pierde la respuesta después de guardar, el cliente no puede deducir que el pedido no existe. Retomaremos esta diferencia en la serie de sistemas distribuidos.

**HTTP JSON** no es automáticamente **REST**. REST incluye restricciones arquitectónicas adicionales; aquí usamos recursos y semántica HTTP sin afirmar que todo endpoint con JSON satisface ese estilo completo. Para comunicación interna con esquemas fuertemente controlados, RPC o gRPC pueden ser alternativas; no evitan por sí solos los fallos de red.

## Garantías y límites

El laboratorio prueba el caso de uso y su respuesta lógica, no levanta un servidor HTTP ni valida un documento OpenAPI. El contrato de la tabla es una especificación para el futuro adaptador, no una API ya desplegada.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Archivo: terminal, desde `servicios-fiables/`.

```bash
node --test --test-name-pattern="caso de uso" tests/core.test.mjs
```

## Ejercicio: distinguir dos éxitos

Escribe ejemplos de respuesta para una operación recién creada y otra confirmada. Deben compartir identificador, tener estados distintos y permitir que la UI no confunda «solicitud recibida» con «trabajo completado». Añade el caso de una respuesta perdida.

La siguiente pregunta es qué rechazar y cómo contárselo al cliente: [validación y Problem Details](/posts/validacion-errores-api-problem-details).

## Referencias

- [RFC 9110: semántica HTTP, métodos y status codes](https://httpwg.org/specs/rfc9110.html).
- [OpenAPI: especificación de contratos HTTP](https://spec.openapis.org/oas/v3.1.1.html).

Fuentes consultadas el 17 de octubre de 2026. Se usa OpenAPI 3.1.1 como referencia de versión, no como afirmación de última versión disponible.
