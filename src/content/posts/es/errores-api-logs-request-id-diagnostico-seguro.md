---
id: API-ERROR-LOGGING
title: 'Diagnosticar errores de API sin filtrar datos: logs y request IDs'
published: 2026-10-18T04:06:00Z
locale: es
translationKey: errores-api-logs-request-id-diagnostico-seguro
slug: errores-api-logs-request-id-diagnostico-seguro
draft: true
status: draft
level: intermedio
prerequisites: [P023]
description: 'Relaciona respuestas y registros sin copiar cuerpos, tokens o excepciones privadas. Request IDs, allowlist de logs y pruebas de fugas.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, logging, seguridad, observabilidad, testing]
---

Una respuesta devuelve un 500 seguro, pero soporte no sabe qué solicitud investigar. La reacción habitual es añadir el body y la excepción al log. Eso puede resolver una búsqueda y crear otra incidencia si el registro contiene un token, una contraseña o datos personales.

Después de diseñar [Problem Details y códigos públicos](/posts/errores-api-problem-details-stock-concurrencia), necesitamos otro contrato: qué registra el servidor, cómo relaciona una ocurrencia con su respuesta y quién debería poder acceder al diagnóstico.

## Request ID permite buscar una ocurrencia; no es una traza distribuida

Cada solicitud recibe un UUID generado en el servidor, enviado en `X-Request-Id` y en el problema. `instance` utiliza ese UUID para identificar la ocurrencia. Incluso si el cliente envía su propio `X-Request-Id`, el laboratorio no lo adopta como identificador confiable.

Ese ID permite relacionar respuesta y registro local. No demuestra propagación entre servicios, spans ni contexto de **distributed tracing**. Para eso se necesitaría instrumentación y una política de tratamiento del contexto recibido.

<img src="/assets/visuals/api-contracts/API-ERROR-LOGGING.svg" alt="El servidor genera un request ID que aparece en respuesta y log. El log usa una allowlist y excluye body, Authorization, query y mensaje de excepción." width="289" height="1045" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-ERROR-LOGGING.svg).

## Una allowlist explica qué puede entrar al registro

El logger recibe este objeto de `server.mjs`, comprobado con peticiones HTTP reales:

```javascript
logger({
  requestId,
  method: request.method === 'POST' ? 'POST' : 'other',
  route,
  status,
  code: status === 200 ? 'ok' : body.code,
})
```

Construimos el objeto campo por campo. No copiamos `request.headers`, el body ni una excepción a la que después intentamos quitar algunas propiedades conocidas. Una allowlist reduce el conjunto de datos que debemos revisar cada vez que cambia una entrada.

`route` es una plantilla controlada: `/reservations` o `unmatched`. No es la URL original. Una petición a una ruta inventada con una query que contenga información sensible no debería conservarla por el hecho de que un router no la reconoció.

El método también se normaliza. Esta demo solo ejecuta POST y registra otras solicitudes como `other`. Un servicio con más operaciones podría mantener una lista más amplia, pero no necesita guardar texto arbitrario para saber qué operación atendió.

El status resume la respuesta y el código identifica la condición documentada. Es suficiente para agrupar fallos de validación o de versión sin analizar mensajes traducidos. No basta para localizar cualquier bug: esa limitación exige diseñar diagnóstico protegido, no devolver al consumidor el mensaje original.

## Correlacionar respuesta y log tiene una prueba concreta

El servidor crea su propio UUID y lo envía en `X-Request-Id`. Cuando hay un problema, incluye el mismo valor en `requestId` e identifica la ocurrencia mediante `instance`. El test exige que el ID de la respuesta coincida con el del registro de esa solicitud.

También envía un `X-Request-Id` elegido por el cliente y comprueba que no se adopta sin validación. Si cualquier cliente pudiera fijar un valor que parece el de otra solicitud, soporte podría relacionar registros equivocados. Un proxy confiable puede tener otra política, pero debe existir una frontera de confianza explícita.

No hemos implementado Trace Context, spans o propagación entre servicios. Un ID local permite seguir una solicitud dentro de este proceso. Una traza distribuida necesita una política de contexto, instrumentación y controles adicionales; no aparece por llamar traceId a ese UUID.

