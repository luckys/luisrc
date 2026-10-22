---
id: P057
title: 'Property-based testing: escribir reglas y generar ejemplos que importan'
published: 2026-10-22T09:00:00Z
locale: es
translationKey: property-testing-generators
slug: property-based-testing-generadores-invariantes
draft: true
status: draft
level: intermedio
prerequisites: [P055, INT-FIXTURES]
description: 'Diseña propiedades y generadores con fast-check. Reparte importes sin perder céntimos y distingue una regla útil de una afirmación que pasa por accidente.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, property-based-testing, typescript, fast-check]
---

Repartir cinco céntimos entre dos destinatarios parece un detalle. Si redondeamos cada mitad a tres, acabamos entregando seis. Una prueba con cien céntimos entre dos no encuentra el problema, aunque pase siempre.

Necesitamos comprobar una regla: **repartir no debe crear ni perder dinero**. Después podemos pedirle a una herramienta que busque importes y cantidades de destinatarios que la contradigan.

Esta serie continúa el diseño de tests y [las fixtures deterministas](/posts/fixtures-factories-datos-prueba-deterministas). Está pensada para quien ya escribe tests con ejemplos y quiere explorar entradas, secuencias y órdenes de ejecución que todavía no ha imaginado. El laboratorio utiliza **TypeScript**, **Node.js** y **fast-check 4.10.2**; las ideas no dependen de ese lenguaje.

## Qué cambia con property-based testing

Un **example-based test** escoge entrada y resultado: `splitAmount(5, 2)` debe devolver `[3, 2]`. Es corto y explica una decisión, incluido quién recibe el céntimo sobrante.

Una **property** expresa una relación que debería cumplirse para todas las entradas admitidas: la suma de las partes debe ser el total. El framework produce ejemplos e intenta encontrar uno que incumpla esa relación. Eso no convierte una ejecución finita en una demostración matemática.

La división del trabajo importa. Tú decides **qué significa correcto** y qué entradas pertenecen al dominio. La herramienta varía esas entradas. Si la regla es incompleta, puede generar miles de casos sin comprobar el aspecto que estaba roto.

<img src="/assets/visuals/property-testing/P057.svg" alt="Una regla de conservación define un generador de importes y cantidades de partes; splitAmount se contrasta con suma, longitud, enteros y equilibrio durante quinientos casos, sin prometer exhaustividad." width="340" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/P057.svg).

## Definir el dominio antes del generador

Trabajaremos en **minor units**, céntimos en este ejercicio. Admitimos totales enteros de uno a un millón y entre una y veinte partes. Una parte puede recibir cero: repartir un céntimo entre tres destinatarios debe ser posible, aunque dos reciban cero.

Esos límites son decisiones del ejemplo, no límites universales de un pago. Acotan el coste de ejecutar el test y mantienen toda la aritmética dentro del rango seguro de enteros de JavaScript, donde se ejecuta este TypeScript.

Archivo `src/money.ts`:

```typescript
export function splitAmount(total: number, parts: number): number[] {
  amountMinor(total)
  if (!Number.isInteger(parts) || parts < 1 || parts > 20) throw new RangeError('parts')
  const base = Math.floor(total / parts)
  const remainder = total % parts
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}
```

`amountMinor`, disponible en el mismo archivo, valida el total también en ejecución. El tipo `number` no excluye `NaN`, decimales o infinitos. La anotación ayuda al compilador; no reemplaza esa comprobación.

El cociente entero da una base común. Los primeros `remainder` destinatarios reciben un céntimo adicional. No redondeamos cada fracción de manera independiente. Para cinco y dos, la base es dos y sobra uno: obtenemos tres y dos.

## Un generador constructivo evita descartar casi todo

El **generator** describe las entradas que queremos visitar. En fast-check se utiliza un **arbitrary**, que incorpora generación y una estrategia para reducir entradas cuando aparece un fallo, el **shrinking**.

No generamos cualquier número para después descartar todos los que no sean enteros positivos pequeños. Construimos directamente el dominio mediante `integer({ min, max })`. Así cada ejecución aporta un caso útil.

Extracto ejecutado de `tests/properties.test.mjs`, con `fc` importado de `fast-check` y `assert` de `node:assert/strict`:

