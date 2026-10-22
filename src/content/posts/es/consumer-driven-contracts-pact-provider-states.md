---
id: CONTRACT-CDC
title: 'Consumer-driven contracts con Pact: verificar al proveedor sin fiarse del mock'
published: 2026-10-22T08:04:00Z
locale: es
translationKey: integration-consumer-driven-contracts-pact
slug: consumer-driven-contracts-pact-provider-states
draft: true
status: draft
level: intermedio
prerequisites: [CONTRACT-SCHEMA]
description: 'Genera un contrato con el cliente real contra un mock de Pact y verifícalo contra HTTP y PostgreSQL, con provider states independientes y rupturas controladas.'
author: 'Luis Ramírez Calle'
series: 'Integración y contratos: probar acuerdos con dependencias reales'
tags: [testing, pact, consumer-driven-contracts, api]
---

El cliente pasa sus tests porque el mock devuelve exactamente lo que necesita. El proveedor pasa los suyos porque nadie le pide esa respuesta concreta. Ambos están verdes y, aun así, no hemos comprobado que hablen el mismo contrato.

Un **consumer-driven contract** conecta esas dos verificaciones: el consumidor expresa sus expectativas y el proveedor demuestra que puede satisfacerlas. Vamos a hacerlo con **Pact**, conservando la diferencia entre [estructura y significado del contrato](/posts/schema-tests-contratos-api-semantica).

## Dos verificaciones, no una respuesta falsa convertida en verdad

Primero ejecutamos el cliente real contra el **mock server de Pact**. Definimos la solicitud que hará y las partes de la respuesta de las que depende. Pact comprueba esa interacción y genera un archivo de contrato.

Después arrancamos el proveedor real y un **Verifier** reproduce las solicitudes descritas en ese archivo. En nuestro ejercicio el proveedor consulta PostgreSQL. No sustituimos sus respuestas por las del mock para poner verde la segunda mitad.

El artefacto permite intercambiar expectativas entre repositorios. Aquí consumidor y proveedor viven en un mismo laboratorio para reproducir todo localmente. No afirmamos que sean aplicaciones publicadas o desplegadas de manera independiente.

## El consumidor debe ejecutar su cliente, no solo fetch de ejemplo

El cliente del ejercicio es `fetchReceipt`, en `src/consumer.ts`. Consulta un pedido y utiliza `readOrder` para interpretar un `200`. Si recibe `404`, valida el error `not_found` y devuelve `null`; otros status se rechazan.

El test de `tests/consumer.test.mjs` invoca ese cliente dentro de `executeTest`:

```javascript
test('consumidor real contra mock Pact: importe requerido y estado paid', async () => {
  await pact.addInteraction()
    .given('a paid order exists')
    .uponReceiving('the receipt widget requests order o-1')
    .withRequest('GET', '/orders/o-1')
    .willRespondWith(200, (builder) => {
      builder.headers({ 'Content-Type': 'application/json' })
      builder.jsonBody({ id: 'o-1', amountMinor: Matchers.integer(1250), currency: 'EUR', status: 'paid' })
    })
    .executeTest(async (mock) => {
      assert.deepEqual(await fetchReceipt(mock.url), { id: 'o-1', amountMinor: 1250, currency: 'EUR', status: 'paid' })
    })
})
```

La instancia `pact` identifica al consumidor como `ReceiptWidget` y al proveedor como `OrdersApi`. Escucha en `127.0.0.1` con puerto asignado dinámicamente y escribe en la carpeta `contracts/` del paquete.

`given` nombra una precondición del proveedor. No crea un pedido real durante el test del consumidor: el mock responde con el ejemplo definido. En la verificación del proveedor tendremos que preparar esa precondición de verdad.

Un segundo test pide `o-2` cuando no hay pedidos y exige que el cliente devuelva `null`. Así no dependemos de que el escenario de éxito deje un dato preparado para el de ausencia.

