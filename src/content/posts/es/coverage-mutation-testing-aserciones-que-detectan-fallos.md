---
id: TEST-COVERAGE
title: 'Coverage al 100 % y errores sin detectar: comprobar la fuerza de las aserciones'
published: 2026-10-21T13:04:00Z
locale: es
translationKey: testing-coverage-mutation-assertions
slug: coverage-mutation-testing-aserciones-que-detectan-fallos
draft: true
status: draft
level: intermedio
prerequisites: [TEST-LAYERS]
description: 'Reproduce un 100 % de coverage que no detecta regresiones. Contrasta una suite débil con cuatro mutaciones manuales, sin confundirlas con un score global.'
author: 'Luis Ramírez Calle'
series: 'Pruebas de software: reglas, fronteras y evidencia'
tags: [testing, coverage, mutation-testing, typescript]
---

Una suite puede ejecutar todas las líneas y branches de una función y no comprobar si devuelve lo correcto. No hace falta un caso rebuscado: basta con recorrer sus entradas e ignorar tanto las respuestas como las excepciones.

Vamos a reproducirlo con las transiciones de nuestro registro de trabajos. Después introduciremos cambios incorrectos para observar qué suite los detecta. Cerramos así el bloque que empezó con [diseñar pruebas desde las reglas](/posts/disenar-pruebas-invariantes-casos-limite): esta vez la pregunta es si nuestras aserciones sirven para protegerlas.

## Coverage mide ejecución dentro de un alcance

**Line coverage** indica qué líneas se ejecutaron. **Branch coverage** considera los caminos de las decisiones que instrumenta la herramienta. **Function coverage** informa de las funciones invocadas. Los detalles dependen del motor de instrumentación y de cómo represente cada construcción.

Ninguna de esas medidas comprueba por sí sola que el valor esperado sea el correcto. Para leer un porcentaje hay que conocer además su denominador: qué archivos incluye, cuáles excluye y con qué suite se obtuvo.

Nuestro experimento usa el test runner de **Node 24.19.0** con su opción experimental de coverage. Instrumentamos únicamente `src/transitions.ts`. No estamos midiendo el handler HTTP, la base de datos ni todo el monorepo.

## Una prueba deliberadamente débil alcanza el 100 %

Este es el contenido de `tests/weak.test.mjs` después de importar `test` y `transition`:

```javascript
// Contraejemplo pedagógico. No usar como suite de regresión.
test('débil: recorre combinaciones pero ignora tanto respuestas como errores', () => {
  for (const state of ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'unknown'])
    for (const command of ['start', 'succeed', 'fail', 'cancel']) {
      try { transition(state, command) } catch {}
    }
})
```

Recorre los cinco estados y un estado inválido con los cuatro comandos. Se ejecutan los caminos de éxito, comando rechazado y estado rechazado. Pero el test no tiene una expectativa sobre ninguno de ellos: si devuelve `cancelled` donde correspondía `running`, nadie protesta.

El `catch` vacío es parte del contraejemplo, no una recomendación para tratar errores. Oculta precisamente la diferencia que necesitaríamos observar.

Desde la raíz del monorepo:

```bash
pnpm --dir packages/testing-strategy coverage:weak
```

El resultado observado para **`transitions.ts`** fue:

<div role="region" aria-label="Coverage de transitions.ts con la suite débil" tabindex="0" style="overflow-x:auto">

| Medida | Resultado |
| --- | --- |
| Líneas | 100 % |
| Branches | 100 % |
| Funciones | 100 % |

</div>

La suite débil se mantiene fuera del comando normal `test`. La ejecutamos explícitamente para estudiar su defecto. No queremos que una prueba sin aserciones se confunda con otra defensa de regresión por aparecer en un contador.

<img src="/assets/visuals/testing-strategy/TEST-COVERAGE.svg" alt="La suite débil alcanza el cien por cien en transitions.ts; una mutación permite fail tras un éxito y la suite sigue pasando, mientras una aserción explícita sí falla." width="343" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/testing-strategy/TEST-COVERAGE.svg).

## Mutation testing pregunta si un cambio incorrecto se detectaría

**Mutation testing** introduce cambios pequeños en la implementación y vuelve a ejecutar las pruebas. Si una aserción detecta el cambio, hablamos de un mutante **killed**. Si los tests siguen pasando, el mutante ha **survived**. No es lo mismo que cobertura: aquí observamos la reacción de las pruebas ante otra implementación.

En `scripts/mutate.mjs` seleccionamos cuatro cambios manuales. Para cada uno creamos una copia temporal del código y de los tests, modificamos una aparición exacta y ejecutamos dos suites: la débil y `core.test.mjs`. Las fuentes de trabajo no se editan.

La tabla muestra los resultados guardados en `evidence/mutations.json`:

<div role="region" aria-label="Cuatro mutaciones y respuesta de las dos suites de prueba" tabindex="0" style="overflow-x:auto">

