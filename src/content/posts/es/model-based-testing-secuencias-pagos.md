---
id: PBT-MODEL
title: 'Model-based testing: comprobar pagos después de cada evento'
published: 2026-10-22T09:02:00Z
locale: es
translationKey: property-testing-model
slug: model-based-testing-secuencias-pagos
draft: true
status: draft
level: intermedio
prerequisites: [PBT-SHRINK]
description: 'Usa una tabla pequeña como oráculo de secuencias de pagos. Comprueba estado y efectos tras cada evento, incluidos duplicados y acciones que no cambian nada.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, model-based-testing, state-machines, typescript]
---

Un pago sigue apareciendo como `succeeded`, pero el contador de capturas vale dos. Una propiedad que solo vigile el estado final deja pasar el defecto: no hubo retroceso, aunque se repitió un efecto.

Necesitamos observar **estado y efectos**, también después de eventos duplicados. Un modelo pequeño nos permite expresar ambas expectativas sin escribir a mano cada secuencia posible.

Partimos de [la regresión obtenida con shrinking](/posts/shrinking-replay-contraejemplos-fast-check). Aquí veremos qué compara el oráculo y por qué no basta con preguntar a `Payment` cuál debería ser su siguiente estado.

## Qué significa model-based testing en este ejemplo

En **model-based testing** contrastamos un sistema con una descripción más sencilla de su comportamiento esperado. Nuestro **system under test**, o **SUT**, es la clase `Payment`. El modelo es una tabla de transiciones y un contador esperado.

No pretendemos modelar un proveedor comercial completo. Una operación empieza en `created`; `submit` la deja en `processing`. Desde ahí, `confirm` significa éxito con una captura local y `decline` significa fallo sin captura. Ambos terminales se conservan.

Los eventos fuera de esos casos no hacen nada. Es una política deliberada de este ejercicio, útil para hablar de repeticiones. Otra API podría rechazar algunas acciones con un error; entonces el modelo debería comprobar también ese rechazo y la ausencia de cambios. No hay una máquina de pagos universal que todas las integraciones deban copiar.

<img src="/assets/visuals/property-testing/PBT-MODEL.svg" alt="Una secuencia de submit, confirm y decline se aplica a una tabla de especificación y a Payment; tras cada evento se comparan estado y capturas, con alcance limitado a una operación en memoria." width="321" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/PBT-MODEL.svg).

## La tabla especifica qué debe pasar, no cómo implementarlo

Archivo `tests/sequence.mjs`:

```javascript
const specification = {
  created: { submit: 'processing', confirm: 'created', decline: 'created' },
  processing: { submit: 'processing', confirm: 'succeeded', decline: 'failed' },
  succeeded: { submit: 'succeeded', confirm: 'succeeded', decline: 'succeeded' },
  failed: { submit: 'failed', confirm: 'failed', decline: 'failed' },
}
```

Cada fila contesta qué significa recibir un evento en un estado concreto. La implementación tiene su propio código condicional y no importa esta tabla. El test tampoco llama a un método de transición del SUT para obtener el resultado esperado.

Separar archivos no garantiza independencia intelectual. Si copiamos una regla equivocada a ambos lados, el test puede pasar. La tabla necesita revisión contra el contrato del ejercicio y ejemplos concretos: por ejemplo, confirmar antes de enviar debe conservar `created`; confirmar dos veces no debe capturar dos veces.

Esos ejemplos permiten discutir la especificación con alguien que no conoce la estructura interna de la clase. El modelo resulta útil porque es pequeño y explícito, no por llevar la palabra «modelo» en el nombre.

## Comparar después de cada paso encuentra errores transitorios

Este es el oráculo completo del mismo archivo. Usa `assert` de `node:assert/strict` y recibe una factoría para probar la implementación corregida o una variante defectuosa:

```javascript
export function assertSequence(events, createPayment) {
  const payment = createPayment()
  let expected = 'created'
  let expectedCaptures = 0
  for (const event of events) {
    const next = specification[expected][event]
    if (expected === 'processing' && next === 'succeeded') expectedCaptures++
    expected = next
    payment.apply(event)
    assert.equal(payment.state, expected, `state after ${event}`)
    assert.equal(payment.captures, expectedCaptures, `captures after ${event}`)
  }
}
```

