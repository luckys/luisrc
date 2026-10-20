---
id: P025
title: 'Compatibilidad de APIs: detectar breaking changes con contract tests'
published: 2026-10-18T04:10:00Z
locale: es
translationKey: api-evolution-consumers-contract-tests
slug: evolucion-api-versiones-consumidores-contratos
draft: true
status: draft
level: intermedio
prerequisites: [P020, P021, P022]
description: 'Prueba cambios aditivos y breaking con consumidores v1 y v2, schemas OpenAPI y aserciones de significado sobre respuestas HTTP.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, contratos, openapi, testing, compatibilidad]
---

El backend reorganiza un importe y todos sus tests pasan. Una aplicación antigua sigue leyendo el campo anterior. El JSON continúa siendo válido, pero el consumidor ya no puede cumplir su función.

Antes de decidir si necesitamos otra versión, conviene demostrar **qué expectativa se rompe**. Vamos a usar dos pequeños lectores de pedidos y comprobarlos contra respuestas HTTP. La transición, los headers y la retirada de v1 quedan en [la siguiente entrega](/posts/versionado-api-deprecacion-migracion-consumidores).

Partimos del [contrato de API](/posts/api-contrato-esquema-clientes). Las páginas usan el [laboratorio de paginación](/posts/paginacion-offset-keyset-postgresql-concurrencia), pero su rendimiento no decide si un campo sigue siendo compatible.

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

## El escenario que debería fallar también forma parte del contrato

La variante baseline conserva los campos antiguos; la aditiva incorpora label. La prueba ejecuta el mismo lector v1 contra ambas y espera el mismo importe. Esa es una observación concreta de compatibilidad, no una regla de que cualquier propiedad nueva deba ser inocua.

El caso breaking hace lo contrario: mantiene una ruta y un status que parecen correctos, pero retira el campo utilizado por el lector. El test exige que el lector rechace esa respuesta. Si alguien lo hiciera tolerante devolviendo cero por defecto, el test dejaría de comprobar el acuerdo original.

No hace falta interpretar textos de error del servidor para detectar ese fallo. El problema es que una respuesta de éxito ya no ofrece el dato acordado. Por eso conviene conservar las expectativas del consumidor separadas de las funciones que producen la representación.

La comparación con PostgreSQL añade otra comprobación: ambos lectores funcionan con páginas consultadas a una base real. No sustituye el escenario pequeño controlado, que permite introducir una regresión deliberada y atribuir el fallo a un cambio concreto.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p025/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-pagination-evolution
```

## Garantías y límites

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-pagination-evolution/clients.mjs) contiene `clients.mjs`, `representations.mjs`, `openapi.json` y los tests. El código no se genera automáticamente a partir del documento.

```bash
pnpm install --frozen-lockfile
node --test tests/unit.test.mjs tests/http.test.mjs tests/contract.test.mjs
```

Esas pruebas arrancan HTTP con una fuente de filas controlada. `pnpm lab` ejecuta además los consumidores contra PostgreSQL efímero y un millón de filas; sus requisitos están en el README.

Los lectores viven en el mismo repositorio. No son SDK publicados, consumidores externos ni una matriz de despliegues. Tampoco prueban todas las expectativas posibles, formatos de fecha o cambios de comportamiento. Los schemas no detectan por sí solos cualquier cambio semántico.

## Ejercicio: conservar el test del consumidor antiguo

Añade un campo opcional y verifica primero que el lector antiguo siga devolviendo el mismo resultado. Después retira amountMinor sin modificar ese lector y exige que el test falle. Diseña cómo convivirán ambas representaciones sin cambiar el significado monetario para quien aún usa v1.

Continúa con [versionado, deprecación y migración](/posts/versionado-api-deprecacion-migracion-consumidores). Allí distinguimos tener un formato nuevo de haber migrado realmente a sus consumidores.

## Referencias

- [Google AIP-180: compatibilidad hacia atrás](https://google.aip.dev/180).
- [OpenAPI 3.1.1: contratos y schemas](https://spec.openapis.org/oas/v3.1.1.html).
- [Ajv: validación JSON Schema](https://ajv.js.org/json-schema.html).

Fuentes consultadas el 18 de octubre de 2026.