<img src="/assets/visuals/integration-contracts/CONTRACT-CDC.svg" alt="El cliente genera dos interacciones contra el mock Pact; el verifier prepara sus estados y consulta OrdersApi con PostgreSQL real. Se distinguen respuestas compatibles, ruptura y límites del matcher integer." width="336" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/integration-contracts/CONTRACT-CDC.svg).

## El matcher define cuánto estamos exigiendo

`Matchers.integer(1250)` utiliza `1250` como ejemplo para el mock, pero permite otros enteros al verificar al proveedor. No significa «el proveedor siempre debe devolver 1250».

Los valores literales `EUR` y `paid` sí expresan esas expectativas concretas para esta interacción. El estado preparado es un pedido pagado; otra interacción podría pedir uno pendiente.

El contrato no incluye `label` ni `createdAt`, porque este consumidor no los utiliza. Por eso una respuesta aditiva puede conservar el acuerdo. El schema del proveedor, que también validamos en otra parte, describe más campos que esta expectativa parcial del cliente.

Usar matchers demasiado amplios puede dejar pasar cambios importantes. Usar igualdad exacta en datos irrelevantes puede bloquear cambios compatibles. La decisión depende de qué necesita realmente el consumidor, no de cuál genere menos fallos.

## Provider states son precondiciones independientes

En `tests/postgres.test.mjs`, el verifier recibe dos **state handlers**. Cada uno prepara un estado conocido en el schema privado del escenario:

```javascript
await new Verifier({
  provider: 'OrdersApi', providerBaseUrl: origin, pactUrls: [pactPath],
  providerVersion: 'local-lab', publishVerificationResult: false, logLevel: 'error',
  stateHandlers: {
    'a paid order exists': async () => {
      states.push('paid')
      await fixture.pool.query(`TRUNCATE ${fixture.table}`)
      await fixture.repository.insert(orderFixture())
      if (mode === 'additive') await fixture.pool.query(`UPDATE ${fixture.table} SET label='Libro'`)
    },
    'no orders exist': async () => {
      states.push('missing')
      await fixture.pool.query(`TRUNCATE ${fixture.table}`)
    },
  },
}).verifyProvider()
```

`origin` pertenece al servidor HTTP local; `pactPath` apunta al archivo generado por los tests del consumidor. `fixture.table` es una tabla cualificada dentro de un schema creado exclusivamente para este escenario, no una tabla de una base compartida.

El primer handler deja exactamente el pedido que necesita la interacción. El segundo deja la tabla vacía. No asumimos en qué orden se verificarán: cada precondición elimina la dependencia del estado anterior.

Estos handlers se configuran en el proceso de tests. No añadimos al proveedor un endpoint público que permita vaciar tablas para «preparar Pact». Esa facilidad sería una capacidad peligrosa si terminara expuesta fuera del entorno de prueba.