`expectedCaptures` solo aumenta cuando el modelo pasa de `processing` a `succeeded`. Repetir `confirm` sobre `succeeded` conserva uno. No calculamos el valor esperado leyendo `payment.captures`, porque eso convertiría la comparación en una afirmación sobre sí misma.

Comprobar únicamente al final puede ocultar un paso incorrecto que otro evento posterior sobrescriba. Aquí cada evento tiene una postcondición. Si un rechazo borra el éxito, el test falla justo después del rechazo, aunque luego pudiera llegar otra confirmación.

## Por qué generamos también eventos sin efecto

El generador elige arrays de `submit`, `confirm` y `decline` sin filtrar según el estado. Así visita confirmaciones prematuras, envíos duplicados y eventos después de un terminal. Todos tienen un comportamiento definido en la tabla.

Si generáramos solo acciones que cambian el estado, quedarían fuera precisamente las repeticiones que queríamos comprobar. La validez de una entrada no significa que deba producir una transición: **ignorar de forma controlada también es comportamiento observable**.

Para sistemas con comandos que solo tienen sentido bajo ciertas precondiciones, fast-check ofrece `fc.commands` y runners de modelo. Aquí un array basta porque las tres acciones están definidas en todos los estados. Evitamos introducir una abstracción adicional que no necesitamos para esta máquina.

## Estado correcto no significa efecto correcto

La variante `late-decline` falla con `submit → confirm → decline`: la tabla conserva éxito y la clase lo cambia a fallo.

La variante `duplicate-capture` falla con `submit → confirm → confirm`: ambos lados siguen en éxito, pero el contador observado llega a dos. En la implementación corregida permanece en uno.

Son errores distintos y requieren observaciones distintas. Una propiedad de «terminal estable» detecta el primero, pero no el segundo. El contador no representa aquí dinero movido por una red: representa un efecto local del modelo. Para hablar de un cargo externo necesitamos probar otra frontera, que abordaremos en [fault injection](/posts/fault-injection-respuesta-perdida-propiedades).

## Aislar cada secuencia para no contaminar el resultado

`createPayment()` se llama dentro de cada ejecución de la propiedad. No compartimos una instancia entre quinientas secuencias ni entre candidatos de reducción. Cada una comienza en `created` con cero capturas.

Si compartiéramos estado, la entrada mostrada en el informe podría fallar solo por lo que ocurrió antes. La seed no arreglaría esa dependencia oculta y el shrinking perdería sentido: quitar eventos cambiaría algo más que la secuencia examinada.

## Código completo y pruebas

[Índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/pbt-model/README.md), [modelo y oráculo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/tests/sequence.mjs) y [Payment](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/src/payment.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing test
```

La propiedad de la implementación corregida pasa quinientas secuencias con seed `5702`. La suite conserva además las dos regresiones explícitas y exige que las variantes fallen por aserciones.

## Garantías y límites

El modelo cubre una sola operación, tres eventos y un contador en memoria. No tiene autorizaciones parciales, refunds, importes, varios intentos, transacciones o concurrencia. Las secuencias se aplican de forma síncrona.

No estamos ejecutando model checking exhaustivo ni demostrando equivalencia formal. La tabla limita qué significa correcto y el generador limita qué recorridos se visitan. Ampliar el negocio exige revisar ambos, no añadir estados por intuición.

## Ejercicio: dar contrato a una acción nueva

Antes de programar `cancel`, escribe su resultado en las cuatro filas. Decide si cancelar después del éxito debe ignorarse, rechazarse o representar una operación nueva. No reutilices `failed` para esconder esa decisión.

Añade ejemplos explícitos y después el nuevo evento al generador. Para eventos concurrentes necesitarás además controlar su orden: seguimos con [race conditions y scheduler](/posts/race-conditions-scheduler-fast-check).

## Referencias

- [fast-check: modelos y comandos](https://fast-check.dev/docs/advanced/model-based-testing/).
- [Node.js 24: aserciones estrictas](https://nodejs.org/docs/latest-v24.x/api/assert.html).

Fuentes consultadas el 22 de octubre de 2026. La implementación utiliza arrays de eventos, no `fc.commands`.
