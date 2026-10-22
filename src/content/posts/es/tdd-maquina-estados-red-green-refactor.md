---
id: TEST-TDD
title: 'TDD con una máquina de estados: del primer rojo a una regla que se puede cambiar'
published: 2026-10-21T13:01:00Z
locale: es
translationKey: testing-tdd-state-machine
slug: tdd-maquina-estados-red-green-refactor
draft: true
status: draft
level: intermedio
prerequisites: [P055]
description: 'Desarrolla una regla con red-green-refactor, interpreta los fallos y separa las transiciones puras del estado versionado sin probar detalles privados.'
author: 'Luis Ramírez Calle'
series: 'Pruebas de software: reglas, fronteras y evidencia'
tags: [tdd, testing, typescript, state-machines]
---

Un test escrito antes que la función puede fallar porque falta un archivo. Eso confirma que todavía no se puede ejecutar, pero no demuestra que vaya a detectar una regla incorrecta. Para aprender algo del rojo necesitamos mirar su causa.

Vamos a desarrollar el registro de trabajos del [artículo sobre diseño de pruebas](/posts/disenar-pruebas-invariantes-casos-limite). Empezaremos por una decisión pequeña: un trabajo que terminó con éxito no acepta después un fallo. No necesitamos una API ni una base de datos para decidir eso.

## TDD es una secuencia de decisiones, no un formato de test

En **Test-Driven Development**, primero expresamos el siguiente comportamiento mediante un ejemplo. Ejecutamos el test, implementamos lo necesario para satisfacerlo y después mejoramos el diseño manteniendo ese comportamiento.

El orden permite descubrir si la interfaz que estamos imaginando resulta cómoda de usar. Aquí elegimos `transition(state, command)`: recibe dos valores y devuelve otro estado o rechaza la operación. No depende de una clase que tengamos que construir con seis colaboradores para probar una regla.

Que sea una función no la hace mejor por definición. Es suficiente para este problema. Añadir una jerarquía de estados o un event bus antes de necesitarlo haría más difícil entender qué estamos comprobando.

## Red: observar el motivo del fallo

Esta fue la primera prueba de `tests/core.test.mjs`. Sus imports completos están en el laboratorio: `test` procede de `node:test`, `assert` de `node:assert/strict` y `transition` de `src/machine.ts`, que reexporta las reglas.

```javascript
test('terminal: succeed repetido conserva el éxito; fail no lo revierte', () => {
  assert.equal(transition('succeeded', 'succeed'), 'succeeded')
  assert.throws(() => transition('succeeded', 'fail'), /invalid_transition/)
})
```

La primera ejecución falló por módulo ausente. Después se añadió una función provisional que devolvía siempre el estado recibido. El test volvió a fallar, esta vez con `Missing expected exception`: no había rechazado `fail`.

Ese segundo rojo es más informativo. Demuestra que una implementación capaz de devolver un estado aparentemente razonable no basta para satisfacer la expectativa de rechazo.

Si el fallo hubiera sido un nombre mal escrito o un error de sintaxis, tocar la lógica de negocio no habría sido la respuesta. Leer el mensaje forma parte del ciclo; el color rojo por sí solo no distingue esas situaciones.

<img src="/assets/visuals/testing-strategy/TEST-TDD.svg" alt="El ciclo observado empieza con el test terminal que detecta una aceptación incorrecta, pasa a una regla mínima y añade ejemplos antes de separar transiciones y trabajo versionado." width="359" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/testing-strategy/TEST-TDD.svg).

## Green: resolver la regla actual sin anticipar todo el sistema

La primera implementación aceptó únicamente `succeeded` junto con `succeed` y rechazó el resto. El test pasó. Esa versión era insuficiente para iniciar un trabajo, pero iniciar todavía no era una capacidad implementada.

Esto no significa que convenga escribir código absurdo hasta que los tests te obliguen a dejar de hacerlo. La implementación mínima sirve para mantener pequeño el paso y comprobar una hipótesis. Si conoces el algoritmo necesario, puedes escribirlo directamente, siempre que entiendas qué expectativa estás satisfaciendo.

Después se añadieron los veinte ejemplos de la matriz. Seis fallaron porque la versión mínima rechazaba transiciones válidas, entre ellas `queued` más `start`. Los quince restantes pasaron, incluido el caso terminal inicial y los rechazos que ya eran correctos.

La tabla final de `src/transitions.ts` expresa esas decisiones sin anidar una cadena creciente de condiciones:

```typescript
const rules: Record<State, Partial<Record<Command, State>>> = {
  queued: { start: 'running', cancel: 'cancelled' },
  running: { succeed: 'succeeded', fail: 'failed' },
  succeeded: { succeed: 'succeeded' },
  failed: { fail: 'failed' },
  cancelled: { cancel: 'cancelled' },
}

export function isState(value: unknown): value is State {
  return typeof value === 'string' && Object.hasOwn(rules, value)
}

export function transition(state: State, command: Command): State {
  if (!isState(state)) throw new Error('invalid_transition')
  const row = rules[state]
  if (!Object.hasOwn(row, command)) throw new Error('invalid_transition')
  return row[command]!
}
```

