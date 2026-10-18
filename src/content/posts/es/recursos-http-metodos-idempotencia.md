---
id: P021
title: 'Recursos HTTP: qué prometen GET, POST, PUT, PATCH y DELETE'
published: 2026-10-18T04:01:00Z
locale: es
translationKey: api-http-methods-idempotency
slug: recursos-http-metodos-idempotencia
draft: true
status: draft
level: intermedio
prerequisites: [P020]
description: 'Diseña operaciones HTTP sin confundir safe, idempotent y respuestas iguales. Sustitución con PUT, cambios parciales y creación frente a procesamiento pendiente.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, http, rest, idempotencia, backend]
---

El primer DELETE devuelve `204`; el segundo, `404`. Eso no demuestra que el endpoint haya dejado de ser idempotente. Después de ambas peticiones el efecto pretendido sigue siendo el mismo: el recurso ya no está disponible.

Las propiedades de los métodos HTTP describen expectativas de interacción, no una obligación de repetir los mismos bytes. Después de [definir el contrato](/posts/api-contrato-esquema-clientes), vamos a justificar cada operación de nuestro servidor de pedidos.

## El recurso no es la fila ni su representación actual

`/orders/o1` identifica un pedido. Su JSON representa algunos datos de ese pedido en un momento concreto. El recurso puede seguir existiendo aunque cambie su etiqueta o aunque el almacenamiento deje de ser un Map.

La URI no necesita mostrar la tabla ni todos sus atributos. Tampoco cada operación de negocio tiene que reducirse a modificar una columna: una solicitud de pago o cancelación puede tener identidad y ciclo de vida propios.

Para este laboratorio solo implementamos pedidos editables y su borrado. Las propuestas de pago que aparecen más adelante explican decisiones de contrato; no ejecutan cargos ni llaman a un proveedor.

<img src="/assets/visuals/api-contracts/P021.svg" alt="POST crea un pedido identificado por una URI; GET lee su representación, PUT la sustituye, PATCH modifica label y DELETE hace que posteriores lecturas devuelvan ausencia." width="484" height="1531" loading="lazy" style="width:100%;height:auto" />

[Ampliar el flujo de operaciones](/assets/visuals/api-contracts/P021.svg).

## Safe e idempotent no significan lo mismo

Un método **safe** no solicita un cambio del estado de negocio. GET puede generar logs o métricas como efectos incidentales; no debería confirmar un pago ni borrar un pedido. Navegadores, cachés y herramientas pueden realizar lecturas sin que una persona confirme un efecto irreversible.

**Idempotent** significa que repetir solicitudes idénticas tiene el mismo efecto pretendido que hacer una sola. No obliga a producir el mismo código ni impide registrar cada intento. Una lectura es safe e idempotente; una eliminación puede ser idempotente sin ser safe.

<div class="overflow-x-auto" role="region" aria-label="Métodos del laboratorio y su contrato" tabindex="0">

| Operación | Safe | Idempotente según el contrato | Resultado de éxito |
| --- | --- | --- | --- |
| GET /orders/o1 | Sí | Sí | 200 y representación |
| POST /orders | No | No se promete | 201, Location y pedido nuevo |
| PUT /orders/o1 | No | Sí | 200 y representación sustituida |
| PATCH /orders/o1 | No | Sí para asignar/eliminar label | 200 y representación actualizada |
| DELETE /orders/o1 | No | Sí | 204 vacío; después puede ser 404 |

</div>

La tabla describe nuestra implementación. PATCH no es universalmente idempotente: una operación «incrementar en uno» puede acumular efectos, mientras que «asignar este valor» puede repetirse sin cambiarlos.

## POST crea en la colección elegida por el contrato

El cliente envía los campos y el servidor asigna un ID. Al repetir el mismo cuerpo, el laboratorio crea o1 y después o2. Los tests exigen esa diferencia para no ocultar deduplicación inexistente.

Si necesitamos evitar dos cobros tras un reintento, debemos diseñar una garantía adicional. Una idempotency key con almacenamiento del resultado es una opción; no aparece por usar POST ni por deshabilitar el botón del frontend.

`201 Created` indica creación de uno o más recursos. Nuestro `Location` señala el pedido nuevo. No estamos diciendo que cualquier proceso externo relacionado haya terminado: crear una solicitud y completar su trabajo son compromisos distintos.

## PUT sustituye lo editable, no aplica un diff implícito

Nuestro PUT recibe la representación completa de los campos editables. Si el pedido tenía `label` y la nueva entrada lo omite, la etiqueta desaparece. El ID sigue bajo control del servidor y no forma parte de esa entrada editable.

El laboratorio solo permite actualizar pedidos existentes y devuelve 404 si falta el ID. HTTP también permite diseños donde PUT crea en una URI conocida por el cliente; no atribuimos esa posibilidad a este servidor porque no la implementa.

Repetir el mismo PUT conserva el mismo estado. Pero la idempotencia no evita que otro usuario escriba entre ambos intentos. Sin control de concurrencia, podríamos sobrescribir una edición ajena.

