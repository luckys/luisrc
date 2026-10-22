---
id: PBT-MUTATION
title: 'Mutation testing de propiedades: mil ejemplos no arreglan una regla incompleta'
published: 2026-10-22T09:06:00Z
locale: es
translationKey: property-testing-mutations
slug: mutation-testing-evaluar-propiedades
draft: true
status: draft
level: intermedio
prerequisites: [PBT-FAULTS, PBT-FUZZ, PBT-RACES, TEST-COVERAGE]
description: 'Contrasta propiedades débiles y fuertes con tres mutaciones seleccionadas. Entiende un superviviente sin confundir casos verdes, coverage y capacidad de detectar errores.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, mutation-testing, property-based-testing, quality]
---

Quinientas secuencias pasan contra una implementación que captura dos veces. No es que el generador haya tenido mala suerte: la propiedad solo comprueba que el estado terminal no cambie. El contador de efectos nunca entra en la comparación.

Aumentar a mil o diez mil ejecuciones no añade esa expectativa ausente. Antes de ampliar la campaña necesitamos comprobar si las propiedades reconocen errores que sabemos introducir.

En [coverage y mutaciones](/posts/coverage-mutation-testing-aserciones-que-detectan-fallos) vimos por qué ejecutar una línea no implica verificar su comportamiento. Esta entrega aplica esa idea a los oráculos de la serie: generación automática no significa especificación completa.

## Qué pregunta responde mutation testing

El **mutation testing** introduce cambios deliberados en la implementación y observa si los tests los detectan. Una **mutación** puede eliminar una condición o permitir una transición que antes estaba bloqueada.

El objetivo no es comprobar que cualquier cambio de texto haga fallar la compilación. Queremos saber si una modificación de comportamiento reconocible provoca una expectativa fallida. Por eso distinguimos un mutante detectado por aserciones de un archivo que ni siquiera se pudo importar.

Aquí usamos tres variantes seleccionadas a mano en las clases del laboratorio. No instalamos un motor que reescriba automáticamente todas las expresiones, como **Stryker**. Las variantes existen solo para el ejercicio y no se seleccionan desde un endpoint público.

<img src="/assets/visuals/property-testing/PBT-MUTATION.svg" alt="La variante que duplica una captura pasa la propiedad débil de estabilidad terminal, pero falla al comparar capturas con el modelo; shrinking obtiene submit, confirm, confirm y se conservan límites de tres mutaciones manuales." width="359" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/PBT-MUTATION.svg).

## Un mutante que sobrevive a una propiedad débil

`duplicate-capture` aumenta el contador cuando recibe una segunda confirmación sobre `succeeded`, pero conserva ese estado. Este test de `tests/mutations.test.mjs` pasa contra la variante defectuosa:

```javascript
  fc.assert(fc.property(sequenceArbitrary, (events) => {
    const payment = new Payment('duplicate-capture')
    for (const event of events) {
      const previous = payment.state
      payment.apply(event)
      if (previous === 'succeeded' || previous === 'failed') assert.equal(payment.state, previous)
    }
  }), { seed: 5702, numRuns: 500 })
```

La regla no es falsa: un terminal debe permanecer estable en este modelo. Es **insuficiente para el defecto que estamos buscando**. Ni siquiera examina `captures`.

Después de la propiedad, el test aplica explícitamente `submit`, `confirm`, `confirm` y comprueba que la variante deja dos capturas. Así no atribuimos la supervivencia únicamente a que el generador no recorriera ese caso. El caso defectuoso satisface la regla débil por su propio significado.

No hay que desechar toda propiedad que no detecte todos los errores. Hay que saber qué protege y acompañarla con otras observaciones. Una expectativa sobre estado no puede sustituir una sobre efectos.

## El modelo fuerte distingue estado y contador

[El modelo de secuencias](/posts/model-based-testing-secuencias-pagos) calcula el estado esperado a partir de una tabla independiente y cuenta cuándo debería producirse una captura. Compara ambos valores después de cada evento.

Con ese oráculo, `late-decline` falla porque el rechazo tardío cambia el estado. `duplicate-capture` falla aunque el estado sea correcto, porque el contador pasa de uno a dos.

La tercera variante cambia la clave entre intentos en [el fixture de respuesta perdida](/posts/fault-injection-respuesta-perdida-propiedades). Su propiedad observa efectos del fake y exige recuperación después de un intento final sin fallo. Puede así detectar un segundo efecto, no solamente que se devolvió una respuesta.