```javascript
  const pair = fc.record({
    total: fc.integer({ min: 1, max: 1_000_000 }),
    parts: fc.integer({ min: 1, max: 20 }),
  })
  fc.assert(fc.property(pair, ({ total, parts }) => {
    const result = splitAmount(total, parts)
    assert.equal(result.length, parts)
    assert.equal(result.reduce((sum, value) => sum + value, 0), total)
    assert.ok(result.every((value) => Number.isInteger(value) && value >= 0))
    assert.ok(Math.max(...result) - Math.min(...result) <= 1)
  }), { seed: 5701, numRuns: 500 })
```

`record` combina los generadores. `property` los une al predicado y `assert` ejecuta la búsqueda. Una aserción fallida permite al framework intentar reducir el caso. La **seed** fija facilita repetir la exploración con el mismo código y versión.

No hay que evitar siempre `.filter` o `fc.pre`: sirven cuando una precondición no se expresa de otra manera sencilla. Pero una condición que descarta casi todo encarece la búsqueda y puede dejarla sin suficientes ejemplos admitidos. Aquí no necesitamos relacionar `parts <= total`, porque los repartos con ceros son válidos.

## Cuatro comprobaciones que se complementan

La suma por sí sola no basta: devolver `[total]` conserva dinero, pero no respeta el número de destinatarios. Devolver `[total, 0, 0]` tampoco reparte de manera equilibrada si había tres.

Por eso comprobamos **longitud**, **conservación**, **enteros no negativos** y **equilibrio**. Esta última regla exige que la diferencia entre la parte mayor y la menor no supere un céntimo.

El oráculo no vuelve a calcular el cociente ni el resto para comparar dos copias del mismo algoritmo. Comprueba consecuencias observables del contrato. Aun así, no fija a quién corresponde el sobrante. El ejemplo explícito `[3, 2]` conserva esa decisión de orden. No sustituimos los tests concretos: los acompañamos.

## Las entradas inválidas necesitan sus propias expectativas

El generador anterior nunca produce cero como total. Sería incorrecto afirmar que sus quinientas ejecuciones verifican el rechazo de cero.

La suite añade ejemplos para cero, negativos, decimales, `NaN`, `Infinity`, un valor por encima del máximo y un string. Todos deben lanzar `RangeError` al validar el importe. Esa expectativa expresa qué ocurre fuera del dominio; no se obtiene aumentando `numRuns` del generador válido.

Al mantener separados ambos contratos, el fallo se entiende mejor: o repartimos mal una entrada admitida o aceptamos algo que debíamos rechazar.

## Código completo y pruebas

[Código y comandos de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p057/README.md). El [archivo de pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/tests/properties.test.mjs) mantiene imports y ejemplos de frontera.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing test
pnpm --dir packages/property-testing typecheck
```

## Garantías y límites

La propiedad del reparto pasa quinientos casos con seed `5701`. Esto no mide rendimiento ni demuestra que todo reparto posible funcione. Tampoco comprueba reglas de divisas, persistencia o transferencias reales.

Una seed fija hace estable esta exploración, pero no descubre entradas nuevas en cada ejecución. Podemos añadir campañas con otras seeds y conservar los contraejemplos encontrados. Cambiar silenciosamente las condiciones hasta que el test pase sería ocultar el fallo.

## Ejercicio: distinguir dos implementaciones incorrectas

Prueba una variante que devuelva una sola parte y otra que redondee todas las partes hacia arriba. Antes de ejecutarlas, escribe qué aserción debería detectar cada una. Si ambas fallan por un error de importación, todavía no has probado ninguna propiedad del reparto.

El siguiente paso es [reducir una secuencia defectuosa y reproducirla](/posts/shrinking-replay-contraejemplos-fast-check), para que el informe no termine siendo una lista incomprensible de eventos.

## Referencias

- [fast-check: properties y predicados](https://fast-check.dev/docs/core-blocks/properties/).
- [fast-check: arbitraries, generación y reducción](https://fast-check.dev/docs/core-blocks/arbitraries/).

Fuentes consultadas el 22 de octubre de 2026. Código ejecutado con fast-check 4.10.2 y Node.js 24.19.0.
