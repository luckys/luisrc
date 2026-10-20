---
id: API-THREATS-SSRF
title: 'SSRF: elegir un recurso no debería permitir elegir cualquier destino de red'
published: 2026-10-18T04:26:00Z
locale: es
translationKey: ssrf-destinos-permitidos-redirecciones
slug: ssrf-destinos-permitidos-redirecciones
draft: true
status: draft
level: intermedio
prerequisites: [P030, API-THREATS-SQL]
description: 'Reproduce SSRF con servicios locales y compara URL arbitraria, referencias por tenant y redirects. Comprueba qué destino recibió la petición, no solo el status final.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, ssrf, multi-tenant, testing]
---

La API debía importar un recurso de un proveedor conocido. Sin embargo, el body aceptaba una URL completa y el servidor la consultaba sin limitar el destino. El usuario no solo estaba eligiendo qué importar: también estaba decidiendo a qué servicio debía conectarse el backend.

Ese cambio de responsabilidad permite **SSRF**, Server-Side Request Forgery. Una entrada induce al servidor a realizar una petición que no debería hacer. Puede aprovechar su acceso de red o sus credenciales, aunque la persona que envía la entrada esté correctamente autenticada.

Seguimos el escenario T05 del [threat model multi-tenant](/posts/threat-model-api-multi-tenant-pruebas). Después de [separar datos y sintaxis SQL](/posts/sql-injection-parametros-tenant-ordenacion), la frontera ahora es una conexión saliente. Dividiremos el tema en dos entregas: aquí, contrato y redirecciones; después, resolución DNS y socket.

## SSRF no necesita que la respuesta contenga datos secretos

Una petición no autorizada ya puede tener consecuencias aunque la API no devuelva su respuesta al cliente. Puede ejecutar una acción o consumir recursos en el destino. Cuando el contenido sí vuelve al usuario, también puede divulgar información.

Nuestro laboratorio utiliza un marcador de texto, no datos sensibles. Un proveedor ficticio representa la integración permitida. Otro servidor devuelve INTERNAL-MARKER y representa el destino que esa integración no debe consultar.

Los dos pertenecen al propio test y escuchan en loopback. La palabra «interno» describe su papel lógico: no hemos configurado una red privada que el runner no pueda alcanzar. Demostramos la decisión incorrecta del cliente HTTP, no un salto a una infraestructura cloud real.

La variante unsafe-url acepta la URL de ese segundo servidor. El test ve un 200 con el marcador y confirma que el destino recibió una petición. La autenticación de Alice no evitó el fallo: acreditaba quién pidió importar, no qué destinos estaban autorizados.

## Si conoces al proveedor, quizá no necesites aceptar una URL

El requisito permite importar recursos registrados para cada tenant. Podemos recibir una **referencia** y resolverla en un catálogo controlado por el servidor:

```json
{
  "reference": "a1"
}
```

North tiene a1; South, b1. El tenant proviene del contexto de identidad ya comprobado, no de una propiedad del body. El servidor elige scheme, host, puerto y ruta a partir de configuración y catálogo.

Este es el código real de `importer.mjs`. catalog y las funciones de error se definen antes en el mismo archivo:

```javascript
export function destinationForReference(tenantId, input, providerOrigin) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput()
  if (Object.keys(input).length !== 1 || typeof input.reference !== 'string')
    throw invalidInput()
  if (!/^[a-z0-9-]{1,32}$/.test(input.reference)) throw invalidInput()
  if (
    !Object.hasOwn(catalog, tenantId) ||
    !Object.hasOwn(catalog[tenantId], input.reference)
  )
    throw forbidden()
  return new URL(catalog[tenantId][input.reference], providerOrigin)
}
```

La expresión regular valida un identificador pequeño, no intenta interpretar URLs. La ruta que llega a new URL procede del catálogo, no se construye pegando una ruta arbitraria del cliente a un host permitido.

Enviar url junto a reference produce 422. Pedir b1 como North produce 403. En ambos casos el proveedor y el destino interno reciben cero peticiones. También probamos el camino válido de cada tenant: rechazar cualquier entrada no serviría como implementación de una importación.

En una aplicación real, el catálogo puede ser una tabla con permisos y estados. Aquí es una estructura fija para hacer visible la decisión. Que una referencia exista no debería otorgar por sí sola acceso a ella fuera del contexto autorizado.

## Parsear una URL es necesario si la admites, pero no suficiente

Hay productos que sí necesitan aceptar URLs. En ese caso no basta con buscar el nombre del proveedor dentro de un string: media.fixture.test.evil.test no es media.fixture.test.

La variante allowlist-only utiliza el parser URL de Node y compara el **origin** completo. En el fixture incluye HTTP y un puerto efímero; una configuración real de proveedor debería definir su origen HTTPS esperado.

```javascript
export function parseProviderUrl(value, providerOrigin) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw forbidden()
  }
  if (
    url.protocol !== new URL(providerOrigin).protocol ||
    url.origin !== providerOrigin ||
    url.username ||
    url.password ||
    url.hash
  )
    throw forbidden()
  return url
}
```

Se rechazan credenciales en la URL y fragmentos porque no forman parte del contrato. Los tests incluyen esquemas distintos, un host con sufijo engañoso, userinfo, una URL inválida y el destino interno directo.

