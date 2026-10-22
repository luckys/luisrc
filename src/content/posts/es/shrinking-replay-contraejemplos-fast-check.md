---
id: PBT-SHRINK
title: 'Shrinking y replay: convertir una secuencia aleatoria en una regresión pequeña'
published: 2026-10-22T09:01:00Z
locale: es
translationKey: property-testing-shrinking
slug: shrinking-replay-contraejemplos-fast-check
draft: true
status: draft
level: intermedio
prerequisites: [P057]
description: 'Encuentra un rechazo atrasado, reduce la secuencia con fast-check y repítela con seed y path. Conserva después un test de regresión que no necesite generación.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, shrinking, replay, fast-check]
---

El generador ha encontrado un fallo, pero el informe contiene veinte eventos. ¿Importan todos? Corregir el código mirando esa lista completa puede llevarnos a culpar al evento equivocado.

El **shrinking** intenta reducir la entrada manteniendo el fallo. En nuestro laboratorio deja una secuencia de tres eventos: enviar una operación, confirmar su éxito y recibir después un rechazo atrasado. Con esa secuencia ya podemos explicar qué regla se rompió.

Conviene haber leído [propiedades y generadores](/posts/property-based-testing-generadores-invariantes). Ahora nos centraremos en el recorrido desde un fallo generado hasta una regresión que cualquiera pueda ejecutar.

## El fallo intencionado: un evento tardío borra el éxito

`Payment` es una máquina pequeña en memoria. Empieza en `created`, pasa a `processing` con `submit` y termina en `succeeded` o `failed`. Después de un terminal, los eventos de este ejercicio no deben cambiarlo.

La variante didáctica `late-decline` introduce un error: permite que `decline` convierta `succeeded` en `failed`. No es código descubierto en un servicio de producción. Es un defecto deliberado para comprobar si nuestra búsqueda lo encuentra y si sabemos conservar su regresión.

El generador construye arrays de hasta cuarenta eventos. El oráculo contrasta estado y contador de capturas después de cada uno. Explicaremos ese modelo en la siguiente entrega; aquí interesa lo que devuelve la búsqueda.

<img src="/assets/visuals/property-testing/PBT-SHRINK.svg" alt="La búsqueda con seed 5702 encuentra un fallo en la sexta ejecución; cuatro reducciones lo dejan en submit, confirm y decline, se repite con seed y path y se conserva como regresión explícita." width="305" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/PBT-SHRINK.svg).

## Qué reduce fast-check y qué no promete

Para un array, reducir puede significar quitar elementos y simplificar sus valores. Cada candidato debe seguir haciendo fallar la propiedad. Si eliminar `submit` impide alcanzar `processing`, ese candidato ya no reproduce nuestro defecto y no se conserva.

El resultado depende del **arbitrary**, de su estrategia y del predicado. No debemos traducir «shrunk» como «mínimo global demostrado». El framework encuentra un contraejemplo reducido según esa búsqueda; no enumera necesariamente todas las entradas menores posibles.

En este caso concreto, además podemos razonar sobre los tres pasos: sin enviar no se confirma, sin confirmar no hay éxito que borrar y sin rechazar no aparece la transición incorrecta. Esa explicación humana añade algo que un contador de reducciones no aporta.

## Capturar el resultado sin confundir un fallo esperado con éxito

`fc.assert` lanza cuando encuentra un contraejemplo. Para un test que estudia una variante defectuosa usamos `fc.check`, que devuelve los detalles. **Que `check` devuelva un objeto no significa que la propiedad haya pasado**: debemos inspeccionar `failed`.

Extracto de `tests/search.test.mjs`:

```javascript
  const failure = fc.check(paymentProperty('late-decline'), { seed: 5702, numRuns: 500 })
  assert.equal(failure.failed, true)
  assert.ok(failure.errorInstance instanceof assert.AssertionError)
  assert.ok(failure.numShrinks > 0)
  assert.deepEqual(failure.counterexample, [['submit', 'confirm', 'decline']])
```

La comprobación del tipo de error evita dar por detectado el defecto si falló algo ajeno, como un módulo ausente. El contenido del contraejemplo confirma además qué comportamiento estamos observando.

