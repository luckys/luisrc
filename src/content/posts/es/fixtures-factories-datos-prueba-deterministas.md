---
id: INT-FIXTURES
title: 'Fixtures y factories: datos de prueba que explican el escenario'
published: 2026-10-22T08:01:00Z
locale: es
translationKey: integration-fixtures-factories-determinism
slug: fixtures-factories-datos-prueba-deterministas
draft: true
status: draft
level: intermedio
prerequisites: [P056]
description: 'Prepara datos válidos sin esconder las condiciones decisivas del test. Separa factories de fixtures y controla identidad, tiempo y aislamiento.'
author: 'Luis Ramírez Calle'
series: 'Integración y contratos: probar acuerdos con dependencias reales'
tags: [testing, fixtures, factories, typescript]
---

El test dice que comprueba un pedido antiguo, pero su factory calcula `createdAt` con la hora actual. Alguien cambia un default y el escenario deja de ser antiguo sin que cambie una sola línea del test. La preparación ha ocultado precisamente la condición que queríamos verificar.

Una **factory** debería reducir ruido, no decidir a escondidas de qué trata la prueba. Partimos del [laboratorio con Testcontainers](/posts/testcontainers-postgresql-integracion-ciclo-vida), pero aquí la mayor parte del trabajo se puede comprobar sin levantar una base de datos.

## Fixture es el contexto; factory es cómo construimos un dato

Llamamos **fixture** al contexto preparado para ejecutar un escenario. Puede incluir registros, conexiones, un servidor y la función que los libera. Una **factory** construye objetos de prueba; puede formar parte de esa preparación.

Los nombres se utilizan de formas distintas entre frameworks. En este laboratorio `orderFixture` es, pese a su nombre, una factory de un dato inmutable. `database.schema()` prepara recursos y ofrece su cleanup. No necesitamos discutir cuál de los dos merece la palabra «fixture» si dejamos clara su responsabilidad.

Una factory de objetos tampoco es automáticamente un **fake**. No sustituye al repositorio ni simula consultas: devuelve un pedido. Los [test doubles](/posts/test-doubles-stubs-spies-fakes-contratos) cumplen otro papel.

## Defaults válidos y overrides visibles

`orderFixture`, en `src/fixtures.ts`, devuelve por defecto el pedido `o-1`, importe `1250`, moneda `EUR`, estado `paid` y una fecha ISO fija. El objeto se congela y no comparte un contador global con otras pruebas.

El primer test de `tests/core.test.mjs` empieza así:

```javascript
const first = orderFixture()
const second = orderFixture({ id: 'o-2', amountMinor: 9900 })
assert.deepEqual(first, orderFixture())
assert.equal(first.id, 'o-1')
assert.equal(first.amountMinor, 1250)
assert.equal(second.amountMinor, 9900)
assert.ok(Object.isFrozen(first))
```

El segundo pedido muestra explícitamente qué cambia. No tenemos que leer una factory de cien líneas para descubrir que estamos comparando dos importes diferentes.

Mantener `o-1` estable es útil para un escenario pequeño, pero tiene una consecuencia: dos llamadas sin override producen el mismo ID. Si quieres insertar dos pedidos en el mismo schema, debes darles identidades distintas. No podemos exigir unicidad y ocultar un contador que dependa del orden de los tests para satisfacerla.

La factory comprueba los campos principales que necesita el ejercicio. Rechaza un importe cero, un tipo incorrecto o un estado desconocido. No sustituye al parser público de una API ni a todas las constraints del motor. Para probar datos inválidos podemos construir deliberadamente un objeto inválido, dejando visible que estamos saltándonos esos defaults.

## La expectativa no debe salir del mismo cálculo que preparamos

Si queremos comprobar que el lector conserva `1250`, escribimos ese valor en la aserción. No calculamos el resultado esperado llamando a la misma función de representación que estamos intentando probar.

Compartir una constante de un formato acordado puede ser razonable. Compartir el algoritmo que produce el valor esperado puede hacer que una regresión cambie ambos lados al mismo tiempo.

Por ejemplo, si una factory empieza a convertir céntimos a euros y el test compara el resultado con `fixture.amountMinor`, podría aprobar un cambio de unidad que no queríamos. El caso monetario del laboratorio conserva una expectativa independiente de **1250 céntimos**.

<img src="/assets/visuals/integration-contracts/INT-FIXTURES.svg" alt="Un escenario define importe, estado y tiempo; la factory aporta defaults estables y overrides explícitos, mientras el test conserva una expectativa independiente y comprueba el límite temporal." width="319" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/integration-contracts/INT-FIXTURES.svg).

## El reloj es una entrada cuando afecta a la regla

Queremos considerar reciente un pedido cuya antigüedad esté entre cero y siete días, ambos límites incluidos. `isRecent`, también en `src/fixtures.ts`, recibe el instante de referencia:

