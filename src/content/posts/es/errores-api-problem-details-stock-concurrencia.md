---
id: P023
title: 'Errores de API: distinguir un dato inválido, falta de stock y un conflicto de versión'
published: 2026-10-18T04:03:00Z
locale: es
translationKey: api-errors-problem-details-conflicts
slug: errores-api-problem-details-stock-concurrencia
draft: true
status: draft
level: intermedio
prerequisites: [P021, P022]
description: 'Diseña errores con Problem Details, códigos estables y request IDs. Prueba stock, concurrencia y fallos de infraestructura sin filtrar datos internos.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, http, problem-details, errores, concurrencia, seguridad]
---

Dos clientes intentan reservar sobre la versión uno del mismo inventario. La primera solicitud cambia el stock. La segunda ya no está trabajando sobre el estado que esperaba. Responder «error» no le dice si debe corregir un campo, volver a consultar o esperar a que se recupere el servicio.

Un contrato de errores sirve para tomar esas decisiones sin interpretar mensajes humanos ni conocer el driver de la base de datos. También debe admitir incertidumbre: recibir un fallo no siempre demuestra que la operación no haya tenido efectos.

Continuamos el [laboratorio de validación](/posts/validacion-runtime-json-schema-zod-pydantic) con la misma reserva ficticia. Ahora interesa qué publicamos cuando falla y qué dejamos únicamente para diagnóstico interno.

## Validación, negocio e infraestructura no son tres nombres para un 400

Un fallo de **validación** indica que la solicitud incumple el contrato: cantidad negativa, un enum desconocido o un campo obligatorio ausente. El cliente puede corregirla sin consultar el stack del servidor.

Un error de **negocio** rechaza una operación que sí estaba bien formada. Puede faltar stock o no coincidir la versión esperada. Esas condiciones necesitan estado y significado del dominio, no una expresión regular más precisa.

Un fallo de **infraestructura** impide ejecutar o confirmar una operación: una dependencia no disponible, por ejemplo. No todo fallo técnico es temporal, ni toda excepción desconocida debe clasificarse como «inténtalo de nuevo». Un bug construyendo la respuesta también pertenece al servidor.

Estas categorías ayudan a diseñar, pero no asignan automáticamente un status. Elegimos cada respuesta por su semántica HTTP y por lo que realmente sabemos:

<div class="overflow-x-auto" role="region" aria-label="Errores HTTP y decisiones del cliente" tabindex="0">

| Situación                               | Status | Código del laboratorio   | Decisión del cliente                                         |
| --------------------------------------- | ------ | ------------------------ | ------------------------------------------------------------ |
| JSON mal formado                        | 400    | `malformed_json`         | Corregir la representación.                                  |
| Campos inválidos                        | 422    | `invalid_input`          | Corregir los campos indicados.                               |
| Producto inexistente                    | 404    | `not_found`              | Revisar el recurso solicitado.                               |
| Stock insuficiente                      | 409    | `out_of_stock`           | Consultar disponibilidad o cambiar cantidad.                 |
| Versión obsoleta                        | 409    | `version_conflict`       | Leer el estado actual y decidir de nuevo.                    |
| Dependencia temporalmente no disponible | 503    | `dependency_unavailable` | Aplicar una política de recuperación, no repetir ciegamente. |
| Causa no clasificada                    | 500    | `internal_error`         | Conservar la referencia y tratar el resultado con cautela.   |

</div>

Usar 409 para stock es una decisión documentada de esta API: existe un conflicto con el estado actual. No es una regla que obligue a todas las APIs de inventario. Lo importante es que el consumidor conozca el significado y que la implementación lo conserve.

## Problem Details aporta una estructura, no decide tus errores

**RFC 9457 Problem Details** define una representación común para errores HTTP. El media type es `application/problem+json`. Su campo `type` identifica el tipo de problema; `title` lo resume para personas; `status` debe coincidir con el status enviado. `detail` puede explicar una ocurrencia y `instance` identificarla.

El laboratorio añade `code`, `requestId` y, para validación, `errors`. Son **extensiones propias**, no campos que RFC 9457 imponga con ese significado. No incluimos `detail` cuando no aporta información pública segura.

Para evitar prometer páginas de documentación que no existen, usamos identificadores absolutos como `urn:api-lab:problem:out_of_stock`. Una API real puede publicar una URI HTTPS bajo su control con documentación del problema. El cliente no debería hacer una petición a cada URI para decidir qué ocurrió.

Este es el adaptador de `problems.mjs`:

```javascript
export function toProblem(error, requestId) {
  const code = error instanceof ApiError ? error.code : 'internal_error'
  const [status, title] = definitions[code]
  return {
    type: `urn:api-lab:problem:${code}`,
    title,
    status,
    code,
    instance: `urn:uuid:${requestId}`,
    requestId,
    ...(code === 'invalid_input' ? { errors: error.errors } : {}),
  }
}
```