| Cambio introducido | Suite débil | Suite del núcleo |
| --- | --- | --- |
| `start` desde `queued` devuelve `cancelled` | Pasa; ejecuta la regla alterada | Falla la expectativa `running` |
| Un éxito acepta después `fail` | Pasa; ejecuta la regla alterada | Falla la expectativa de rechazo |
| `running` permite `cancel` inmediato | Pasa; ejecuta la regla alterada | Falla la expectativa de rechazo |
| Un cambio deja la versión sin incrementar | Pasa; no ejecuta ese archivo | Falla el estado versionado esperado |

</div>

Las tres primeras mutaciones afectan al archivo con coverage del 100 %. La cuarta está en `machine.ts`, fuera de ese alcance y del recorrido de la suite débil. Es un hueco distinto: no comprobar una regla ejecutada y no ejecutar una regla no son el mismo problema.

La [documentación de estados de Stryker](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/) distingue, entre otros resultados, `Survived` de `No coverage`. Nuestro script manual registra el archivo y su alcance; no implementa la clasificación automática completa de Stryker.

## Una aserción concreta hace visible la diferencia

La suite del núcleo incluye esta expectativa de `tests/core.test.mjs`:

```javascript
test('terminal: succeed repetido conserva el éxito; fail no lo revierte', () => {
  assert.equal(transition('succeeded', 'succeed'), 'succeeded')
  assert.throws(() => transition('succeeded', 'fail'), /invalid_transition/)
})
```

Cuando el mutante permite `fail`, `assert.throws` falla porque ya no se produce el rechazo. No importa que la implementación use una tabla o un `switch`: el test observa la regla que queríamos preservar.

El runner comprueba primero que ambas suites pasan sin mutaciones. Después exige que cada mutante deje pasar la suite débil y provoque un fallo de aserción en la del núcleo. También rechaza errores de importación o sintaxis como explicación válida de ese fallo.

Esto evita contar un módulo roto como éxito del experimento. El proceso tiene timeout; si expira, el script falla y no lo registra como una mutación detectada por las aserciones.

## Un mutante superviviente es una pregunta, no una condena

Si una mutación sobrevive, puede faltar un ejemplo, una aserción puede ser demasiado permisiva o el cambio puede no alterar un comportamiento relevante. También existen mutaciones equivalentes, cuya diferencia no es observable bajo el contrato elegido.

No conviene añadir un test para inspeccionar detalles privados solo para subir el score. Primero construye un caso público que debería cambiar con la mutación. Si no existe, revisa si el mutante es equivalente o si el contrato estaba menos definido de lo que pensabas.

En este ejercicio los cuatro cambios se eligieron porque contradicen reglas explícitas. Detectarlos confirma la utilidad de esas aserciones frente a esos cambios. No permite estimar qué porcentaje de todos los defectos posibles encontrará la suite.

## Cómo usar coverage sin convertirlo en el objetivo

Usa el informe para buscar código que nunca ejecutas, especialmente caminos de error y validaciones. Después revisa los valores esperados: recorrer un rechazo no demuestra que hayas exigido el error adecuado ni que el estado haya quedado intacto.

Aplica mutaciones donde la incertidumbre lo justifique. Una regla de autorización o una condición que evita una doble escritura merece más atención que un getter trivial. En una base de código mayor, una herramienta automática puede generar y ejecutar muchas variantes; su coste y sus exclusiones deben quedar visibles.

Aquí no instalamos ni ejecutamos **Stryker**. El script pequeño permite entender el mecanismo y conservar cuatro contraejemplos reproducibles. Tampoco publicamos un «100 % de calidad» porque cuatro mutantes seleccionados hayan sido detectados.

## Código completo y pruebas

Consulta [el índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/test-coverage/README.md), el [runner de mutaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/testing-strategy/scripts/mutate.mjs) y su evidencia versionable en el mismo paquete.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/testing-strategy test
pnpm --dir packages/testing-strategy coverage:weak
pnpm --dir packages/testing-strategy mutation
pnpm --dir packages/testing-strategy verify
```

`verify` repite las suites y el informe débil; `mutation` regenera su evidencia por separado. Los artefactos registran la versión de Node y hashes de las fuentes para identificar qué código produjo los resultados. Los números no son medidas de rendimiento.

## Garantías y límites

El coverage del 100 % corresponde solo a `transitions.ts` y a la suite débil. Se probaron cuatro mutaciones manuales, tres dentro de ese archivo. No hay ejecución de Stryker, score global, fuzzing, mutation testing de SQL ni demostración de ausencia de defectos.

## Ejercicio: encontrar una aserción que sobra o que falta

En una copia, elimina la expectativa de versión final del test de `apply` y repite la mutación que impide incrementarla. Comprueba si otra aserción todavía la detecta y explica por qué. No presupongas que cada mutante tiene un único test capaz de fallar.

Después elige una regla de tu proyecto, escribe un cambio plausible que la rompa y comprueba que el test falla por esa diferencia. Es una revisión pequeña que puedes hacer antes de introducir una herramienta de mutation testing en toda la suite.

## Referencias

- [Node.js 24: test runner y coverage](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Stryker: mutation testing](https://stryker-mutator.io/docs/).
- [Stryker: estados de mutantes y métricas](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/).

Fuentes consultadas el 21 de octubre de 2026; redacción revisada el 22. Experimento local con Node 24.19.0.
