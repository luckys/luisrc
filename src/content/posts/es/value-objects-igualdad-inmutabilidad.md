---
id: DOMAIN-VALUES
title: 'Value Objects: comparar valores y evitar estados inválidos'
published: 2026-10-20T09:03:00Z
locale: es
translationKey: domain-value-objects
slug: value-objects-igualdad-inmutabilidad
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-ENTITIES]
description: 'Construye un Money en TypeScript para entender igualdad por valor, inmutabilidad y validación. Explica sus límites numéricos y por qué equals no cambia la semántica de Map.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, value-object, typescript, inmutabilidad, testing]
---

Una función recibe `amount: number`. Otra lo interpreta en euros y una tercera en céntimos. El tipo coincide en todas las llamadas, pero el significado no. Añadir un comentario ayuda hasta que alguien reutiliza el número fuera de ese contexto.

Un **Value Object** puede reunir el dato con las condiciones que lo hacen válido y las operaciones que tienen sentido sobre él. Vamos a construir `Money`, no para tener otra clase, sino para impedir que cantidad y moneda se separen sin querer.

Venimos de [entidades e identidad](/posts/entidades-identidad-ciclo-vida). Ahora cambia la pregunta: si dos objetos representan 5 euros, ¿necesitamos distinguir su historia o nos basta con saber que tienen el mismo valor?

## Qué significa igualdad por valor

Un **Value Object** representa un valor definido por sus componentes relevantes. En nuestro ejemplo son el importe en unidades menores y la moneda. `500 EUR` equivale a otro `500 EUR`, aunque se hayan construido por separado. No equivale a `500 USD`.

Ese criterio contrasta con la identidad de una entidad. Dos pagos de 5 euros siguen siendo pagos diferentes. Una copia equivalente de su importe, en cambio, puede sustituir al valor anterior sin cambiar cuánto dinero representa.

[Martin Fowler explica esta diferencia entre referencia y valor](https://martinfowler.com/bliki/ValueObject.html). En nuestro código la haremos explícita mediante `equals`, porque los objetos de JavaScript no cambian automáticamente su forma de compararse por tener los mismos campos.

## Primero decide la representación y sus límites

Utilizamos enteros en **unidades menores**: `500` representa 5,00 euros. Solo admitimos EUR y USD, ambos con dos decimales en este ejercicio. No es una librería monetaria universal.

El tipo `Currency` es `'EUR' | 'USD'`. La cantidad debe ser un entero seguro no negativo. No representamos impuestos, tipos de cambio, redondeo o importes negativos. Si aparecen esas necesidades, habrá que revisar el modelo y sus operaciones.

Esta elección evita usar fracciones binarias para almacenar los importes del ejemplo. No convierte `number` en precisión ilimitada: seguimos dentro del rango seguro del lenguaje.

<img src="/assets/visuals/domain-design/DOMAIN-VALUES.svg" alt="Dos instancias Money con 500 y EUR son iguales por valor; sumar crea un Money nuevo sin cambiar los anteriores, mientras una moneda distinta o un importe inseguro se rechaza." width="259" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/domain-design/DOMAIN-VALUES.svg).

## Construye un valor válido y mantenlo válido

Archivo: `packages/domain-design/src/domain.ts`, clase `Money`.

```typescript
export class Money {
  readonly #minor: number
  readonly #currency: Currency

  constructor(minor: number, currency: Currency) {
    if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('invalid minor units')
    if (currency !== 'EUR' && currency !== 'USD') throw new Error('unsupported currency')
    this.#minor = minor
    this.#currency = currency
  }

  get minor(): number {
    return this.#minor
  }
  get currency(): Currency {
    return this.#currency
  }

  equals(other: Money): boolean {
    return this.minor === other.minor && this.currency === other.currency
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('currency mismatch')
    return new Money(this.minor + other.minor, this.currency)
  }
}
```

El constructor rechaza negativos, fracciones, `NaN`, infinitos y enteros inseguros. La moneda se comprueba también en ejecución: el tipo TypeScript no detiene una llamada desde JavaScript con otro string.

`equals` compara los dos componentes que definen el valor. `add` exige la misma moneda y construye otro `Money`. Al pasar otra vez por el constructor, una suma fuera del rango seguro se rechaza en lugar de conservar un importe impreciso.

Los campos `#minor` y `#currency` no son accesibles desde fuera. Los getters permiten leerlos y no hay setters. En este modelo no hay una operación que cambie un importe ya construido.

## Por qué la inmutabilidad importa más que ahorrar una instancia

Supón que dos líneas de un pedido comparten la referencia al mismo precio. Si una función modifica ese objeto para aplicar un descuento, podría cambiar también el precio que observa la otra línea.