El módulo incluye el catálogo `definitions` y la clase `ApiError`, que solo admite códigos conocidos. No usa `error.message` para construir la respuesta. Así, una excepción con SQL, una ruta local o una contraseña no pasa accidentalmente al cliente.

**El identificador primario del tipo de problema es `type`**. Nuestro `code` es un alias estable y práctico dentro de este contrato. Mantener ambos coherentes es responsabilidad del servidor. No conviene introducir dos catálogos independientes que puedan contradecirse.

## Stock y versión deben distinguirse aunque ambos devuelvan 409

El inventario empieza con tres unidades de BOOK y versión uno. Una reserva de dos unidades con `expectedVersion: 1` deja una unidad y avanza a versión dos.

Si llega otra petición con versión uno, la rechazamos por **version_conflict** antes de comprobar su cantidad contra el stock actual. El cliente debe saber que su punto de partida cambió. Si consulta de nuevo y envía cantidad dos con versión dos, recibe **out_of_stock**.

El orden de las reglas es deliberado. No devolvemos una mezcla de fallos de negocio calculados sobre un estado que el cliente ya no esperaba. Eso es distinto de acumular errores independientes de campos antes de entrar al servicio.

Volver a consultar es el comportamiento que diseñaríamos para un consumidor real. El servidor de esta demo solo implementa POST; los tests inspeccionan directamente el Map para comprobar el estado. No hay un GET de inventario oculto en el ejemplo ni una recuperación completa del cliente.

Archivo `service.mjs`, función completa:

```javascript
export function reserve(inventory, command) {
  const item = inventory.get(command.sku)
  if (!item) throw new ApiError('not_found')
  if (item.version !== command.expectedVersion) throw new ApiError('version_conflict')
  if (item.stock < command.quantity) throw new ApiError('out_of_stock')
  const next = { stock: item.stock - command.quantity, version: item.version + 1 }
  inventory.set(command.sku, next)
  return { sku: command.sku, reserved: command.quantity, version: next.version }
}
```

El servicio importa `ApiError`. No conoce headers ni escribe la respuesta HTTP; el catálogo del adaptador traduce la condición a status y representación. Para este tamaño no necesitamos un framework de excepciones ni una jerarquía de veinte clases.

Si otro caso de uso no necesita HTTP, puede tratar esos códigos sin copiar el router. Si el sistema creciera, separar los errores del caso de uso del catálogo de transporte sería una evolución razonable. Aquí mantenemos la separación funcional sin añadir capas que no usamos.

<img src="/assets/visuals/api-contracts/P023.svg" alt="Con tres unidades y versión uno, la primera reserva de dos tiene éxito y avanza a versión dos. La segunda con versión uno falla por conflicto; con versión dos y cantidad dos falla por stock." width="319" height="1331" loading="lazy" style="width:100%;height:auto" />

[Ampliar la secuencia de conflictos](/assets/visuals/api-contracts/P023.svg).

## La prueba concurrente tiene una garantía local, no distribuida

Un test envía dos solicitudes HTTP mediante `Promise.all`, con la misma versión y cantidad. Exige exactamente un **200** y un **409/version_conflict**. Después comprueba que queda una unidad y que la versión es dos.

No basta con comprobar dos status: sin inspeccionar el estado podríamos ocultar un descuento doble. También probamos que un fallo de stock no modifica el Map.

La garantía depende de que lectura, comprobación y escritura suceden sin `await` en un solo proceso de Node. Las peticiones compiten, pero ese tramo síncrono no se intercala. El test no demuestra que leer y escribir así sea seguro con una base de datos o varios workers.

En PostgreSQL necesitaríamos una actualización condicional o una transacción con la estrategia apropiada. Introducir una consulta asíncrona entre la comprobación y la escritura cambia el problema. El artículo de [bloqueos y concurrencia](/posts/concurrencia-bloqueos-postgresql) desarrolla esas garantías de almacenamiento.

Tampoco utilizamos ETags. Si el contrato publicara `If-Match`, una precondición HTTP incumplida correspondería a **412 Precondition Failed**. Nuestro `expectedVersion` está en el comando; no anunciamos soporte de una cabecera que no procesamos.

## Un código estable no depende del texto traducido ni del driver

Cambiar «No hay unidades suficientes» por «Stock insuficiente» no debería romper un cliente. Cambiar el significado de `out_of_stock` sí puede hacerlo. Por eso un consumidor decide con `type` y las extensiones documentadas, no buscando palabras dentro de `title`.

