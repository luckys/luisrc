---
id: DESIGN-OCP
title: 'OCP y composición: añadir una variación sin reescribir la regla base'
published: 2026-10-21T09:01:00Z
locale: es
translationKey: design-ocp-composition
slug: ocp-composicion-extension-tarifas
draft: true
status: draft
level: intermedio
prerequisites: [P043]
description: 'Añade un recargo componiendo funciones en TypeScript. Entiende qué protege OCP, qué sigue cambiando y por qué no exige anticipar un sistema de plugins.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, solid, ocp, composicion, typescript, testing]
---

La tarifa normal sigue siendo válida, pero ahora necesitamos una opción con 200 céntimos de recargo. Podemos introducir otro flag en el cálculo o construir una función que reutilice la tarifa y añada esa diferencia.

Las dos soluciones pueden funcionar. La decisión depende de qué variación estamos intentando aislar, no de si una de ellas tiene más aspecto de patrón de diseño.

En [cohesión y SRP](/posts/cohesion-srp-razones-cambio) separamos la presentación del cálculo. Aquí añadiremos una variación concreta y conservaremos el comportamiento de la tarifa normal.

## Qué propone Open/Closed y qué no promete

**Open/Closed Principle**, u **OCP**, busca que una unidad admita ciertas extensiones sin tener que modificar su comportamiento estable. La palabra importante es «ciertas»: ningún diseño puede quedar protegido frente a cualquier cambio imaginable.

[Robert C. Martin desarrolla la idea mediante sistemas extensibles](https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html). Nuestro alcance es más pequeño: una función que consume una regla de cálculo y otra que construye una variante. No habrá carga dinámica de plugins ni despliegues independientes.

No significa que esté prohibido editar código existente. Corregir una regla equivocada exige cambiarla. Añadir una moneda que el contrato no contempla exige revisar ese contrato. OCP no justifica conservar errores detrás de una interfaz estable.

## Define qué recibe y qué devuelve una tarifa

Archivo: `packages/design-principles/src/rates.ts`, tipos compartidos.

```typescript
export type Shipment = Readonly<{
  subtotalMinor: number
  weightGrams: number
  zone: 'local' | 'remote'
}>
export type Quote = Readonly<{ amountMinor: number; currency: 'EUR' }>
export type RateRule = (shipment: Shipment) => number
```

Una **RateRule** recibe un envío válido y devuelve el importe de los portes en céntimos. No devuelve el subtotal del pedido, no cambia la moneda y no escribe en una base de datos.

En este laboratorio, válido significa subtotal entero entre 0 y 1000000000, peso entero de 1 a 20000 gramos y una de las dos zonas. El resultado debe ser un entero entre 0 y 1000000000. Estos límites se comprueban en ejecución al construir la cotización.

El contrato también espera que la regla no modifique la entrada y que el resultado dependa de esos datos, no de una variable global cambiante. La firma de TypeScript solo expresa parte de esto. La siguiente entrega probará el resto.

## Componer una regla con un recargo

Archivo: `packages/design-principles/src/rates.ts`, extracto. `validAmount` rechaza fracciones, negativos, valores no finitos e importes fuera del rango elegido.

```typescript
export function withSurcharge(base: RateRule, surchargeMinor: number): RateRule {
  validAmount(surchargeMinor)
  return (shipment) => validAmount(validAmount(base(shipment)) + surchargeMinor)
}
```

`withSurcharge` no calcula la tarifa normal. Recibe esa función y devuelve otra que la invoca, comprueba su resultado y añade el recargo. La comprobación exterior evita que dos importes válidos produzcan una suma fuera del límite.

La función devuelta conserva el acceso a `base` y `surchargeMinor` mediante un **closure**. No necesitamos una clase base, una subclase por tarifa ni un contenedor de dependencias.

Esto es **composición**: construimos un comportamiento utilizando otro. Una clase con colaboradores también puede componer; el concepto no depende de usar funciones anónimas.

<img src="/assets/visuals/design-principles/DESIGN-OCP.svg" alt="withSurcharge recibe standardRate y devuelve otra RateRule; quoteWith la ejecuta con datos válidos y comprueba el resultado antes de construir la cotización en EUR." width="299" height="754" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/DESIGN-OCP.svg).

## Decide primero qué significa el recargo sobre un envío gratuito