La comparación de protocol es deliberada. Una URL como `blob:http://media.fixture.test:1234/recurso` puede tener origin `http://media.fixture.test:1234` y, aun así, protocol `blob:`. Lo establece la [especificación de origen de URL](https://url.spec.whatwg.org/#concept-url-origin). No debemos deducir de ese origin que el recurso usa HTTP.

El test con blob detectó que la primera versión del parser lo aceptaba y el transporte acababa devolviendo 500 por protocolo no soportado. Exigir el protocolo esperado lo rechaza con 403 antes del transporte. Ese caso no llegó a consultar un servidor externo, pero mostró que la validación no expresaba correctamente el contrato.

La comprobación no valida cualquier comportamiento de las rutas del proveedor. Tampoco determina por sí sola la IP que recibirá la conexión. Es un paso concreto, no un cliente SSRF-safe completo.

Conviene utilizar una representación coherente de la URL en validación y transporte. Pasar el string original entre parsers con reglas diferentes puede producir otra interpretación. En nuestro ejemplo mantenemos el objeto URL de Node, sin intentar arreglar discrepancias con sustituciones de texto.

## Una redirección plantea una nueva decisión de destino

El proveedor tiene una ruta /redirect que responde con 302 y un **Location** hacia el marcador interno. El origen de la primera URL es correcto. Si el cliente sigue Location automáticamente o sin repetir la política, la segunda petición cruza la frontera que queríamos cerrar.

La prueba allowlist-only observa una petición al proveedor y otra al destino interno. Devuelve 200 con INTERNAL-MARKER. Haber validado perfectamente el primer origin no autorizaba el segundo.

El cliente seguro rechaza las respuestas de redirección. La misma ruta existe en el catálogo como referencia de prueba, pero produce 502 y ninguna petición interna. No devuelve al usuario el cuerpo del destino prohibido.

Ese 502 expresa que el proveedor no cumplió el contrato de respuesta de esta importación. No es una obligación universal para todos los servicios ni un indicador de que el proveedor esté caído.

<img src="/assets/visuals/api-contracts/API-THREATS-SSRF.svg" alt="Dos recorridos de importación. La variante vulnerable valida el origen inicial pero sigue Location hacia un servicio interno ficticio. La segura construye una URL desde una referencia autorizada y rechaza la redirección sin hacer la segunda petición." width="387" height="1060" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-SSRF.svg).

No seguir redirects puede romper una integración que los use legítimamente. Si son un requisito, hay que autorizar cada salto, incluidos destinos relativos, limitar la cadena y conservar un presupuesto total de tiempo. En este laboratorio preferimos un contrato cerrado: una única respuesta 200 del recurso esperado.

## Las credenciales de entrada no pertenecen automáticamente a la salida

El cliente HTTP construye sus propias cabeceras y no copia Authorization ni Cookie de la petición de Alice. Los tests verifican su ausencia en el proveedor. Reenviar todas las cabeceras recibidas habría dado a una URL externa más capacidad que la necesaria para recuperar un recurso.

Si el proveedor requiere autenticación, necesita credenciales específicas y con permisos limitados. Su selección y su posible envío tras un redirect también deben formar parte del diseño. El fixture no usa secretos reales ni implementa esa integración.

## Observa el recorrido, no solo la respuesta final

El [visor interactivo de SSRF](/assets/interactive/api-ssrf/ssrf-explorer.html) permite avanzar por los eventos grabados: resolución de fixture, recepción en cada servidor y resultado HTTP. Compara «origen permitido, redirect seguido» con «referencia permitida, redirect rechazado».

Las barras cuentan peticiones recibidas hasta el paso visible. No miden latencia ni nivel de riesgo. El visor carga un JSON estático; las conexiones que generaron esos datos se ejecutaron en el laboratorio, no desde tu navegador al usar el control.

El script record-ssrf.mjs regenera la evidencia y comprueba los resultados esperados. Otra prueba vuelve a ejecutar los cinco escenarios y exige que coincidan sus eventos y contadores. Así podemos detectar una gráfica desincronizada del código que pretende explicar.

## Garantías y límites

Descarga el [laboratorio de amenazas](/assets/examples/api-amenazas-lab.zip). Con Node 24.19.0 o posterior y pnpm 12.8.1:

```bash
pnpm test
pnpm serve:ssrf
```

No requiere librerías de aplicación. El segundo comando inicia la API multi-tenant y dos destinos locales; Ctrl+C los cierra. Hay variantes deliberadamente vulnerables: no publiques el servidor ni abras un túnel.

Una guardia adicional del **harness**, la infraestructura de pruebas, impide que incluso esas variantes contacten con orígenes o direcciones ajenos a los fixtures. No es el control cuya vulnerabilidad estamos comparando ni un firewall instalado en el sistema.

La API usa identidades públicas de fixture, HTTP sin TLS y no guarda un documento importado: devuelve texto acotado. No se demuestra una política general para URLs públicas, proxies, IPv6 o infraestructura cloud. El cliente seguro también fija la IP aprobada; la [siguiente entrega explica esa parte](/posts/ssrf-dns-validacion-conexion-ip).

## Ejercicio: exigir una redirección legítima sin abrir cualquier salto

Añade un caso donde el proveedor redirige a otra ruta del mismo origen. Define primero si el contrato debe permitirlo. Si lo permites, comprueba también un cambio de origen, una cadena que exceda el máximo y un salto cuyo destino resuelva fuera de la política.

Exige que los casos denegados produzcan cero peticiones al destino no autorizado. Un error recibido después de contactarlo no demuestra que hayas protegido la salida.

## Referencias

- [OWASP: SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- [OWASP API7:2023: Server-Side Request Forgery](https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/).
- [Node.js: URL y sus componentes](https://nodejs.org/api/url.html).
- [WHATWG: cómo se calcula el origen de una URL](https://url.spec.whatwg.org/#concept-url-origin).
- [RFC 9110: respuestas de redirección](https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx).

Fuentes consultadas el 19 de octubre de 2026. Las observaciones pertenecen al sandbox ejecutado con Node 24.19.0.