`State` y `Command` son uniones de strings declaradas en ese mismo archivo. `Partial` permite que una fila omita comandos: la ausencia significa rechazo. `Object.hasOwn` evita tratar propiedades heredadas como reglas.

El `!` indica al compilador que la entrada existe tras la comprobación. No añade una validación en runtime. Si se construyera la tabla desde JSON externo, habría que validar también sus valores antes de confiar en ella. Aquí es una constante privada tipada y no se expone para modificarla.

## Refactor: separar la transición de la versión del trabajo

El siguiente comportamiento necesitaba un objeto con ID y versión, no solo un estado. `apply`, en `src/machine.ts`, combina esas piezas:

```typescript
export function apply(job: Job, command: Command): Job {
  assertJob(job)
  const state = transition(job.state, command)
  if (state === job.state) return job
  if (job.version === Number.MAX_SAFE_INTEGER) throw new Error('version_overflow')
  return Object.freeze({ id: job.id, state, version: job.version + 1 })
}
```

`Job` es un objeto readonly con `id`, `state` y `version`. `assertJob` valida esos campos en runtime; `Object.freeze` impide modificar las propiedades del resultado. Como aquí todos los campos son primitivos, no hay objetos anidados que sigan siendo mutables.

La función incrementa la versión solo cuando cambia el estado. Repetir `succeed` sobre un éxito conserva el objeto y su versión. Esto es idempotencia del cambio local, no una garantía de que un proveedor remoto ejecute una acción una sola vez.

Se separaron las transiciones y la representación del trabajo en archivos distintos, manteniendo la reexportación usada por los tests. Tras la reorganización siguieron pasando los mismos ejemplos. Ese es el papel del refactor: cambiar la organización sin cambiar lo observable que hemos decidido proteger.

## Lo observado no equivale a una historia idealizada

En este laboratorio se observaron dos pasos de comportamiento: la regla terminal y la ampliación a la matriz. También hubo fallos de exports y módulos ausentes al preparar los tests del objeto y los adaptadores. No presentamos esos fallos de cableado como prueba de que cada escenario haya pasado individualmente por red-green-refactor.

La suite completa terminó pasando después de implementar el servicio y los repositorios. Eso aporta evidencia de regresión en los escenarios ejecutados, pero no reconstruye retroactivamente un ciclo de TDD para cada línea.

Esta distinción importa al aprender. Un tutorial que solo muestra la versión final puede enseñar buen diseño, aunque no enseñe cómo se descubrió. Para practicar TDD necesitas repetir los pasos en tu copia y observar qué cambia entre ejecuciones.

## Evitar que el test decida los detalles privados

No comprobamos el nombre del objeto `rules`, cuántas funciones auxiliares existen ni el orden de validaciones que producen el mismo rechazo público. Si cambiamos la tabla por un `switch`, los tests de transición deberían seguir pasando.

Sí comprobamos `invalid_transition`, porque la capa HTTP lo traducirá a un conflicto. En una aplicación mayor podríamos usar errores tipados en vez de strings. Aquí añadir esa jerarquía no cambia la lección; el contrato está deliberadamente limitado a unos pocos códigos conocidos.

**TDD** tampoco sustituye revisar requisitos. La suite puede proteger perfectamente una decisión equivocada. Por eso empezamos con ejemplos de producto y no copiando las ramas del código a los tests.

## Código completo y pruebas

Consulta [los archivos del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/test-tdd/README.md) y la [implementación de las transiciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/testing-strategy/src/transitions.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/testing-strategy test
pnpm --dir packages/testing-strategy typecheck
```

La suite local contiene 28 tests del núcleo y del servicio. No requiere Docker o acceso a servicios externos.

## Garantías y límites

Esta máquina modela estados de un registro en memoria. No arranca workers, cancela operaciones remotas o conserva por sí sola los datos. La versión ayuda a detectar escrituras desactualizadas cuando un adaptador implementa la comparación; el número aislado no proporciona exclusión mutua.

## Ejercicio: añadir una capacidad sin diseñar un framework

Añade un comando `retry` que permita pasar de `failed` a `queued`. Escribe primero un ejemplo permitido y otro que rechace `retry` desde `succeeded`. Comprueba la versión resultante. Solo después decide si la tabla actual sigue siendo legible o necesita otra representación.

Seguiremos con [stubs, spies y fakes que no se hacen pasar por una base de datos](/posts/test-doubles-stubs-spies-fakes-contratos).

## Referencias

- [Martin Fowler: Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html).
- [Node.js 24: test runner](https://nodejs.org/docs/latest-v24.x/api/test.html).

Fuentes consultadas el 21 de octubre de 2026. Los resultados y pasos de desarrollo descritos corresponden al laboratorio local.
