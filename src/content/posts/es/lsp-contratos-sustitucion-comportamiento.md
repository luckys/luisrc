---
id: DESIGN-LSP
title: 'LSP: tener la misma firma no garantiza el mismo contrato'
published: 2026-10-21T09:02:00Z
locale: es
translationKey: design-lsp-contracts
slug: lsp-contratos-sustitucion-comportamiento
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-OCP]
description: 'Prueba sustituciones con el mismo tipo TypeScript y comportamientos incompatibles. Trabaja precondiciones, poscondiciones y efectos con una suite de contrato reutilizable.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, solid, lsp, contratos, typescript, testing]
---

Sustituimos una función de tarifas por otra y TypeScript no protesta. Sin embargo, los envíos de más de un kilo empiezan a fallar aunque el sistema acepte paquetes de hasta veinte. El tipo coincide; el comportamiento prometido no.

Ese es el problema que nos interesa al hablar de **Liskov Substitution Principle**, o **LSP**: qué puede asumir un consumidor cuando utiliza una implementación a través de un contrato.

En [OCP y composición](/posts/ocp-composicion-extension-tarifas) creamos una variación de la tarifa. Ahora comprobaremos por qué esa extensión debe respetar algo más que `(shipment) => number`.

## Qué significa poder sustituir una implementación

La formulación de **behavioral subtyping** de [Barbara Liskov y Jeannette Wing](https://dspace.mit.edu/entities/publication/478b67b0-b753-4a20-be80-75424e48757b) estudia la sustitución preservando propiedades del comportamiento. La aplicación práctica aquí es comprobar que un consumidor no tenga que descubrir qué implementación recibió para tratar excepciones imprevistas.

El ejemplo usa funciones, no una jerarquía de clases. No es una demostración formal de subtipado, pero permite observar el mismo problema de sustitución a través de una abstracción.

Tampoco esperamos que todas las implementaciones produzcan el mismo precio. Una tarifa base y otra con recargo existen precisamente para calcular importes distintos. Lo que comparten es el dominio admitido, las unidades del resultado y las condiciones que el consumidor puede dar por válidas.

## Escribe las precondiciones y las poscondiciones

Una **precondition** es lo que debe cumplirse antes de llamar. Para `RateRule` exigimos un `Shipment` ya validado: subtotal entero entre 0 y 1000000000, peso entero de 1 a 20000 gramos y zona `local` o `remote`.

Una **postcondition** es lo que se garantiza al terminar. La tarifa devuelve céntimos de EUR como entero entre 0 y 1000000000, sin cambiar la entrada. En este ejercicio también debe ser determinista para esos datos y no depender de red o almacenamiento.

Si otra tarifa necesita que el peso no supere 1000 gramos, ha añadido una precondición más exigente. Un consumidor que antes podía enviar 1500 ya no puede hacerlo. Si devuelve `-1` para indicar «sin tarifa», debilita la poscondición: el consumidor esperaba un importe válido, no un código especial.

No estamos diciendo que ningún sistema de precios pueda rechazar un envío. Podría existir otro contrato con un resultado explícito `quoted | unsupported`. Pero ese sería otro acuerdo y sus consumidores tendrían que manejarlo. No podemos introducirlo silenciosamente en una función que promete un número válido.

## Un ejemplo que compila y aun así es incompatible

Archivo: `packages/design-principles/src/type-examples.ts`, extracto. `RateRule` se importa desde `rates.ts`.

```typescript
export const lightOnly: RateRule = (shipment) => {
  if (shipment.weightGrams > 1000) throw new Error('too heavy')
  return 500
}
```

TypeScript comprueba que el parámetro y el resultado son compatibles. No deduce de esa firma que toda entrada válida deba completarse sin esa excepción. La [documentación sobre type compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) describe cómo se relacionan los tipos, no garantiza todas las propiedades semánticas de nuestras funciones.

`lightOnly` podría ser una función perfectamente válida en otro contexto. El problema es presentarla como sustituta dentro de este contrato más amplio.

Otro error sería devolver euros como `5` cuando el contrato pide céntimos como `500`. Seguiría siendo un `number`. Los nombres de unidades, los tipos específicos cuando aporten valor y los tests ayudan a hacer visible ese desacuerdo.

## Una suite de contrato ejecutada para cada candidato

Archivo completo: `packages/design-principles/tests/rate-contract.mjs`.

```javascript
import assert from 'node:assert/strict'

export function assertRateContract(rate) {
  for (const zone of ['local', 'remote'])
    for (const weightGrams of [1, 1000, 1001, 20000])
      for (const subtotalMinor of [0, 4999, 5000]) {
        const input = Object.freeze({ zone, weightGrams, subtotalMinor })
        const first = rate(input)
        assert.ok(Number.isSafeInteger(first) && first >= 0 && first <= 1_000_000_000)
        assert.equal(rate(input), first)
      }
}
```

Son 24 combinaciones por implementación. Incluimos 1000 y 1001 porque queremos distinguir una tarifa válida para todo el rango de otra que introduce el límite de un kilo. Incluimos 4999 y 5000 por el cambio al envío gratuito.

El objeto congelado hace fallar un intento ordinario de modificar sus propiedades en estos módulos JavaScript. La segunda ejecución contrasta que el resultado se repita para la misma entrada. No demuestra determinismo para todas las llamadas posibles ni detecta cualquier efecto externo.

<img src="/assets/visuals/design-principles/DESIGN-LSP.svg" alt="El contrato admite envíos de hasta 20000 gramos; standardRate pasa la matriz de contrato y lightOnly falla con 1001 gramos, una entrada válida que su firma TypeScript acepta." width="390" height="430" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/DESIGN-LSP.svg).