Devolver un valor nuevo evita ese cambio lateral. Quien necesite conservar el importe anterior puede seguir utilizando la misma referencia sin coordinarse con quien calcula el siguiente.

No hace falta usar `Object.freeze` para cada estructura por costumbre. Lo importante es qué estado puede cambiar a través de la API y de sus referencias internas. Un `freeze` superficial sobre un objeto con un array editable no hace inmutable ese array. Nuestro `Money` solo guarda dos primitivos privados.

Crear valores nuevos tiene un coste. Aquí son objetos pequeños y no hemos medido que esa asignación sea un problema. No hay motivo para sacrificar claridad basándose en una supuesta mejora de rendimiento no comprobada.

## equals no cambia cómo funcionan Map o Set

Un error frecuente consiste en escribir `equals` y asumir que todas las colecciones lo utilizarán. No ocurre así con `Map` para claves que son objetos: una instancia distinta sigue siendo una clave distinta.

Archivo: `packages/domain-design/tests/concepts.test.mjs`, extracto.

```javascript
const first = new Money(500, 'EUR')
const second = new Money(500, 'EUR')
assert.ok(first.equals(second))
assert.equal(new Map([[first, 'price']]).has(second), false)
assert.equal(first.add(new Money(100, 'EUR')).minor, 600)
assert.equal(first.minor, 500)
```

Las dos primeras aserciones expresan criterios distintos, no una contradicción. El test también comprueba que sumar no altera el valor original.

Si necesitamos agrupar por valor, podemos diseñar una clave canónica para este dominio o recorrer y comparar explícitamente un conjunto pequeño. La elección depende del acceso. No basta con llamar `Value Object` a la clase para cambiar la [semántica de las claves de Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).

## Validar una representación no decide todas las reglas del negocio

El cero es válido para `Money`: sirve para un saldo o un acumulado. Una solicitud de reembolso de cero se rechaza en la operación de `Payment`, no en todo importe monetario posible.

Esa separación evita convertir el objeto en un contenedor de todas las políticas. El valor protege su representación y operaciones; el caso concreto añade las condiciones que le corresponden.

También falta validar entradas externas. El constructor espera una cantidad y una moneda, no un JSON arbitrario ni el string localizado `"5,00 €"`. Un parser debe decidir cómo interpretar ese formato antes de construir el objeto. No hacemos coerciones silenciosas para que una entrada incorrecta «pase».

## Cuándo merece la pena y cuándo basta un dato sencillo

Un Value Object aporta valor si concentra validaciones repetidas, evita mezclar unidades o da nombre a operaciones con significado. Un intervalo de fechas o una cantidad con unidad pueden tener razones parecidas.

No hace falta envolver todo string. Un DTO de transporte puede seguir siendo una estructura sencilla. Una abstracción que solo añade getters sin proteger ninguna condición ni aclarar el significado puede aumentar trabajo sin resolver un problema.

Otra alternativa es un tipo opaco con funciones constructoras y operaciones puras. La clase es una opción para encapsular; el concepto no depende de esa sintaxis ni exige una interfaz `IMoney`.

## Código completo y pruebas

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-values/README.md) y el [archivo de Money](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/domain.ts). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
```

Además de igualdad e inmutabilidad, los tests prueban monedas distintas, cantidades no finitas, fracciones y una suma fuera del rango seguro.

## Garantías y límites

`Money` representa cantidades válidas según este contrato y no modifica sus componentes mediante su API. No representa todas las monedas, no convierte divisas y no demuestra que un pago exista o esté autorizado.

La protección se aplica a las instancias construidas correctamente y utilizadas por el código del modelo. No sustituye validación de DTOs, controles de acceso ni reglas transaccionales. Una colección tampoco adquiere igualdad por valor automáticamente.

## Ejercicio: una resta con contrato explícito

Añade `subtract` sin permitir resultados negativos. Debe aceptar restar 200 a 500 EUR y crear 300 EUR, rechazar otra moneda y rechazar restar 600. Los dos operandos deben conservar su valor original después de cada intento.

Seguimos con [agregados e invariantes](/posts/value-objects-agregados-invariantes): los importes ya son válidos, pero aún necesitamos decidir quién impide reservar más de lo que se ha cobrado.

## Referencias

- [Martin Fowler: Value Object](https://martinfowler.com/bliki/ValueObject.html).
- [MDN: claves y comparación de Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).
- [TypeScript: clases y campos privados](https://www.typescriptlang.org/docs/handbook/classes.html).

Fuentes consultadas el 20 de octubre de 2026. Node 24.19.0 y TypeScript 5.9.2; sin benchmark de asignaciones o rendimiento monetario.