Con las fuentes y versiones archivadas, la búsqueda falla en su sexta ejecución y acepta cuatro reducciones. Guarda seed `5702` y path `5:3:6:7:6`. Son resultados de este laboratorio, no valores que deban aparecer en cualquier versión del framework.

El array exterior del contraejemplo representa los argumentos de la propiedad. Como recibe un argumento que es una secuencia, obtenemos un array dentro de otro. Confundirlos produce un replay de una entrada distinta.

## Replay necesita algo más que recordar la seed

La **seed** inicia la generación; el **path** identifica el recorrido hasta el contraejemplo reducido. Este extracto repite el resultado de la búsqueda anterior:

```javascript
  const replay = fc.check(paymentProperty('late-decline'), {
    seed: failure.seed, path: failure.counterexamplePath, endOnFailure: true,
  })
  assert.equal(replay.failed, true)
  assert.deepEqual(replay.counterexample, failure.counterexample)
```

`endOnFailure` detiene esa reproducción en el fallo, sin iniciar otra reducción. El test exige que la entrada repetida coincida con la guardada.

Hay que conservar también versión, definición del generador y predicado. Si cambiamos el orden de alternativas o añadimos un campo generado, el mismo par seed/path puede dejar de identificar el recorrido anterior. El **lockfile** y los hashes de las fuentes ayudan a saber qué se ejecutó.

Nuestro generador utiliza arrays normales. Si pasáramos a `fc.commands`, su replay tiene información adicional, `replayPath`, que recoge qué comandos se ejecutaron. No copiemos esta receta de arrays como si cubriera todos los arbitraries del framework.

## La regresión explícita sobrevive a los cambios del generador

Después del replay conservamos un test escrito a mano: construir `Payment`, aplicar `submit`, `confirm`, `decline` y exigir estado `succeeded` y una captura. El mismo caso falla con la variante defectuosa y pasa con la implementación corregida.

Ese test ya no depende de la seed. Explica por qué no se puede borrar un éxito cuando llega un rechazo atrasado y seguirá siendo útil si mañana cambiamos los generadores.

No eliminamos por ello la propiedad. La regresión protege el fallo conocido; la generación sigue buscando otros recorridos, como una confirmación duplicada. Mantener ambas evita elegir entre una prueba fácil de leer y una búsqueda más amplia.

## Código completo y pruebas

[Archivos de esta entrega](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/pbt-shrink/README.md) y [evidencia con seed, path y fuentes](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/evidence/verification.json).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing verify
```

`verify` ejecuta la suite, repite búsquedas y solo escribe la evidencia después de que pasen las expectativas. El informe no convierte un error de infraestructura en un hallazgo de negocio.

## Garantías y límites

Hemos ejecutado reducción y replay de esta variante, no solo mostrado un informe inventado. El resultado depende de un modelo de una operación y eventos síncronos en memoria. No reproduce llegadas reales de webhooks, procesos o bases de datos.

Una búsqueda finita sin fallos tampoco prueba que no existan. Y una búsqueda que falla necesita revisión: podría señalar un error del producto, del generador o de la expectativa. El trabajo no termina al ver rojo.

## Ejercicio: conservar la entrada sin conservar el generador

Cambia `maxLength` de cuarenta a veinte y vuelve a ejecutar la propiedad. No exijas que el path siga siendo idéntico. Exige, en cambio, que la regresión explícita de tres eventos mantenga su significado. Si otra secuencia aparece, comprueba primero qué regla viola.

La siguiente entrega explica [cómo construir el modelo que compara cada evento](/posts/model-based-testing-secuencias-pagos) sin llamar a la implementación para calcular el resultado esperado.

## Referencias

- [fast-check: parámetros seed, path y endOnFailure](https://fast-check.dev/docs/api/interfaces/Parameters/).
- [fast-check: ejemplos guardados y reducción](https://fast-check.dev/docs/configuration/user-definable-values/).
- [fast-check: replay de comandos de modelo](https://fast-check.dev/docs/advanced/model-based-testing/).

Fuentes consultadas el 22 de octubre de 2026. Resultados de fast-check 4.10.2.
