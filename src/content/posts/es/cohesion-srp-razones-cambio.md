---
id: P043
title: 'Cohesión y SRP: separar lo que cambia por motivos distintos'
published: 2026-10-21T09:00:00Z
locale: es
translationKey: design-cohesion-srp
slug: cohesion-srp-razones-cambio
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-MODULES]
description: 'Refactoriza un cálculo de portes sin cambiar su comportamiento. Aprende a distinguir cohesión, acoplamiento y SRP sin crear una clase para cada operación.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, solid, srp, typescript, refactoring, testing]
---

Hay que cambiar «Portes» por «Shipping» en una pantalla y terminamos editando la función que decide cuánto cuesta el envío. No se ha roto nada todavía, pero una decisión de presentación nos ha llevado al mismo sitio que una política comercial.

Podemos separar esas decisiones sin construir una arquitectura de diez capas. Esa es la pregunta de esta serie: qué cambio queremos facilitar y qué separación lo consigue con un coste razonable.

El [artículo introductorio sobre diseño modular](/posts/monolito-modular-solid-sin-sobreingenieria) presentaba los principios en conjunto. Ahora los vamos a trabajar por separado con un pequeño laboratorio de cotizaciones de envío. No presupone DDD ni implementa un comercio real.

## Cohesión: cuánto sentido tiene mantener estas piezas juntas

La **cohesión** expresa la relación entre las responsabilidades de una unidad. Validar una representación, calcular una tarifa y redactar un texto pueden participar en la misma petición, pero responden a necesidades diferentes.

El cálculo de portes reúne decisiones relacionadas: qué zonas admitimos, qué importe corresponde a cada una y a partir de qué subtotal el envío es gratuito. Tiene sentido poder leer esas condiciones juntas.

El texto que muestra ese resultado necesita conocer el importe, pero no decidir el umbral. Si cambia el idioma, no debería cambiar cuánto paga el cliente.

La unidad no tiene que ser una clase. También puede ser un módulo o un conjunto de funciones. Y tener veinte funciones de dos líneas no garantiza cohesión: si para entender una regla hay que saltar entre todas ellas, quizá la división haya ido demasiado lejos.

## SRP: una responsabilidad no significa un único método

**Single Responsibility Principle**, o **SRP**, propone separar responsabilidades que responden a motivos distintos de cambio. La [explicación de Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) vincula esos motivos con las necesidades de quienes solicitan cambios, no con contar métodos.

En este ejercicio distinguimos tres decisiones: el contrato de entrada, la política comercial y la presentación. No inventamos un departamento para cada función ni asumimos que conoceremos todos los cambios futuros.

La evidencia concreta es más modesta: ya sabemos que el texto puede cambiar sin cambiar la tarifa y que una tarifa puede cambiar sin cambiar el formato de la entrada. Podemos diseñar alrededor de esa independencia.

## Antes de mover código, fija el comportamiento que debe conservarse

La tarifa ficticia es de 500 céntimos para `local` y 900 para `remote`. A partir de un subtotal de 5000 céntimos, ambas son gratuitas. Solo trabajamos en EUR y con pesos enteros de 1 a 20000 gramos.

El laboratorio conserva `legacyPreview` como referencia del antes. Es código pequeño y deliberadamente mezclado, no una versión histórica de una aplicación real.

Archivo: `packages/design-principles/src/preview.ts`, extracto. `Quote` y `parseShipment` proceden de `rates.ts`.

```typescript
export function legacyPreview(input: unknown): { quote: Quote; text: string } {
  const shipment = parseShipment(input)
  const amountMinor = shipment.subtotalMinor >= 5000 ? 0 : shipment.zone === 'local' ? 500 : 900
  const quote = Object.freeze({ amountMinor, currency: 'EUR' as const })
  return { quote, text: `Portes: ${(amountMinor / 100).toFixed(2)} EUR` }
}
```

La mezcla no se vuelve dañina por tener ocho líneas. Lo relevante es qué decisiones obliga a tocar juntas. Para un script desechable podría ser suficiente; aquí queremos cambiar presentación y política por separado.

Escribimos una prueba de caracterización: para ambas zonas y subtotales de 0, 4999, 5000 y 9000, el resultado refactorizado debe coincidir con el anterior. Son ocho casos elegidos alrededor del límite, no una prueba de equivalencia para cualquier programa.

Esa comparación tampoco demuestra que el requisito original fuese correcto. Por eso hay tests independientes que esperan 500 antes del umbral y 0 en el umbral exacto. Conservar un error también sería conservar comportamiento.