## La forma del error también puede revelar información

Aunque no devuelvas un stack, diferenciar «usuario inexistente» de «contraseña incorrecta» puede permitir enumeración. Un error de permisos también podría revelar que existe un recurso de otro tenant. El catálogo debe revisarse según el modelo de amenazas de cada operación.

Nuestro inventario ficticio no tiene identidades ni tenants. El 404 de producto no resuelve esa política para una aplicación autenticada. No se puede trasladar el ejemplo a recursos privados sin diseñar antes quién puede conocer su existencia.

Los tests comprueban que una solicitud con valores, headers y nombres extra que contienen un secreto ficticio no lo refleja en cuerpo ni logs. Es una comprobación concreta contra regresiones, no una prueba de ausencia de todas las fugas posibles.

## Probar que un secreto ficticio no aparece es más útil que revisar solo el happy path

La prueba de fugas introduce una cadena reconocible en varios lugares: un valor de campo, un nombre extra, Authorization, un ID de cliente y una URL desconocida. Después inspecciona tanto el cuerpo público como el registro capturado.

Otro test inyecta una excepción cuyo mensaje contiene SQL y un secreto ficticio. La respuesta se traduce a 500 con un texto fijado. El log no conserva ese mensaje. Esto detecta regresiones como cambiar el código a `logger(error)` o empezar a copiar headers por comodidad.

La expectativa no es que toda información de diagnóstico desaparezca en producción. Podemos necesitar clases de fallo o causas redactadas en un destino protegido. Hay que decidir el acceso, tamaño, retención y tratamiento de datos de ese destino, y probar la redacción con los formatos reales. No lo hemos construido aquí.

## Un fallo del logger no debe volver a ejecutar el negocio

El logger se llama después de preparar y enviar la respuesta. Si lanza una excepción, el adaptador no intenta responder otra vez ni repetir la reserva. El test inyecta ese fallo y exige que el éxito de negocio siga produciendo una única respuesta 200.

La demo descarta el fallo de telemetría porque no tiene otro sink. En un servicio real convendría detectar pérdida de logs mediante otro canal, por ejemplo una métrica supervisada. Escribir de nuevo al mismo logger roto no proporciona una garantía de diagnóstico.

La ubicación del log tampoco demuestra durabilidad. Si el proceso termina antes de registrar, puede faltar una ocurrencia. Una auditoría obligatoria necesita un diseño persistente y garantías propias, no reutilizar sin más este logger informativo.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-error-logging/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-validation-errors
```

## Garantías y límites

El [laboratorio de validación y errores](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-validation-errors/server.mjs) contiene `server.mjs` y `tests/http.test.mjs`.

```bash
pnpm install --frozen-lockfile
node --test tests/http.test.mjs
```

Las peticiones utilizan loopback y secretos ficticios; los tests capturan registros en memoria. No demuestran ausencia de cualquier fuga o acceso indebido a un sistema de logs desplegado. Tampoco implementan trazas distribuidas, retención, redacción general, autenticación o auditoría duradera.

El servidor temporal debe permanecer local. Los mismos límites de stock en un único proceso del artículo anterior siguen vigentes; registrar un resultado no mejora su garantía de concurrencia.

## Ejercicio: ampliar diagnóstico sin registrar credenciales

Propón un campo de diagnóstico que permita distinguir dos clases de fallo interno sin publicar mensajes privados. Antes de añadirlo al logger, escribe casos con un secreto en el mensaje de excepción y exige que siga ausente. Documenta quién podría leer el destino de diagnóstico y cuánto tiempo conservaría los datos.

Continuamos con [paginación y orden estable](/posts/paginacion-offset-keyset-postgresql-concurrencia).

## Referencias

- [OWASP: Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [W3C Trace Context](https://www.w3.org/TR/trace-context/).
- [RFC 9457: seguridad de los problemas públicos](https://www.rfc-editor.org/rfc/rfc9457.html).

Fuentes consultadas el 18 de octubre de 2026.