**ETag** e **If-Match** permiten diseñar actualizaciones condicionales, con una respuesta como `412 Precondition Failed` cuando la versión ya no coincide. No los implementamos aquí: no hay que confundir semántica del método con prevención de lost updates.

## PATCH necesita definir el documento parcial

Nuestro documento admite solo `label`. Omitirlo conserva el actual; enviar un string lo asigna; enviar `null` lo elimina. Un campo como `amountMinor` provoca 422 en lugar de ignorarse silenciosamente.

Función completa `patchOrder`, en `server.mjs` del [laboratorio](/assets/examples/api-contratos-lab.zip):

```javascript
export function patchOrder(current, patch) {
  if (
    !object(patch) ||
    Object.keys(patch).some((key) => key !== 'label') ||
    ('label' in patch &&
      patch.label !== null &&
      (typeof patch.label !== 'string' || [...patch.label].length > 80))
  )
    throw new HttpError(422)
  const next = { ...current }
  if (patch.label === null) delete next.label
  else if ('label' in patch) next.label = patch.label
  return next
}
```

El ejemplo usa `application/json` con un contrato propio. No lo anunciamos como una implementación completa de **JSON Merge Patch** o **JSON Patch**: esos formatos definen otras reglas y media types. Compartir una convención para null no equivale a soportar toda su especificación.

## DELETE no promete la misma respuesta ni borrado físico universal

El primer DELETE elimina el pedido del Map y responde 204 sin cuerpo. El segundo obtiene 404 porque el recurso ya no existe. En ambos casos, una lectura posterior no puede recuperar ese pedido.

En otro sistema, eliminar un recurso podría conservar un registro de auditoría según una política explícita. DELETE no certifica que todo byte haya desaparecido de backups, logs y almacenamiento. Ese requisito necesita un diseño de retención distinto.

## Diseñar pagos sin convertir una lectura en una acción

Una propuesta es `POST /orders/o1/payment-requests`. Si creamos una solicitud identificable, podemos responder 201 con su URI y un estado inicial `pending`. Si solo aceptamos trabajo cuyo procesamiento no terminó, 202 puede ser adecuado según el compromiso real.

Consultar luego esa solicitud mediante GET informa de su progreso; no debe volver a ejecutar el cobro. El artículo previo sobre [recursos y operaciones](/posts/contratos-http-recursos-operaciones) desarrolla esa separación. Aquí es una propuesta de diseño, no una ruta del servidor descargable.

Una respuesta perdida sigue dejando incertidumbre: puede haberse creado la solicitud sin que el cliente reciba su ID. Elegir bien el método no sustituye reconciliación, deduplicación y estados persistentes.

## HTTP JSON no demuestra una arquitectura REST completa

**REST** es un estilo arquitectónico con restricciones como interfaz uniforme, separación cliente-servidor, interacción stateless, caché y capas. Su interfaz uniforme incluye identificación de recursos, representaciones, mensajes autodescriptivos e hipermedia.

Nuestro laboratorio estudia recursos y semántica HTTP. No incluye un flujo hipermedia completo y no lo certificamos como ejemplo de todas las restricciones REST. Cambiar nombres de rutas de verbos a sustantivos no demuestra por sí solo esas propiedades.

## Garantías y límites

Los tests realizan peticiones reales y comprueban métodos, códigos, Location, eliminación sin cuerpo y repetición. El documento `openapi.json` fija el subconjunto publicado. La demo no implementa HEAD, OPTIONS, autenticación, persistencia, pagos ni condiciones de concurrencia; no debe exponerse en red.

Ejecuta `node --test tests/*.test.mjs` desde el ZIP extraído. El README permite repetir el flujo con curl, siempre sobre un puerto local efímero.

## Ejercicio: comprobar el efecto, no comparar solo códigos

Crea un pedido, bórralo dos veces y léelo después. Exige 204, 404 y 404, respectivamente. Explica por qué el estado final satisface la idempotencia. Después repite POST dos veces y comprueba que has creado dos IDs: es una propiedad distinta y necesita otra política si no es deseada.

La siguiente entrega separa [parsing, JSON Schema y reglas de negocio](/posts/validacion-runtime-json-schema-zod-pydantic). Después puedes seguir la implementación con [Zod](/posts/validacion-zod-contratos-errores-runtime) o la alternativa [Pydantic](/posts/validacion-pydantic-strict-null-refinements), antes de retomar [errores públicos y conflictos](/posts/errores-api-problem-details-stock-concurrencia).

## Referencias

- [RFC 9110: métodos, safe, idempotencia y respuestas](https://httpwg.org/specs/rfc9110.html).
- [RFC 5789: PATCH](https://www.rfc-editor.org/rfc/rfc5789).
- [RFC 7396: JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396).
- [Fielding: restricciones arquitectónicas REST](https://roy.gbiv.com/pubs/dissertation/rest_arch_style.htm).