En los tests del laboratorio se ejecuta la suite contra `standardRate` y su variante con recargo. Ambas pasan. También se prueba que la suite detecta tres candidatos malos: rechazo por peso, importe negativo y mutación de entrada.

Estos últimos tests pasan cuando detectan el defecto esperado. No se deja una suite rota ni se omite el caso incompatible para que el informe quede verde.

## Los tests de contrato no sustituyen los de cada política

Una función que siempre devolviera 42 podría cumplir las condiciones representacionales y pasar esta suite. No implementaría las tarifas comerciales esperadas.

Por eso mantenemos pruebas específicas de la tarifa: local cuesta 500, remote cuesta 900 y desde el umbral cuesta 0. Para el recargo comprobamos 700 y el caso de base gratuita más 200.

La suite compartida responde «¿respeta las expectativas comunes?». Las pruebas particulares responden «¿implementa esta política?». Usar solo una de las dos deja errores sin cubrir.

También falta comprobar algunos efectos mediante diseño e inspección. Una tarifa podría consultar un reloj o escribir en un log global sin que estas aserciones lo detectasen. No presentamos el helper como un verificador universal de pureza.

## Si el contrato no encaja, cambia la abstracción

Podemos separar un contrato para cotizar paquetes ligeros o ampliar el resultado para representar indisponibilidad. La elección depende de qué necesita el consumidor, no de mantener a toda costa un tipo común.

Una adaptación también puede servir si conserva el significado. Por ejemplo, convertir unidades de una respuesta antes de devolverla. No serviría fabricar un precio cero cuando el proveedor rechaza un paquete: ocultaría un fallo como una oferta gratuita.

Evita arreglar el problema con comprobaciones del tipo «si es la implementación ligera, hago otra cosa». Esa rama en el consumidor muestra que la sustitución dejó de ser transparente y distribuye el conocimiento de cada variante.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-lsp/README.md), la [suite de contrato](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/tests/rate-contract.mjs) y el ejemplo que compila pero falla semánticamente.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
```

## Garantías y límites

La matriz detecta los defectos introducidos en estos fixtures y comprueba un subconjunto elegido del contrato. No es una prueba formal de LSP ni una exploración exhaustiva de todas las entradas y efectos.

No hay adaptadores remotos ni se han probado timeouts o tarifas de proveedores. Una interfaz real podría necesitar errores recuperables, caducidad y moneda explícita. Eso debe formar parte de su contrato antes de declarar dos adaptadores intercambiables.

## Ejercicio: una tarifa válida pero comercialmente incorrecta

Añade una función que siempre devuelva 42. Comprueba que pasa el helper y falla los tests de la tarifa normal. Después introduce una que cambie el resultado a partir de la llamada 49. El helper hace 48 llamadas por implementación: escribe otro test que haga visible el cambio que esa ejecución de la matriz no alcanza.

Continúa con [ISP y capacidades por consumidor](/posts/isp-interfaces-consumidor-capacidades). El siguiente problema no es cómo se comporta una operación, sino cuántas operaciones obligamos a conocer a quien solo necesita una.

## Referencias

- [Barbara Liskov y Jeannette Wing: Family Values, A Behavioral Notion of Subtyping, registro del MIT](https://dspace.mit.edu/entities/publication/478b67b0-b753-4a20-be80-75424e48757b).
- [TypeScript: Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html).
- [Node.js: test runner](https://nodejs.org/api/test.html).

Fuentes consultadas el 21 de octubre de 2026. Los ejemplos y la matriz son del laboratorio; no reproducen una verificación formal del trabajo académico.