La tarifa base devuelve 0 cuando el subtotal llega a 5000. Nuestra variante añade 200 incluso en ese caso. Es una decisión ficticia explícita: el beneficio comercial cubre el transporte base, no el recargo de la opción.

Si el requisito fuese «gratuito también con esta opción», sumar después no implementaría la política correcta. Habría que modificar la composición o crear otra regla. Que el código resulte elegante no valida la interpretación comercial.

Los tests esperan 700 para un envío local de subtotal 3000, 500 para la regla normal con esos mismos datos y 200 para la variante con subtotal 5000. Así hacemos visible una consecuencia que podría pasar desapercibida al leer solo el nombre `withSurcharge`.

Tampoco asumimos que el orden de composiciones sea irrelevante. Sumar dos recargos puede coincidir en ambos órdenes, pero limitar un precio, aplicar un descuento o redondear puede cambiar el resultado. Si introducimos esas operaciones, habrá que especificar su orden y probarlo.

## El consumidor permanece igual; la conexión sí cambia

Archivo: `packages/design-principles/src/rates.ts`, extracto.

```typescript
export function quoteWith(rate: RateRule, shipment: Shipment): Quote {
  const valid = parseShipment(shipment)
  return Object.freeze({ amountMinor: validAmount(rate(valid)), currency: 'EUR' })
}
```

`quoteWith` no necesita saber si recibe la tarifa base o la variante. Conserva su responsabilidad: validar los datos y el importe, ejecutar una regla y producir una cotización.

El código que configura la aplicación sí debe elegir qué función pasar. Hay código nuevo y una conexión distinta. No hemos conseguido añadir una capacidad sin tocar ningún archivo existente; hemos acotado el lugar que debe conocer esa elección.

Además, la entrada que se entrega a la regla es una copia congelada de tres primitivos. `Readonly` ayuda al compilador; `Object.freeze` en el parser impide mutaciones ordinarias de esa instancia en ejecución. Esto no hace seguras funciones arbitrarias que lean archivos o modifiquen otro estado.

## Cuándo dejaría un if y cuándo extraería la variación

Si solo hay una tarifa y una condición local comprensible, un `if` puede ser la mejor solución. Introducir un registro de estrategias para no escribir condiciones puede esconder la regla detrás de configuración innecesaria.

La composición gana interés si la regla base se usa sin recargo y con él, si queremos probar ambas posibilidades con el mismo consumidor o si esa variación aparece en un límite reconocible del sistema.

No crearíamos ahora tipos genéricos para países, impuestos, descuentos acumulables y proveedores que nadie ha pedido. Un punto de extensión útil representa una variación conocida; no sustituye aprender el dominio.

También tiene un coste: para entender el importe final debemos conocer qué funciones se conectaron. Con varias capas de wrappers, localizar la regla puede resultar más difícil que leer un bloque condicional. Mantén la composición visible y evita anidaciones sin una necesidad concreta.

## Código completo y pruebas

El [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-ocp/README.md) enlaza la [implementación](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/rates.ts) y los tests de recargo, tarifa original, entrada sin cambios y resultados inválidos.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
```

## Garantías y límites

La variante conserva la tarifa base y rechaza importes que incumplen el contrato representacional. No aplica impuestos, tipos de cambio, descuentos o reglas de un transportista real. No promete que cualquier función con el tipo `RateRule` se comporte bien.

No hay benchmark que justifique esta elección por velocidad. Aquí se busca poder revisar y comprobar una variación sin mezclarla con el cálculo base.

## Ejercicio: cambiar una condición sin ocultarla

Crea una variante cuyo recargo solo se aplique a envíos `remote`. Conserva la regla base. Comprueba cuatro casos: ambas zonas por debajo de 5000 y ambas en el umbral exacto. Escribe primero qué importe esperas en cada uno y por qué.

Después continúa con [LSP y contratos de comportamiento](/posts/lsp-contratos-sustitucion-comportamiento): aceptar una función con la firma adecuada no basta para que podamos sustituirla con confianza.

## Referencias

- [Robert C. Martin: The Open-Closed Principle](https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html).
- [TypeScript: funciones, callbacks y sus tipos](https://www.typescriptlang.org/docs/handbook/2/functions.html).

Fuentes consultadas el 21 de octubre de 2026. Los importes son políticas ficticias; las pruebas observan este laboratorio y no un sistema de extensiones en producción.
