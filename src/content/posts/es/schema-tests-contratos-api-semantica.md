---
id: CONTRACT-SCHEMA
title: 'Schema tests de APIs: JSON válido no significa comportamiento compatible'
published: 2026-10-22T08:03:00Z
locale: es
translationKey: integration-schema-contract-semantics
slug: schema-tests-contratos-api-semantica
draft: true
status: draft
level: intermedio
prerequisites: [INT-ISOLATION, P025]
description: 'Contrasta JSON Schema, expectativas del cliente y significado monetario sobre HTTP y PostgreSQL reales, con cambios aditivos y rupturas controladas.'
author: 'Luis Ramírez Calle'
series: 'Integración y contratos: probar acuerdos con dependencias reales'
tags: [testing, api, json-schema, contracts]
---

Una respuesta cambia de `amountMinor: 1250` a `amountMinor: 12`. Sigue teniendo un entero positivo. Si el campo prometía céntimos de euro, sin embargo, ya no representa el mismo importe.

Un **schema test** puede comprobar que una respuesta respeta su estructura. Para comprobar una unidad monetaria o una expectativa concreta necesitamos observar algo más. Ampliaremos el artículo de [compatibilidad de APIs](/posts/evolucion-api-versiones-consumidores-contratos) con un proveedor conectado a PostgreSQL real y los [schemas aislados del laboratorio](/posts/aislamiento-tests-postgresql-rollback-schemas).

## Tres expectativas que conviene no mezclar

El documento describe qué forma se acepta. El cliente decide qué necesita interpretar. El escenario de negocio aporta el valor o la relación que debe conservarse.

En este ejercicio las tres expectativas son explícitas:

<div role="region" aria-label="Estructura, consumidor y semántica del contrato de pedidos" tabindex="0" style="overflow-x:auto">

| Comprobación | Pregunta | Ejemplo |
| --- | --- | --- |
| JSON Schema | ¿Están los campos y tipos acordados? | `amountMinor` es un entero positivo |
| Consumidor | ¿Puede seguir interpretando la respuesta? | El lector v1 encuentra `amountMinor` |
| Semántica del escenario | ¿Se conserva el significado esperado? | El pedido de 12,50 EUR sigue teniendo 1250 céntimos |

</div>

Una misma prueba puede observar varias de ellas. Separarlas conceptualmente ayuda a interpretar qué demuestra el fallo, en vez de llamar «contrato completo» a cualquier validación de JSON.

## El schema debe expresar decisiones, incluidas sus tolerancias

`schemas/order-v1.json` define los campos de la respuesta. El importe es un entero entre uno y el límite del `integer` SQL que utiliza el ejercicio; la moneda es EUR y los estados permitidos son `paid` y `pending`.

`required` hace obligatorios esos campos. `additionalProperties: true` permite campos nuevos, pero no elimina las restricciones de los ya definidos. Si aparece `label`, su valor debe seguir siendo un string.

La tolerancia a campos desconocidos es una decisión de esta respuesta, no una regla para cualquier entrada. Un endpoint que permita modificar recursos puede necesitar rechazar propiedades no previstas para evitar cambios no autorizados.

Compilamos el documento con **Ajv 8.20.0**, utilizando su implementación para **JSON Schema 2020-12**. No confiamos en una interfaz de TypeScript para validar bytes recibidos en runtime. Tampoco activamos coerción para convertir automáticamente strings en números.

El campo `createdAt` solo declara `type: string` en este schema. No afirmamos que valide un formato temporal completo. La factory del laboratorio tiene una comprobación ISO más estricta, pero esa validación no se transfiere por arte de magia al documento público.

## Un cambio SQL y un cambio HTTP son contratos distintos

El registro interno guarda `amount_minor` y `currency`. La respuesta v1 publica `amountMinor` y `currency`; v2 publica `money.minorUnits` y `money.currency`.

Durante el escenario se añade una columna SQL nullable llamada `label` y se escribe `Libro` en el pedido. Después se consulta mediante el repositorio y se comprueba que la respuesta aditiva incluye esa etiqueta sin perder el importe antiguo.

Que ese `ALTER TABLE` funcione en una tabla mínima no certifica una migración sin bloqueos sobre millones de filas. Aquí comprobamos convivencia de representaciones y lectura de datos reales, no una estrategia de rollout de base de datos a escala.

El repositorio lee la etiqueta mediante `to_jsonb(o)->>'label'`. Así obtiene `null` antes de añadir la columna y su contenido después, sin exigir que el schema antiguo ya tenga ese campo. Es una solución explícita del laboratorio para mantener la lectura durante ambos estados, no una recomendación de convertir cualquier consulta en JSON ni una técnica cuyo coste hayamos medido.

`represent`, en `src/representation.ts`, contiene los formatos del ejercicio:

```typescript
export function represent(order: Order, mode: Mode = 'baseline'): Record<string, unknown> {
  const common = { id: order.id, status: order.status, createdAt: order.createdAt }
  if (mode === 'v2' || mode === 'renamed')
    return { ...common, money: { minorUnits: order.amountMinor, currency: order.currency } }
  return {
    ...common, amountMinor: mode === 'unit-drift' ? Math.floor(order.amountMinor / 100) : order.amountMinor,
    currency: order.currency, ...(mode === 'additive' ? { label: order.label ?? 'Pedido de laboratorio' } : {}),
  }
}
```