Los códigos deben nombrar condiciones observables y útiles. `postgres_error_23505` expone una implementación y puede agrupar conflictos de negocio distintos. Un error conocido del almacenamiento necesita contexto para traducirse: no toda violación de unicidad significa «pedido duplicado».

Una causa inesperada se traduce a un 500 seguro. Un fallo temporal conocido de dependencia se traduce a 503. Lo probamos inyectando ambos errores, incluido uno cuyo mensaje contiene SQL y un secreto ficticio. **No hemos conectado ni provocado una caída de PostgreSQL** en este laboratorio.

Un 503 puede acompañarse de `Retry-After` si hay información razonable para ello. Aquí no la hay y no inventamos un plazo. Reintentar un POST necesita considerar idempotencia, efectos previos y respuesta perdida, no solo el número del status.

## Request ID permite buscar una ocurrencia; no es una traza distribuida

Cada solicitud recibe un UUID generado en el servidor, enviado en `X-Request-Id` y en el problema. `instance` utiliza ese UUID para identificar la ocurrencia. Incluso si el cliente envía su propio `X-Request-Id`, el laboratorio no lo adopta como identificador confiable.

Ese ID permite relacionar respuesta y registro local. No demuestra propagación entre servicios, spans ni contexto de **distributed tracing**. Para eso se necesitaría instrumentación y una política de tratamiento del contexto recibido.

El log tiene una allowlist: `requestId`, método normalizado, plantilla de ruta, status y código. Una URL desconocida se registra como `unmatched`; no copiamos su query, que podría contener datos sensibles. Tampoco registramos el body, Authorization ni mensajes de excepción arbitrarios.

La contrapartida es real: un código 500 sin una causa interna ayuda poco a investigar un bug. En producción añadiríamos diagnóstico protegido, redacción, límites de tamaño, control de acceso y retención. «Registrar todo» no es una solución segura; «no registrar nunca causas» tampoco es una política de observabilidad completa.

El test del logger verifica otro límite: si el destino de logs falla después de completar la reserva, no intentamos responder otra vez ni repetirla. En la demo se descarta ese fallo. Un sistema real necesita detectar la pérdida de telemetría por un canal independiente.

## La forma del error también puede revelar información

Aunque no devuelvas un stack, diferenciar «usuario inexistente» de «contraseña incorrecta» puede permitir enumeración. Un error de permisos también podría revelar que existe un recurso de otro tenant. El catálogo debe revisarse según el modelo de amenazas de cada operación.

Nuestro inventario ficticio no tiene identidades ni tenants. El 404 de producto no resuelve esa política para una aplicación autenticada. No se puede trasladar el ejemplo a recursos privados sin diseñar antes quién puede conocer su existencia.

Los tests comprueban que una solicitud con valores, headers y nombres extra que contienen un secreto ficticio no lo refleja en cuerpo ni logs. Es una comprobación concreta contra regresiones, no una prueba de ausencia de todas las fugas posibles.

## Garantías y límites

El [ZIP compartido con validación](/assets/examples/api-validacion-errores-lab.zip) incluye el servidor y las pruebas. Usa **pnpm** para instalar las versiones fijadas:

```bash
pnpm install --frozen-lockfile
pnpm test
node server.mjs
```

El comando de reserva devuelve **200** porque ejecuta una operación sobre inventario; no crea un recurso de reserva que luego pueda consultarse. El README muestra cómo repetirla para observar conflicto de versión y falta de stock.

No hay durabilidad, autenticación, transacciones SQL, trazas distribuidas o idempotency keys. Reiniciar borra el estado. Si falla la serialización o validación de salida después de escribir, no se produce rollback. Un timeout o un 500 no garantizan «no ocurrió nada».

## Ejercicio: traducir un fallo conocido sin capturar cualquier excepción

Añade una dependencia ficticia que pueda devolver `timeout_before_execution`. Traduce solo esa condición conocida a un problema público documentado. Prueba también una excepción inesperada y exige que siga siendo 500, sin mensaje original. Después explica qué cambiaría si el timeout ocurriera después de iniciar una escritura cuyo resultado no conoces.

Continuamos con [paginación bajo escrituras concurrentes](/posts/paginacion-offset-keyset-postgresql-concurrencia). Mantendremos la misma exigencia: un resultado plausible no basta si el contrato promete algo distinto.

## Referencias

- [RFC 9457: Problem Details y consideraciones de seguridad](https://www.rfc-editor.org/rfc/rfc9457.html).
- [RFC 9110: semántica de status codes y precondiciones](https://httpwg.org/specs/rfc9110.html).
- [OWASP: Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [W3C Trace Context: contexto distribuido](https://www.w3.org/TR/trace-context/).

Fuentes consultadas el 18 de octubre de 2026. Los códigos y las URN publicados aquí son decisiones del laboratorio.