```typescript
export function isRecent(order: Order, now: Date): boolean {
  if (!Number.isFinite(now.valueOf())) throw new Error('invalid_clock')
  const age = now.valueOf() - Date.parse(order.createdAt)
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000
}
```

No consulta `Date.now()`, no espera siete días y no depende de la fecha del portátil. La fecha del pedido se prepara como `2026-01-15T10:00:00.000Z`. El test fija los tres bordes relevantes:

```javascript
test('tiempo explícito: siete días incluidos, un milisegundo más y fechas futuras excluidos', () => {
  const order = orderFixture()
  assert.equal(isRecent(order, new Date('2026-01-22T10:00:00.000Z')), true)
  assert.equal(isRecent(order, new Date('2026-01-22T10:00:00.001Z')), false)
  assert.equal(isRecent(order, new Date('2026-01-15T09:59:59.999Z')), false)
  assert.throws(() => isRecent(order, new Date('invalid')), /invalid_clock/)
})
```

La tercera expectativa impide tratar un pedido futuro como reciente. El `Z` identifica UTC y evita que el string se interprete como una hora local sin zona.

La regla cuenta períodos de veinticuatro horas, no días del calendario de una zona horaria. Si el requisito fuera «desde el lunes según la zona del comercio», esta función no lo resolvería. Necesitaríamos modelar esa regla y probar cambios de fecha y de horario relevantes.

La clasificación temporal es un ejercicio puro del laboratorio; la API de pedidos no incorpora un filtro de recientes. No confundimos tener una función probada con haberla integrado en una funcionalidad pública.

## No todo valor aleatorio hace una prueba menos determinista

Los schemas de PostgreSQL usan UUIDs para evitar colisiones. El test no espera un UUID concreto: espera que cada escenario tenga un namespace distinto y observe sus propios datos.

Esa aleatoriedad de infraestructura no determina el importe, estado o antigüedad del pedido. Es diferente de generar sin control un estado que unas veces sea `paid` y otras `pending`, cuando la aserción solo tenía sentido para uno.

Si el objetivo es explorar entradas, usa **property-based testing** con generadores, reproducción y shrinking. Si el objetivo es explicar una regresión concreta, un ejemplo estable suele ser más fácil de leer. Añadir azar a todos los campos no convierte automáticamente un test de ejemplo en una prueba de propiedades.

## La fixture tiene que devolver también una forma de terminar

El fixture de base de datos ofrece `pool`, `repository`, `name`, `table` y `close`. La función de cierre pertenece al mismo contexto que creó el schema. No recibe un nombre arbitrario para borrarlo después.

El helper `withSchema` garantiza el intento de cierre incluso cuando falla el callback. No necesitamos recordar un `DROP` al final de cada test feliz. Una preparación compartida sin ownership del cleanup tiende a dejar ese trabajo para el siguiente escenario, que no sabe qué es seguro retirar.

Esto tampoco significa que todas las fixtures deban convertirse en un framework. Un constructor de cinco valores y un wrapper de `try/finally` son suficientes aquí. Introducir builders encadenados, herencia y una configuración global no mejoraría esta preparación.

## Código completo y pruebas

Consulta [el índice de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/int-fixtures/README.md), la [factory y la regla temporal](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/integration-contracts/src/fixtures.ts) y sus tests.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/integration-contracts test
pnpm --dir packages/integration-contracts typecheck
```

Son cuatro tests del núcleo: preparación, lectura compatible, rechazos y límite temporal. Para el lifecycle real de las fixtures de base de datos se ejecuta `test:integration`, con los requisitos del artículo anterior.

## Garantías y límites

Los objetos del ejercicio contienen valores primitivos; su congelación no demuestra inmutabilidad profunda de cualquier estructura. El tiempo se controla en esta función, no en todo el sistema operativo o PostgreSQL. No hay generadores con shrinking ni simulación de calendarios comerciales.

## Ejercicio: quitar ruido sin ocultar la condición decisiva

Escribe un test para un pedido `pending` con importe `9900`. Deja ambos valores visibles en su preparación y explica cuáles necesita la expectativa. Después inserta dos pedidos en el mismo schema: comprueba que el ID duplicado falla y que dar un ID explícito al segundo resuelve esa preparación, sin cambiar la regla de unicidad.

Continuamos con [qué puede deshacer un rollback y qué necesita otro tipo de aislamiento](/posts/aislamiento-tests-postgresql-rollback-schemas).

## Referencias

- [Node.js 24: test runner y preparación de tests](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Testcontainers Node: módulo PostgreSQL](https://node.testcontainers.org/modules/postgresql/).
- [Martin Fowler: Test Double](https://martinfowler.com/bliki/TestDouble.html).

Referencias consultadas para esta serie el 22 de octubre de 2026. Las reglas temporales y los datos pertenecen al ejercicio.