## Después: coordinar no es volver a decidir cada detalle

Archivo: `packages/design-principles/src/preview.ts`, extracto. El archivo completo incluye los imports.

```typescript
export function preview(input: unknown): { quote: Quote; text: string } {
  const quote = quoteWith(standardRate, parseShipment(input))
  return { quote, text: formatQuote(quote) }
}
```

`parseShipment` interpreta y valida la entrada. `standardRate` contiene la regla comercial. `quoteWith` valida el resultado y construye la cotización. `formatQuote` se ocupa del texto.

`preview` sigue reuniendo las piezas porque coordinar el recorrido es su trabajo. SRP no exige eliminar toda función que llame a más de una dependencia.

<img src="/assets/visuals/design-principles/P043.svg" alt="preview coordina tres responsabilidades separadas: parseShipment comprueba la entrada, standardRate calcula los portes y formatQuote presenta una cotización ya calculada." width="429" height="520" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/P043.svg).

Archivo: `packages/design-principles/src/presentation.ts`, extracto. `Quote` se importa como tipo desde `rates.ts`.

```typescript
export function formatQuote(quote: Quote, label = 'Portes'): string {
  return `${label}: ${(quote.amountMinor / 100).toFixed(2)} ${quote.currency}`
}
```

El test puede pedir `Shipping` y comprobar que sigue mostrando 5.00 EUR. La cotización no cambia porque el formateador no vuelve a calcularla.

No es una solución completa de **internationalization**. `toFixed(2)` conserva deliberadamente el formato anterior, con punto decimal. Una interfaz española real podría necesitar `Intl.NumberFormat`, traducciones y decisiones de accesibilidad. Separar la presentación permite trabajar eso sin editar el umbral comercial.

## Acoplamiento: qué necesita saber una parte sobre otra

El **coupling** o acoplamiento no desaparece. El formateador necesita la estructura de `Quote`; la coordinación conoce las funciones que invoca. El objetivo es que dependan de información pertinente y explícita.

Una separación poco útil sería pasar al formateador el pedido completo y dejar que buscase el importe en una propiedad interna. Entonces la presentación conocería detalles que no necesita. Pasarle la cotización limita esa relación.

Otra sería mover todo a una carpeta `utils` que importa al resto del proyecto. Hemos cambiado la ruta, pero no las dependencias. La discusión sobre **separation of concerns** de [Dijkstra](https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD447.html) ayuda a pensar en aspectos distintos; no prescribe cuántas carpetas necesitamos.

## Cuándo no haría esta separación

Si cálculo y presentación forman una transformación corta, local y sin variaciones independientes, extraer cinco módulos puede dificultar la lectura. No hace falta poner una interfaz delante de una suma.

Tampoco separaría cada condición de la tarifa solo para reducir el número de líneas. El umbral gratuito y la elección de zona pertenecen a la misma política en este ejemplo. Tenerlos juntos permite revisar el precio que realmente cobramos.

Una buena revisión puede formular el cambio: «el texto se modifica aquí y la política permanece cubierta por estos tests». Decir únicamente «ahora cumple SRP» no explica qué hemos ganado.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p043/README.md), las [versiones antes y después](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/preview.ts) y sus [pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/tests/principles.test.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
```

## Garantías y límites

Las pruebas conservan los resultados de la matriz elegida y verifican por separado el límite gratuito y el cambio de etiqueta. No miden productividad, calidad global o rendimiento. Más módulos no implican automáticamente mejor software.

La entrada se valida en ejecución; las anotaciones TypeScript no sustituyen ese parser. No hay impuestos, reservas, transportista, HTTP o persistencia durable. Las tarifas son inventadas para estudiar el diseño.

## Ejercicio: cambiar presentación sin cambiar política

Añade otro formateador que produzca un objeto con `label` y `formattedAmount`. Conserva `preview` y sus ocho casos anteriores. Comprueba que ambos formateadores reciben exactamente el mismo importe para un subtotal de 4999 y otro de 5000.

Si necesitas editar `standardRate` para conseguirlo, revisa qué dependencia se ha colado. Después sigue con [OCP y composición](/posts/ocp-composicion-extension-tarifas): ahora sí aparece una variación del cálculo.

## Referencias

- [Robert C. Martin: The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html).
- [Edsger W. Dijkstra: On the role of scientific thought](https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD447.html).
- [TypeScript: object types y readonly](https://www.typescriptlang.org/docs/handbook/2/objects.html).

Fuentes consultadas el 21 de octubre de 2026. Los resultados de código corresponden al laboratorio local, no a un refactor desplegado en producción.
