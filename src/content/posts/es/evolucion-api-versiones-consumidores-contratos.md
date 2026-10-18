---
id: P025
title: 'Evolucionar una API: probar qué clientes siguen funcionando antes de crear v2'
published: 2026-10-18T04:05:00Z
locale: es
translationKey: api-evolution-consumers-contract-tests
slug: evolucion-api-versiones-consumidores-contratos
draft: true
status: draft
level: intermedio
prerequisites: [P020, P021, P022]
description: 'Prueba cambios aditivos y breaking con dos clientes HTTP. OpenAPI, versiones URL y headers, SemVer de SDK y una deprecación con guía de migración.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, contratos, versionado, openapi, testing, compatibilidad]
---

El backend cambia `amountMinor` por un objeto `money`. Los tests del servidor pasan y el JSON sigue siendo válido. Una aplicación móvil antigua intenta leer el campo anterior y deja de mostrar el importe: el despliegue técnico terminó, pero la migración del contrato no.

Evolucionar una API requiere conocer qué observan sus consumidores y permitir que se actualicen en momentos distintos. Crear `/v2` puede ser parte de la solución, pero no sustituye las pruebas ni una transición que alguien pueda completar.

Usaremos las páginas de pedidos de la [entrega de paginación](/posts/paginacion-offset-keyset-postgresql-concurrencia). El mismo laboratorio ejecuta dos pequeños clientes con expectativas diferentes, sin depender de una plataforma externa de contract testing.

## La compatibilidad depende de la dirección del cambio

Un **cambio aditivo** añade algo. Un **breaking change** rompe una expectativa que antes podía cumplir un consumidor. Esas categorías no se deducen únicamente de contar campos añadidos o borrados.

En una respuesta, añadir `label` puede ser compatible con un cliente que selecciona los campos que necesita e ignora desconocidos. Otro que valida con `additionalProperties: false` puede rechazarla. Ambos comportamientos existen; la API tiene que decidir y documentar qué se espera de los consumidores.

En una entrada, hacer obligatorio un campo opcional rompe a clientes que no lo envían. Permitir omitir uno que antes era obligatorio puede ampliar lo aceptado por un servidor nuevo, pero un cliente que empiece a omitirlo fallará contra un servidor antiguo. Importa qué versiones conviven durante el despliegue.

Una nueva opción de un **enum** también merece atención. El cliente antiguo puede tener un `switch` exhaustivo y no saber presentar el nuevo estado. Decir «solo hemos añadido un valor» no resuelve qué hará esa aplicación.

Y hay cambios que no alteran el tipo: si `amountMinor: 1250` deja de representar céntimos y pasa a representar euros, el esquema de un entero positivo puede seguir cumpliéndose. El comportamiento y las unidades forman parte del contrato, como vimos al [diseñar la primera representación](/posts/api-contrato-esquema-clientes).

## Separar la representación permite convivir sin duplicar el negocio

Nuestro registro interno conserva `amount_minor` y `currency`. La representación **v1** publica `amountMinor` y `currency`. La **v2** publica `money.minorUnits` y `money.currency`. En ambos casos 1250 EUR significa 12,50 euros: no cambiamos la unidad.

Para el primer cambio, añadir una etiqueta, no necesitamos v2. Para retirar los campos anteriores y cambiar su estructura, sí elegimos una representación nueva. Es una decisión del laboratorio, no una regla de que cada refactor interno necesite otra versión pública.

Archivo `representations.mjs`, función completa:

```javascript
export function formatOrder(row, version, change = 'additive') {
  const common = {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    status: row.status,
  }
  if (version === 'v2' || change === 'breaking')
    return { ...common, money: { minorUnits: row.amount_minor, currency: row.currency } }
  return {
    ...common,
    amountMinor: row.amount_minor,
    currency: row.currency,
    ...(change === 'additive' ? { label: row.description } : {}),
  }
}
```

`baseline` representa v1 antes del campo nuevo; `additive` añade la etiqueta. `breaking` es un modo de fallo utilizado únicamente en tests: sirve el formato nuevo donde un cliente espera el antiguo. No es un parámetro público que pueda activar quien consulta la API.

La consulta a PostgreSQL es compartida. Cambia el adaptador de representación, no el significado del stock ni la unidad monetaria. Si el negocio de ambas versiones divergiera, habría que diseñar esa diferencia expresamente; una función de formato no resolvería cualquier migración.

<img src="/assets/visuals/api-contracts/P025.svg" alt="Una consulta de pedidos alimenta dos adaptadores: v1 mantiene los campos antiguos y v2 usa money. Cada cliente tiene su test, mientras OpenAPI documenta ambas representaciones durante la migración." width="433" height="822" loading="lazy" style="width:100%;height:auto" />

[Ampliar la convivencia de representaciones](/assets/visuals/api-contracts/P025.svg).

