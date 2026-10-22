---
id: P055
title: 'Diseñar pruebas desde las reglas: qué resultado distinguiría un fallo'
published: 2026-10-21T13:00:00Z
locale: es
translationKey: testing-design-invariants
slug: disenar-pruebas-invariantes-casos-limite
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-TDD]
description: 'Convierte reglas de producto en ejemplos, rechazos y casos límite. Diseña un oracle independiente de la implementación con una máquina de estados pequeña.'
author: 'Luis Ramírez Calle'
series: 'Pruebas de software: reglas, fronteras y evidencia'
tags: [testing, typescript, invariants, calidad]
---

Un trabajo termina correctamente y, después, llega una notificación de fallo atrasada. ¿Debe cambiar de estado? Si tus pruebas solo comprueban que la función devuelve un objeto, pueden pasar tanto con la respuesta correcta como con la incorrecta.

Antes de elegir un framework conviene resolver una pregunta más incómoda: **¿qué resultado tendría que hacer fallar este test?** Si no puedes responderla, todavía falta concretar la regla o la observación.

Esta serie amplía la [introducción a TDD, integración y contratos](/posts/tdd-pruebas-unitarias-integracion-contrato). Construiremos un registro pequeño de trabajos para aprender a diseñar y revisar pruebas. No ejecuta los trabajos: modela su estado. Esa distinción evitará atribuirle garantías que no tiene.

## Un test necesita un oracle, no solo una llamada

Un **test oracle** es el criterio que permite decidir si el resultado es correcto. Puede ser un valor esperado, una propiedad del resultado o una relación entre varias operaciones.

En nuestro ejemplo, un trabajo recién creado está en `queued`. Puede empezar o cancelarse antes de empezar. Una vez en `running`, solo aceptamos éxito o fallo. No permitimos cancelación inmediata porque cambiar un registro a `cancelled` no demuestra que una tarea en ejecución haya dejado de trabajar.

Los terminales son `succeeded`, `failed` y `cancelled`. Repetir su propio comando conserva el estado; cualquier otro se rechaza. Es una política del ejercicio, no una regla universal de los sistemas de jobs. Otro producto podría necesitar reintentos, cancelación cooperativa o una transición `cancelling`.

Primero dejamos escritas esas decisiones. Después buscamos ejemplos que distingan cumplirlas de incumplirlas.

<img src="/assets/visuals/testing-strategy/P055.svg" alt="De la regla que impide revertir un éxito se obtiene un caso con succeed y fail, una expectativa de rechazo y un contraejemplo que debe hacer fallar la aserción." width="305" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/testing-strategy/P055.svg).

## Una matriz descubre los huecos entre los casos felices

Tenemos cinco estados y cuatro comandos. Eso produce veinte combinaciones inmediatas. Esta tabla es la especificación que queremos comprobar:

<div role="region" aria-label="Matriz de estados y comandos del registro de trabajos" tabindex="0" style="overflow-x:auto;white-space:nowrap">

| Estado actual | **start** | **succeed** | **fail** | **cancel** |
| --- | --- | --- | --- | --- |
| **queued** | **running** | Rechazo | Rechazo | **cancelled** |
| **running** | Rechazo | **succeeded** | **failed** | Rechazo |
| **succeeded** | Rechazo | Sin cambio | Rechazo | Rechazo |
| **failed** | Rechazo | Rechazo | Sin cambio | Rechazo |
| **cancelled** | Rechazo | Rechazo | Rechazo | Sin cambio |

</div>

No obtenemos los valores esperados recorriendo la tabla interna del programa. Si ambos lados se calculan con la misma regla equivocada, el test solo confirma que el programa está de acuerdo consigo mismo.

En `tests/core.test.mjs`, `cases` contiene los veinte ejemplos escritos desde la especificación. El bucle únicamente registra los tests:

```javascript
for (const [state, command, expected] of cases) {
  test(`matriz: ${state} + ${command} -> ${expected ?? 'rechazo'}`, () => {
    if (expected === null) assert.throws(() => transition(state, command), /invalid_transition/)
    else assert.equal(transition(state, command), expected)
  })
}
```

`null` significa rechazo en los datos del test; no es un estado del dominio. Cada nombre identifica la combinación que falló. Si se habilita `cancel` desde `running`, el fallo señala esa decisión concreta.

Una **decision table** es útil cuando hay pocas dimensiones discretas. Con cientos de condiciones puede volverse ilegible. En ese caso conviene separar reglas independientes y combinar ejemplos representativos con **property-based testing**, sin fingir que una tabla enorme se revisa sola.

## Las invariants describen lo que debe mantenerse

Una **invariant** no es otro nombre para cualquier aserción. Expresa una condición que debe conservarse en los estados o recorridos válidos del modelo.

Aquí usamos tres: los terminales no retroceden, cada cambio efectivo incrementa la versión exactamente una vez y evaluar una transición no modifica el objeto de entrada. Para observar las dos últimas necesitamos algo más que una pareja estado/comando.