La [guía de provider states](https://docs.pact.io/getting_started/provider_states) insiste en verificar interacciones independientes. El mecanismo no elimina la necesidad de diseñar bien los datos y el cleanup.

## Un proveedor puede ser real sin que todo su mundo lo sea

Para este ejercicio elegimos PostgreSQL real porque también estamos estudiando su integración. En una suite de contratos centrada solo en la frontera HTTP podríamos sustituir dependencias internas por stubs controlados y mantener pruebas SQL separadas.

Eso no invalida el contrato, siempre que no se sustituya precisamente el comportamiento del proveedor que se pretende verificar. Es distinto preparar los datos o una respuesta downstream a reemplazar la respuesta HTTP del propio proveedor por la del mock del consumidor.

Aquí los estados ejecutan SQL, el handler consulta el repositorio y la respuesta se serializa realmente. El conjunto sigue sin incluir identidad, UI, TLS o workers.

## Las variantes incorrectas comprueban que el acuerdo se está verificando

El proveedor **baseline** pasa las dos interacciones. La variante **aditiva**, con una columna `label` añadida y consultada desde SQL, también pasa sin cambiar el contrato anterior.

La variante **renamed** sirve `money.minorUnits` donde v1 esperaba `amountMinor`. Antes de verificarla comprobamos que responde `200`, conserva el importe dentro de `money` y ha retirado el campo antiguo. Pact la rechaza. No contamos un error de arranque o configuración como prueba de incompatibilidad.

Durante la preparación del laboratorio apareció precisamente un fallo de configuración: esta combinación de versiones exigía `providerVersion` al incluir `publishVerificationResult`, incluso con valor `false`. Se añadió `local-lab` manteniendo la publicación desactivada. El test negativo no aceptaba aquel error como el rechazo del contrato esperado.

## Pact tampoco deduce una unidad monetaria a partir de integer

La cuarta variante devuelve `12` en lugar de `1250`. Pact la acepta porque el matcher pide un entero. El schema también la acepta y el lector puede interpretarla.

La aserción independiente sobre los **1250 céntimos esperados** detecta el cambio. La evidencia registra tanto la aceptación estructural como ese rechazo semántico, sin atribuir a Pact una capacidad que no le hemos configurado.

Podríamos exigir `1250` exactamente en esta interacción. Sería útil para ese escenario, pero no demostraría todas las reglas de cálculo, monedas o redondeo. Los contratos de comunicación y las reglas de negocio necesitan expectativas complementarias.

## Compartir un archivo no equivale a gestionar versiones desplegadas

Un **Pact Broker** puede distribuir contratos y conservar resultados asociados a versiones de consumidores y proveedores. Aquí compartimos un archivo local; no publicamos contratos ni resultados, no usamos cuentas y no ejecutamos una matriz de despliegue.

En un sistema real habría que decidir qué versiones siguen activas, quién mantiene cada contrato y qué resultado exige la entrega del proveedor. Un contrato aprobado contra un único consumidor local no autoriza retirar campos que otros clientes todavía usan.

## Código completo y pruebas

Consulta [los archivos del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/contract-cdc/README.md), el [test del consumidor](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/integration-contracts/tests/consumer.test.mjs) y el contrato generado en `contracts/ReceiptWidget-OrdersApi.json`.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/integration-contracts test:consumer
pnpm --dir packages/integration-contracts test:integration
```

El primer comando de tests no necesita Docker. El segundo regenera el contrato y verifica PostgreSQL/HTTP con los requisitos del [artículo de Testcontainers](/posts/testcontainers-postgresql-integracion-ciclo-vida). La suite completa pasa cuatro tests del núcleo, dos del consumidor y nueve de integración. La telemetría de Pact se desactiva en el laboratorio.

## Garantías y límites

Pact 17.1.4 ejecutado, contrato local con dos interacciones y proveedor real con PostgreSQL. Sin Broker, publicación, consumidores externos, verificación E2E de UI o matriz de versiones desplegadas. `integer` no conserva por sí solo unidades monetarias. No certificamos todas las expectativas de un cliente que este contrato no expresa.

## Ejercicio: conservar la expectativa del consumidor

Retira `amountMinor` del proveedor sin modificar el contrato generado por el cliente anterior. Comprueba el fallo de verificación. Después cambia solo el matcher a igualdad exacta con `1250` y repite la variante de unidad incorrecta. Explica qué regresión detectas ahora y qué regla de negocio seguiría fuera del contrato.

## Referencias

- [Pact JS: tests del consumidor](https://docs.pact.io/implementation_guides/javascript/docs/consumer).
- [Pact JS: verificación del proveedor](https://docs.pact.io/implementation_guides/javascript/docs/provider).
- [Pact: provider states](https://docs.pact.io/getting_started/provider_states).
- [Pact: compartir contratos mediante un Broker](https://docs.pact.io/getting_started/sharing_pacts).

Fuentes y APIs instaladas consultadas el 22 de octubre de 2026. Las versiones están fijadas para reproducir el ejercicio, no como afirmación de últimas versiones.