## Un contract test debe comprobar lo que el consumidor utiliza

El cliente antiguo comprueba ID, fecha, estados conocidos e importe entero positivo en EUR. Ignora `label`, porque no lo necesita. El nuevo busca el importe dentro de `money`. Son dos funciones pequeñas dentro del mismo repositorio, no dos SDK publicados ni una muestra de todos los consumidores posibles.

Archivo `clients.mjs`, lector v1:

```javascript
export function readV1(value) {
  if (
    !page(value) ||
    !value.items.every(
      (item) =>
        common(item) &&
        Number.isSafeInteger(item.amountMinor) &&
        item.amountMinor > 0 &&
        item.currency === 'EUR',
    )
  )
    throw new Error('contract_v1')
  return value.items.map((item) => item.amountMinor)
}
```

Los helpers `page` y `common` están en el mismo archivo descargable. Esta es una validación de lo que consume la función, no un validador general de toda respuesta HTTP. Por ejemplo, comprueba que la fecha es un string; no certifica todos los formatos temporales.

Los tests arrancan un servidor real de Node y realizan peticiones HTTP. Ejecutan el cliente v1 contra el proveedor baseline y contra el aditivo: ambos devuelven el importe esperado. Ejecutan también el cliente v2 en su ruta correspondiente. En la parte PostgreSQL se repite la lectura de páginas obtenidas de la base real.

Después sirven deliberadamente el formato breaking en `/v1/orders`. La respuesta tiene **200 y JSON válido**, pero el consumidor v1 la rechaza. El test exige ese rechazo: no queremos un test que se ponga verde al adaptar silenciosamente el cliente al cambio accidental.

Otro caso introduce `refunded` sin actualizar el cliente que solo conoce `paid` y `pending`. También falla. Si queremos estados nuevos compatibles, necesitamos una política de estado desconocido desde el diseño, no una afirmación de que el enum creció y por tanto no rompe nada.

## OpenAPI y pruebas de consumidor detectan fallos diferentes

El archivo **OpenAPI 3.1.1** describe `/v1/orders` y `/v2/orders`, parámetros, respuestas y schemas. v1 mantiene sus campos obligatorios; `label` es opcional. Los schemas de respuesta permiten propiedades adicionales para reflejar la tolerancia que hemos diseñado.

Extraemos los schemas y los validamos con **Ajv 8.20.0** sobre respuestas HTTP. También comprobamos las referencias internas y que los identificadores de operación sean distintos. No pasamos el documento OpenAPI entero a un validador JSON Schema: son objetos con cometidos diferentes.

Eso no equivale a una metavalidación completa de OpenAPI ni a un análisis automático de todos los cambios incompatibles. Un diff de schemas puede señalar riesgos; las expectativas ejecutables de consumidores concretos aportan otra evidencia.

El test monetario muestra por qué hacen falta ambas. Cambia una respuesta de `amountMinor: 1250` a `amountMinor: 12`. El schema sigue aceptando un entero positivo. Una aserción sobre el importe esperado detecta el cambio de significado. No inferimos semántica de negocio a partir del tipo.

En un sistema con repositorios separados, los contratos de consumidor podrían publicarse y verificarse en la integración del proveedor. Harían falta ownership, versiones de contrato y una política para consumidores que no se actualizan. El laboratorio no implementa un broker, Pact ni una matriz de despliegues reales.

## Versionar en URL o en headers cambia cómo se opera la transición

Elegimos **versiones en URL**: `/v1/orders` y `/v2/orders`. Resultan visibles en ejemplos, logs y pruebas. También hacen explícito qué representación solicita cada cliente. La contrapartida es mantener rutas y documentación durante la convivencia.

Otra opción utiliza negociación mediante **Accept** y media types versionados. Mantiene una URI para el recurso, pero el routing, los caches y las herramientas deben distinguir representaciones. Cuando la respuesta depende de Accept, la política de `Vary` y cache keys necesita reflejarlo.

Una cabecera propia también requiere acordar valores, errores y comportamiento por defecto. Añadir un header de versión no vuelve automáticamente más compatible el servicio ni elimina la necesidad de mantener la versión anterior.

La demo implementa solo la variante de URL. No simulamos negociación para luego presentarla como una función probada. Tampoco creamos v2 por añadir `label`: la versión nueva sirve para retirar y reorganizar una estructura que un consumidor antiguo sí necesita.

## SemVer del SDK no sustituye la versión del protocolo HTTP

**Semantic Versioning** permite comunicar cambios de una API pública de software mediante MAJOR.MINOR.PATCH. Para un SDK estable, añadir una capacidad compatible suele corresponder a MINOR; cambiar una firma de forma incompatible requiere MAJOR; corregir un bug de manera compatible corresponde a PATCH.