`apply` recibe un trabajo completo y devuelve el siguiente. Este test de `tests/core.test.mjs` encadena creación, inicio, éxito y repetición:

```javascript
test('apply: no muta el original, incrementa una versión y no incrementa un duplicado', () => {
  const queued = newJob('j-1')
  const running = apply(queued, 'start')
  const succeeded = apply(running, 'succeed')
  assert.deepEqual(queued, { id: 'j-1', state: 'queued', version: 0 })
  assert.deepEqual(succeeded, { id: 'j-1', state: 'succeeded', version: 2 })
  assert.equal(apply(succeeded, 'succeed'), succeeded)
  assert.ok(Object.isFrozen(queued) && Object.isFrozen(running))
  assert.throws(() => { running.state = 'queued' }, TypeError)
})
```

La igualdad del original comprueba que sigue intacto después de las operaciones. La versión `2` distingue incrementar una vez de incrementar dos o ninguna. La igualdad por referencia del duplicado comprueba además una decisión explícita de esta API: si no hay cambio, devolvemos el mismo objeto.

Esa última expectativa sería innecesaria si el contrato solo prometiera igualdad de valores. Probar referencias sin necesitarlo puede convertir un refactor inocente en una regresión artificial. Aquí la conservamos porque la función la ofrece deliberadamente; fuera del ejercicio hay que decidir si merece formar parte del contrato.

## Los casos límite necesitan una razón

Añadir datos aleatorios no sustituye identificar fronteras. Nuestros IDs aceptan `j-` seguido de uno a treinta y dos caracteres alfanuméricos en minúscula. Las versiones son enteros seguros no negativos. Los tests prueban tipos incorrectos, una versión fraccionaria y el salto más allá de `Number.MAX_SAFE_INTEGER`.

Ese último límite importa porque **TypeScript** usa el `number` de JavaScript para estas versiones. Superado el rango de enteros seguros, sumar uno deja de representar necesariamente un contador exacto. El modelo rechaza el desbordamiento; no intenta arreglarlo cambiando silenciosamente a otro tipo.

También probamos `toString` y `constructor` como comandos inválidos. Un objeto tiene propiedades heredadas: consultar una tabla sin distinguir sus claves propias podría aceptar algo que no es una transición. No son strings extravagantes elegidos para engordar la suite; atacan una suposición concreta de la implementación.

Conviene revisar también los dos valores válidos justo en la frontera de un formato. Esta suite no agota todos los IDs posibles. Tener veinte combinaciones de estado completas no convierte la validación de entradas en exhaustiva.

## Arrange, Act, Assert ayuda a leer la decisión

**Arrange** prepara el estado relevante; **Act** ejecuta el comportamiento; **Assert** observa su resultado. No exige tres comentarios en cada test. En el ejemplo anterior los nombres y la secuencia ya permiten seguir esas fases.

Procura que la preparación no esconda la condición decisiva. Una factory que siempre devuelve un trabajo en `queued` es cómoda hasta que el lector necesita saber por qué un éxito se rechaza. Si el estado importa, que se vea en el test o en una factory con nombre específico.

Tampoco hay una regla de «una aserción por test». Comprobar estado y versión puede describir un único resultado de negocio. Lo que dificulta el diagnóstico es mezclar escenarios independientes, por ejemplo validación de IDs y una caída del almacenamiento, bajo el mismo nombre genérico.

## Código completo y pruebas

El [índice de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p055/README.md) enlaza el laboratorio. Los extractos anteriores se ejecutan en [tests/core.test.mjs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/testing-strategy/tests/core.test.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/testing-strategy test
pnpm --dir packages/testing-strategy typecheck
```

Usamos Node 24.19.0 y TypeScript 5.9.2. El comando `test` ejecuta 28 pruebas del núcleo y del servicio, incluidas las veinte combinaciones. Los tests HTTP y SQLite van en otro comando; no son necesarios para observar esta tabla pura.

## Garantías y límites

La matriz cubre todas las parejas inmediatas de los cinco estados y cuatro comandos definidos. No prueba todas las secuencias, persistencia, concurrencia entre procesos o efectos externos. Los terminales son una decisión simplificada del registro, no una prueba de que ningún worker vuelva a ejecutar nada.

## Ejercicio: convertir una frase ambigua en ejemplos

Escribe «se puede reintentar un trabajo fallido». Antes de tocar código, decide si el retry conserva el ID, incrementa un contador o crea otro trabajo. Añade un caso permitido y uno que siga rechazado. Comprueba que la suite actual falla por la nueva expectativa y no por un error de importación.

En la siguiente parte usaremos ese criterio para entender [red-green-refactor sin saltarnos el primer rojo](/posts/tdd-maquina-estados-red-green-refactor).

## Referencias

- [Node.js 24: test runner y aserciones](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Martin Fowler: Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html).

Fuentes consultadas el 21 de octubre de 2026. Las reglas del trabajo pertenecen al laboratorio, no a esas referencias.
