---
id: DESIGN-DIP
title: 'DIP e inyección de dependencias: quién decide el contrato y quién conecta las piezas'
published: 2026-10-21T09:04:00Z
locale: es
translationKey: design-dip-injection
slug: dip-inyeccion-dependencias-sin-contenedor
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-ISP]
description: 'Distingue Dependency Inversion de dependency injection. Conecta un caso de uso con un almacén en memoria y prueba que no devuelve éxito antes de confirmar la escritura.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, solid, dip, dependency-injection, typescript, testing]
---

La regla para cotizar un envío no debería cambiar porque cambiemos cómo guardamos el resultado. Sin embargo, si crea por dentro el cliente de almacenamiento, también decide cómo conectarse, qué implementación usar y cómo sustituirla en una prueba.

Podemos sacar esa construcción del caso de uso. Eso resuelve una parte del problema. La otra es diseñar un contrato que describa lo que la aplicación necesita, en lugar de copiar los detalles del almacén.

En [ISP](/posts/isp-interfaces-consumidor-capacidades) distinguimos `QuoteReader` y `QuoteWriter`. Ahora veremos **Dependency Inversion Principle**, o **DIP**, y **dependency injection**, que están relacionados pero no significan lo mismo.

## DIP trata de la dirección de las dependencias de código

Nuestro caso de uso necesita calcular una cotización y confirmar su almacenamiento. No necesita conocer un `Map`, una tabla SQL ni el ciclo de vida de una conexión.

Definimos `QuoteWriter` junto a la aplicación, con la operación y semántica que esta necesita. El adaptador en memoria importa ese contrato y lo satisface. La aplicación no importa el adaptador.

Este es el cambio de dirección relevante: el detalle de almacenamiento depende del contrato de su consumidor, en vez de obligar al consumidor a depender de su API concreta. La [discusión de arquitectura de Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2016/01/04/ALittleArchitecture.html) plantea esa independencia entre políticas y detalles.

No significa que no podamos importar código concreto nunca. El formateador de un dato local puede ser una función concreta sin problema. Nos interesa proteger una frontera donde construcción, efectos y decisiones de infraestructura no deberían dictar la política.

## Inyectar significa proporcionar la dependencia desde fuera

La **inyección de dependencias** es el mecanismo por el que un componente recibe lo que necesita en vez de buscarlo o construirlo por dentro. Puede hacerse con parámetros, un constructor o una función que devuelve otra función configurada.

Pasar una instancia concreta de un SDK por parámetro ya es inyección, pero no garantiza DIP: el caso de uso podría seguir dependiendo de los tipos, errores y estructura de ese SDK. A la inversa, declarar una interfaz no ayuda mucho si la aplicación también crea e importa la implementación por dentro.

[Martin Fowler explica la separación entre configuración y uso](https://martinfowler.com/articles/injection.html). Aquí un parámetro es suficiente; no hace falta introducir un contenedor de DI para tener esa separación.

## El caso de uso define cuándo puede devolver éxito

Archivo: `packages/design-principles/src/application.ts`, extracto. `Quote`, `RateRule`, `quoteWith` y `parseShipment` proceden de `rates.ts`; `validId` se define en el mismo archivo.

```typescript
export async function createQuote(
  writer: QuoteWriter,
  rate: RateRule,
  id: string,
  input: unknown,
): Promise<Quote> {
  validId(id)
  const quote = quoteWith(rate, parseShipment(input))
  await writer.save(id, quote)
  return quote
}
```

El recorrido es explícito. Primero valida el ID y la entrada, luego calcula el importe y por último espera a la escritura. Si `save` se rechaza, la función no devuelve una cotización exitosa.

El contrato de `save` en este laboratorio significa «la instancia de almacenamiento ya conserva esta cotización cuando la promesa se resuelve». También rechaza IDs repetidos. No significa «se ha enviado a una cola» ni «se guardará más tarde».

Dos adaptadores con la misma firma pero distinta interpretación de esa confirmación no serían sustitutos válidos. Esta es la conexión con LSP: invertir dependencias no elimina la obligación de respetar el comportamiento acordado.

Tampoco hacemos retries automáticos. Un rechazo no demuestra por sí solo que una escritura remota nunca se haya realizado. El fake que probamos tiene un comportamiento conocido; un futuro adaptador de red necesitaría diseñar duplicados, incertidumbre y reconciliación.

## El composition root conoce las implementaciones

Llamamos **composition root** al lugar que construye y conecta las piezas de la aplicación. En este ejercicio es `demo.ts`.

Archivo: `packages/design-principles/src/demo.ts`, extracto. Los imports están en el archivo enlazado.

```typescript
const store = memoryQuotes()
const rate = withSurcharge(standardRate, 200)
const quote = await createQuote(store, rate, 'q-1', {
  subtotalMinor: 3000, weightGrams: 1500, zone: 'local',
})
console.log(formatQuote(quote))
console.log(await readQuote(store, 'q-1'))
```

Este módulo sí conoce `memoryQuotes` y las funciones de aplicación. Tiene que conocerlos para conectarlos. Intentar que ningún archivo importe una implementación concreta nos llevaría a esconder la construcción en un registro global, no a eliminarla.

La salida del demo es `Portes: 7.00 EUR` y una cotización de 700 céntimos. Es el resultado de la tarifa local más el recargo de 200, no una consulta a un transportista.

<img src="/assets/visuals/design-principles/DESIGN-DIP.svg" alt="demo.ts importa y conecta aplicación y memoria; el adaptador memory.ts importa el contrato de application.ts, mientras application.ts no importa el adaptador concreto." width="438" height="622" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/DESIGN-DIP.svg).