El paquete del SDK, la representación HTTP y `info.version` de OpenAPI son ejes distintos. Un SDK 2.0.0 podría seguir consultando `/v1` si cambió su propia interfaz. Un SDK 1.4.0 podría añadir soporte optativo para `/v2` sin romper las llamadas anteriores. Esos números son ejemplos de política, no releases que hayamos publicado.

No basta con subir el major del SDK si una aplicación antigua sigue llamando a una ruta que acabamos de romper. El servidor debe respetar los contratos que aún mantiene, con independencia de que exista una librería nueva para quienes puedan actualizarla.

## Deprecar comunica una transición; no ejecuta la migración

Las respuestas v1 del laboratorio incluyen **Deprecation**, **Sunset** y un **Link** a `/migration/v2`, una guía local que sí sirve el servidor. OpenAPI también marca la operación antigua como deprecated.

Deprecation utiliza el formato de fecha estructurada de **RFC 9745**, con `@` seguido de segundos desde epoch. No usamos un booleano inventado ni copiamos el formato HTTP-date de Sunset. **RFC 8594** define Sunset para anunciar cuándo se prevé que el recurso deje de responder como hasta entonces.

Las fechas son ficticias y explícitas: deprecación desde el 18 de octubre de 2026 y retirada propuesta para el 18 de abril de 2027. La demo no apaga v1 al llegar esa fecha. No existe un servicio público al que estemos imponiendo una retirada.

La guía explica qué campos cambian, que la unidad monetaria se conserva y qué debe hacer el consumidor con la URL. También indica que los cursores están ligados a la versión: migrar exige iniciar otro recorrido. Pretender reutilizar cualquier token v1 en v2 sería una promesa adicional que no implementamos.

## Retirar una versión necesita evidencia, no solo un calendario

Una transición práctica empieza identificando consumidores y responsables. Después se publica la alternativa, se mantienen ambas representaciones, se ofrecen ejemplos de migración y se observa qué clientes siguen utilizando la anterior. La fecha se comunica con suficiente margen y una política conocida.

Antes de retirar, necesitamos criterios: ¿quedan clientes críticos?, ¿hay una aplicación que no puede actualizarse?, ¿se ha probado el nuevo contrato con ellos?, ¿qué respuesta documentada recibirán tras la retirada? Si no podemos identificar el uso antiguo, no podemos afirmar que todos migraron.

El laboratorio no tiene usuarios ni telemetría de adopción, así que no declara ese paso completado. Sí aporta una guía, headers y pruebas de convivencia que podemos ejecutar antes de plantear la retirada. Ninguna cabecera demuestra por sí sola que un consumidor la leyó o adaptó su código.

Mantener indefinidamente dos versiones también cuesta: correcciones duplicadas, revisión de seguridad y más combinaciones de tests. Evitar una ruptura no significa prometer soporte eterno. Significa hacer explícito qué contrato se mantiene y cómo termina esa obligación.

## Garantías y límites

El [laboratorio compartido con paginación](/assets/examples/api-paginacion-evolucion-lab.zip) incluye las dos representaciones, dos lectores, OpenAPI y contract tests:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lab
```

Las pruebas sin Docker usan una fuente de filas controlada. `pnpm lab` crea PostgreSQL efímero, ejecuta también los consumidores contra datos reales y elimina su contenedor al finalizar. Los requisitos y límites de recursos están en el README; no se descarga una imagen implícitamente.

No hay SDK publicado, consumidores externos, negociación Accept, autenticación o retirada automática. Los dos clientes son ejemplos representativos y limitados. No demostramos compatibilidad con todos los clientes que alguien pudiera escribir ni con todos los cambios de comportamiento posibles.

## Ejercicio: un cambio que supera el schema y rompe el producto

Mantén `amountMinor` como entero, pero cambia su unidad en una rama de prueba. Comprueba que la validación estructural pasa y que una aserción sobre 12,50 euros falla. Diseña después una transición que conserve el significado para v1 y haga inequívoca la representación nueva. No soluciones el test sustituyendo el valor esperado sin justificar qué cliente debía cambiar.

La siguiente entrega se centrará en sesiones y tokens. Mantendremos la misma separación entre una representación bien formada y una garantía de seguridad realmente comprobada.

## Referencias

- [Google AIP-180: compatibilidad hacia atrás](https://google.aip.dev/180).
- [OpenAPI 3.1.1: contratos y operaciones deprecated](https://spec.openapis.org/oas/v3.1.1.html).
- [Semantic Versioning 2.0.0](https://semver.org/).
- [RFC 9745: Deprecation HTTP Response Header](https://www.rfc-editor.org/rfc/rfc9745.html).
- [RFC 8594: Sunset HTTP Response Header](https://www.rfc-editor.org/rfc/rfc8594.html).
- [RFC 9110: negociación y Vary](https://httpwg.org/specs/rfc9110.html).

Fuentes consultadas el 18 de octubre de 2026. Versiones y fechas de migración son decisiones ficticias del laboratorio.