`renamed` y `unit-drift` son variantes incorrectas que solo el test selecciona al construir su servidor. No hay un parámetro público para activarlas. Su finalidad es comprobar que las expectativas distinguen implementaciones incompatibles de las válidas.

<img src="/assets/visuals/integration-contracts/CONTRACT-SCHEMA.svg" alt="PostgreSQL conserva el importe; la API produce una representación que pasa por validación estructural, lectura del consumidor y una aserción independiente sobre los 1250 céntimos esperados." width="349" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/integration-contracts/CONTRACT-SCHEMA.svg).

## Añadir label conserva el lector; retirar amountMinor lo rompe

El mismo lector v1 se ejecuta primero contra la respuesta baseline y después contra la aditiva. En ambas interpreta `1250`. El lector v2 consulta su ruta y obtiene también `1250`, aunque la estructura sea distinta.

Después servimos deliberadamente la estructura v2 en la ruta donde se espera v1. El HTTP sigue devolviendo `200`; desaparece `amountMinor` y aparece `money`. El schema v1 rechaza la respuesta porque falta un campo requerido. El lector antiguo también la rechaza.

Este fragmento de `tests/postgres.test.mjs` pertenece a ese caso negativo:

```javascript
await withApi(fixture.repository, 'renamed', async (origin) => {
  const response = await fetch(origin + '/orders/o-1')
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(validate(body), false)
  assert.throws(() => readOrder(body), /consumer_contract/)
})
```

El test exige el rechazo, no un error de transporte. Cambiar el cliente para devolver cero cuando falta el importe silenciaría precisamente el acuerdo que queremos proteger.

## Un entero correcto por tipo puede ser incorrecto por valor

La variante `unit-drift` divide el importe por cien y lo redondea hacia abajo. Con el pedido del escenario devuelve `12`, no `1250`.

Este extracto del mismo archivo comprueba el límite del schema:

```javascript
const body = await (await fetch(origin + '/orders/o-1')).json()
assert.equal(validate(body), true)
const receipt = readOrder(body)
assert.equal(receipt.amountMinor, 12)
assert.throws(() => assert.equal(receipt.amountMinor, 1250), { code: 'ERR_ASSERTION' })
```

La última línea exige que la aserción semántica falle: es un contraejemplo controlado, no una suite que oculte errores inesperados. El valor esperado `1250` está escrito de forma independiente de la representación incorrecta.

También verificaremos que el matcher `integer` de Pact acepta esa respuesta. No es un fallo del matcher: no le hemos pedido preservar ese importe concreto. Un matcher con igualdad exacta podría detectar el cambio en ese ejemplo, pero tampoco demostraría todas las reglas monetarias del sistema.

## El schema y el consumidor no deberían actualizarse a ciegas juntos

Si cambias el proveedor, el schema y todos los lectores en el mismo paso, puedes eliminar la expectativa antigua de la suite. Para demostrar compatibilidad debemos conservar al menos el lector o contrato que todavía necesita un consumidor existente.

Eso no significa mantener cualquier versión eternamente. La retirada requiere saber qué consumidores siguen activos y cómo se distribuyen sus versiones. Aquí solo hay un consumidor de laboratorio, no una población de aplicaciones instalada.

Un diff de documentos puede ayudar a revisar cambios, pero no sustituye ejecutar las expectativas relevantes. Tampoco generamos automáticamente la implementación a partir del schema: comprobamos su acuerdo sobre respuestas producidas por el servidor real.

## Código completo y pruebas

Consulta [los archivos del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/contract-schema/README.md), el [schema de respuesta](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/integration-contracts/schemas/order-v1.json) y la suite PostgreSQL.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/integration-contracts test:integration
```

El escenario conserva 1250 en baseline, respuesta aditiva y v2. La variante renombrada devuelve 200 pero falla el schema. La variante monetaria incorrecta pasa el schema y falla la aserción de valor. Los resultados quedan en `evidence/verification.json`, junto con hashes de las fuentes ejecutadas.

## Garantías y límites

Schema de respuesta concreto, no metavalidación completa de un documento OpenAPI ni análisis automático de todos los breaking changes. SQL y HTTP locales, tablas pequeñas y consumidores dentro del mismo monorepo. Sin migración online bajo carga o compatibilidad certificada para clientes desconocidos.

## Ejercicio: decidir qué debería detectar cada cambio

Añade `refunded` al proveedor sin modificar el lector antiguo ni el schema v1. Identifica qué expectativas fallan. Después permite el estado en el schema, pero conserva el lector: explica por qué actualizar el documento no ha actualizado al consumidor. Decide una política explícita de estado desconocido antes de cambiarlo.

Continuamos con [Pact y la verificación del proveedor a partir del contrato del consumidor](/posts/consumer-driven-contracts-pact-provider-states).

## Referencias

- [Ajv: JSON Schema y versiones soportadas](https://ajv.js.org/json-schema.html).
- [JSON Schema: validación de objetos](https://json-schema.org/understanding-json-schema/reference/object).
- [Google AIP-180: compatibilidad de APIs](https://google.aip.dev/180).

Fuentes consultadas para esta serie el 22 de octubre de 2026. Las variantes de fallo pertenecen exclusivamente al laboratorio.