## Exigir el motivo de fallo, no cualquier resultado rojo

Este extracto ejecutado del mismo archivo reúne las tres propiedades. `paymentProperty`, `faultsArbitrary` y `assertRecovery` se importan de los fixtures compartidos:

```javascript
  const properties = [
    paymentProperty('late-decline'),
    paymentProperty('duplicate-capture'),
    fc.property(faultsArbitrary, (faults) => assertRecovery(faults, false)),
  ]
  for (const property of properties) {
    const result = fc.check(property, { seed: 5702, numRuns: 500 })
    assert.equal(result.failed, true)
    assert.ok(result.errorInstance instanceof assert.AssertionError)
    assert.ok(result.counterexample)
  }
```

La suite normal puede quedar verde porque espera y verifica el fallo de cada variante. Eso no significa que las variantes hayan pasado sus propiedades. Significa que el harness comprobó que los oráculos las rechazan por aserciones.

El informe conserva tres contraejemplos reducidos: `submit → confirm → decline`, `submit → confirm → confirm` y un fallo `after-effect` antes del retry final. En la implementación corregida, las propiedades correspondientes pasan.

## Un superviviente exige diagnóstico antes de añadir tests

En un motor automático, un **survived mutant** es un cambio que la suite ejecutada no detectó. Puede señalar una expectativa ausente, una entrada no visitada o un comportamiento equivalente para el contrato observado. No todos se arreglan añadiendo una aserción sobre detalles internos.

Si un cambio ni siquiera compila, hay que clasificarlo aparte. Si un test expira, hay que investigar si el mutante alteró terminación o si falló el entorno. No conviene transformar cualquier problema del runner en evidencia de calidad.

Nuestro superviviente débil sí tiene una explicación concreta: la captura doble es observable y contraria al modelo; faltaba comparar el contador. No necesitamos una regla artificial para subir un porcentaje. Necesitamos comprobar un efecto que al usuario le importaría.

## Por qué no publicamos un mutation score global

Detectamos las tres variantes elegidas. Decir «100 % de mutation score» escondería que fuimos nosotros quienes escogimos esos tres cambios y que no recorrimos sistemáticamente el resto del código.

No hemos generado mutaciones del parser, del reparto o de todas las condiciones de concurrencia. Tampoco hay análisis de coverage por mutante. La evidencia útil es más concreta: qué cambio introdujimos, qué oráculo lo detectó y cuál dejó pasar una propiedad débil.

Un motor como Stryker puede ampliar el conjunto y ofrecer clasificación y métricas. No sustituye decidir qué parte del código merece la campaña ni revisar los supervivientes. Sería un siguiente experimento, no una herramienta que este laboratorio haya ejecutado.

## Código completo y pruebas

[Índice de esta entrega](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/pbt-mutation/README.md), [pruebas de mutaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/tests/mutations.test.mjs) y [verificación reproducible](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/scripts/verify.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing verify
pnpm --dir packages/property-testing typecheck
```

## Garantías y límites

La suite completa tiene quince tests, incluidas las propiedades, regresiones y búsquedas negativas. El informe guarda seeds, paths, trazas y hashes de las fuentes ejecutadas. No contamos cada entrada generada como un test independiente ni sumamos repeticiones como más cobertura.

Las tres mutaciones son manuales. No hay campaña Stryker, fuzzing guiado por cobertura, crash real, proveedor remoto o demostración formal. El tipo de un error ayuda a evitar falsos positivos, pero el contraejemplo y la regla también necesitan revisión humana.

## Ejercicio: explicar el superviviente antes de corregirlo

Elige una propiedad del reparto y elimina una de sus aserciones. Diseña un cambio de implementación que pase las restantes y viole el contrato. Escribe una entrada concreta que lo evidencie; después decide si necesitas ampliar el oráculo, el generador o ambos.

Si puedes explicar esa diferencia, el siguiente aumento de `numRuns` tendrá un propósito. Para consultar el recorrido completo, vuelve a [propiedades y generadores](/posts/property-based-testing-generadores-invariantes). La siguiente serie estudiará carga y profiling: detectar un error funcional no mide cuánto tráfico puede soportar un servicio.

## Referencias

- [Stryker: estados de mutantes y métricas](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/).
- [fast-check: parámetros e informes de ejecución](https://fast-check.dev/docs/api/interfaces/Parameters/).

Fuentes consultadas el 22 de octubre de 2026. Las variantes y resultados pertenecen al laboratorio local con fast-check 4.10.2.