Las flechas muestran dependencias de código. En ejecución, `createQuote` invoca el método del writer. La dirección de esa llamada no implica que su archivo importe la implementación concreta. Confundir ambos recorridos hace que la inversión parezca una contradicción.

## Cómo probamos la espera sin depender de un temporizador

Un test proporciona un writer que recibe la cotización y espera una promesa controlada por la prueba. Dejamos pasar un turno del event loop y comprobamos que la operación aún no ha terminado. Después liberamos esa promesa y esperamos el resultado.

No se usa «esperar cien milisegundos y confiar». Controlamos la condición que confirma la escritura. Si quitásemos el `await` del caso de uso, la comprobación de finalización anticipada detectaría el cambio.

Otro writer lanza `disk unavailable`. El test verifica que el error llega y que hubo exactamente un intento, no un éxito fabricado o un retry implícito. Los casos de entrada o ID inválidos también comprueban que ni siquiera se llama al writer.

El almacén en memoria tiene sus propias pruebas: ausencia, guardado, duplicados y copia defensiva. Cambiar el objeto original después de guardar no cambia el almacenado. Sus datos son primitivos, de modo que congelar esa copia basta para las mutaciones ordinarias contempladas aquí.

## Por qué no añadimos un contenedor ni un Service Locator

Un contenedor puede gestionar grafos grandes, ciclos de vida o scopes. También añade configuración, convenciones y formas nuevas de equivocarse. Con un writer y una tarifa, las llamadas directas muestran toda la construcción en pocas líneas.

Un **Service Locator** permitiría al caso de uso pedir dependencias a un registro. La contrapartida sería tener que inspeccionar el cuerpo para saber qué solicita y gestionar ese estado durante las pruebas. En este ejercicio preferimos que la firma lo haga visible.

Esto no demuestra que todo contenedor sea malo ni que toda inyección deba ser por parámetro. Es una elección proporcionada al tamaño de este programa. Si cambian las necesidades, conviene comparar costes concretos antes de cambiar de mecanismo.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-dip/README.md), el [caso de uso](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/application.ts) y el [composition root](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/demo.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
pnpm --dir packages/design-principles demo
```

## Garantías y límites

Se prueba la coordinación del caso de uso y el adaptador en memoria. No hay SQL, Stripe sandbox ni adaptador HTTP. Por tanto, este laboratorio no completa la sustitución de proveedor exigida en P045; prepara los conceptos de esa entrega futura.

La memoria es volátil y local a una instancia. Confirmar en ella no demuestra durabilidad, atomicidad distribuida o ausencia de errores después de un efecto remoto. Los contratos de tipos no son controles de autorización.

## Ejercicio: detectar una confirmación prematura

Crea deliberadamente un writer incorrecto que resuelva antes de actualizar su estado. Escribe un test de contrato que consulte inmediatamente después de `save` y detecte el fallo. Mantén el test del caso de uso: esperar una promesa solo es útil si el adaptador la resuelve con la semántica prometida.

Continúa con [KISS y YAGNI](/posts/kiss-yagni-diseno-necesidad-actual). Ahora tenemos herramientas para separar piezas; falta decidir cuándo no utilizarlas.

## Referencias

- [Robert C. Martin: A Little Architecture](https://blog.cleancoder.com/uncle-bob/2016/01/04/ALittleArchitecture.html).
- [Martin Fowler: Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html).
- [TypeScript: imports y exports de tipos](https://www.typescriptlang.org/docs/handbook/2/modules.html).

Fuentes consultadas el 21 de octubre de 2026. La evidencia corresponde a una composición local en Node.js; no hay integración con servicios de almacenamiento o pagos.
