---
id: DESIGN-ISP
title: 'ISP: interfaces pequeñas según lo que necesita cada consumidor'
published: 2026-10-21T09:03:00Z
locale: es
translationKey: design-isp-capabilities
slug: isp-interfaces-consumidor-capacidades
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-LSP]
description: 'Separa lectura y escritura de cotizaciones con contratos pequeños en TypeScript. Explica por qué ISP no obliga a dividir implementaciones ni sustituye la autorización.'
author: 'Luis Ramírez Calle'
series: 'Principios de diseño sin sobreingeniería'
tags: [diseno-software, solid, isp, interfaces, typescript, testing]
---

Queremos consultar una cotización, pero el test nos exige inventar métodos para guardarla, borrarla y generar informes. La función de lectura no usa nada de eso. Solo recibe un contrato más grande de lo que necesita.

Podemos corregirlo sin crear una base de datos por operación ni un microservicio por interfaz. Basta con expresar la capacidad que necesita ese consumidor.

Después de [LSP y comportamiento](/posts/lsp-contratos-sustitucion-comportamiento), pasamos a **Interface Segregation Principle**, o **ISP**. Una implementación debe cumplir lo que promete, pero tampoco conviene hacer depender a cada consumidor de toda su API.

## Una interfaz describe una relación, no todo lo que sabe hacer un objeto

En el laboratorio hay dos necesidades. Crear una cotización requiere confirmar una escritura. Consultar una existente requiere buscarla por su identificador. No necesitan el mismo conjunto de operaciones.

Archivo: `packages/design-principles/src/application.ts`, extracto. `Quote` es el tipo monetario del módulo `rates.ts`.

```typescript
export type QuoteReader = { find: (id: string) => Promise<Quote | null> }
export type QuoteWriter = { save: (id: string, quote: Quote) => Promise<void> }
```

Estos contratos son pequeños porque los consumidores actuales necesitan una operación cada uno. No hay una regla que diga que todas las interfaces deban tener un solo método. Si dos operaciones forman una capacidad coherente y siempre se necesitan juntas, separarlas puede empeorar la lectura.

Tampoco añadimos `delete`, `list`, filtros genéricos o administración de conexiones para un uso hipotético. Que el almacén pueda ofrecer más operaciones no obliga a publicarlas en cada relación.

## El caso de lectura solo depende de encontrar una cotización

Archivo: `packages/design-principles/src/application.ts`, extracto. `validId` acepta de 1 a 64 caracteres alfanuméricos o guiones.

```typescript
export async function readQuote(reader: QuoteReader, id: string): Promise<Quote | null> {
  validId(id)
  return reader.find(id)
}
```

El resultado `null` expresa que no hay cotización para ese ID. Si el almacenamiento falla, la promesa se rechaza; no convertimos una avería en «no encontrado». La firma no cuenta por sí sola toda esa semántica, así que hay que documentarla y probar los adaptadores.

El consumidor no recibe una conexión de base de datos ni decide nombres de tablas. Necesita una lectura. Para probarla basta un objeto con `find`.

Archivo: `packages/design-principles/tests/principles.test.mjs`, extracto del caso ISP. `readQuote` y `assert` se importan al principio del test.

```javascript
const quote = Object.freeze({ amountMinor: 500, currency: 'EUR' })
assert.equal(await readQuote({ find: async () => quote }, 'q-1'), quote)
assert.equal(await readQuote({ find: async () => null }, 'missing'), null)
```

No hay métodos que lancen `not implemented` para satisfacer un contrato demasiado amplio. El doble expresa exactamente la colaboración que estamos comprobando.

## Una sola implementación puede satisfacer ambas capacidades

`memoryQuotes` devuelve un objeto que ofrece `find` y `save`. Su tipo de retorno es `QuoteReader & QuoteWriter`: una intersección que exige satisfacer ambos contratos.

Esto no contradice ISP. El caso de lectura conoce el contrato pequeño aunque el objeto real tenga más métodos. La separación importante está en la dependencia del consumidor, no en fragmentar físicamente cada implementación.

<img src="/assets/visuals/design-principles/DESIGN-ISP.svg" alt="readQuote depende de QuoteReader y createQuote de QuoteWriter; memoryQuotes satisface ambos contratos sin obligar a cada consumidor a declarar operaciones que no utiliza." width="493" height="440" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/design-principles/DESIGN-ISP.svg).

TypeScript utiliza compatibilidad estructural: importa la forma que necesita el contrato. No hace falta escribir `implements` para cada objeto literal. La [documentación de object types](https://www.typescriptlang.org/docs/handbook/2/objects.html) explica cómo describir esas estructuras.

El archivo `src/type-examples.ts` incluye también una comprobación negativa: un `QuoteReader` no satisface `QuoteWriter`. La línea lleva `@ts-expect-error` porque esperamos precisamente ese error. Si dejase de existir, el typecheck fallaría por una directiva innecesaria. No se silencia un error inesperado para conseguir que compile el proyecto.

## Una interfaz pequeña no garantiza un buen límite

Podríamos diseñar `execute(sql: string): Promise<unknown>` con un único método y aun así obligar a la aplicación a conocer SQL, filas y detalles de almacenamiento. Ser pequeña no la convierte en una buena abstracción.

El contrato `save` también puede ser demasiado vago si no definimos qué confirma. En nuestro laboratorio, resolver significa que la instancia del almacén en memoria ya conserva una copia. Un adaptador SQL necesitaría aclarar si espera al commit, qué errores propaga y qué sucede con IDs duplicados.

La segregación sirve cuando reduce dependencias que el consumidor no necesita. No sirve como una competición por conseguir la interfaz más corta.

## No confundas esta separación con CQRS o permisos de seguridad

Tener un contrato de lectura y otro de escritura no implica desplegar modelos separados, una cola o una proyección eventual. Es solo la separación local de capacidades necesarias. Una arquitectura **CQRS** tiene decisiones adicionales sobre los modelos de consulta y modificación que aquí no estamos implementando.

Y una anotación de tipo no retira métodos del objeto en ejecución. Si pasamos el almacén completo y lo tipamos como `QuoteReader`, el compilador limita el uso ordinario en ese código, pero el objeto sigue teniendo `save`.

No es una frontera de autorización. Si necesitamos impedir escrituras a un componente no confiable, no basta con asignar un tipo: habrá que limitar qué objeto recibe y aplicar controles en la frontera pertinente. Este laboratorio no verifica identidad, ownership o permisos por recurso.

## Cuándo no separaría más contratos

Si lectura y escritura siempre cambian juntas para los mismos consumidores, un contrato común puede ser suficiente. Si aparecen cinco variantes casi idénticas de `find`, merece la pena revisar si estamos nombrando capacidades reales o duplicando tipos sin reducir ninguna dependencia.

También evitaría copiar automáticamente la interfaz de un SDK. Un proveedor puede ofrecer veinte operaciones por razones ajenas a nuestra aplicación. El consumidor define qué necesita; un adaptador puede traducirlo. Esa dirección será el tema de la siguiente entrega.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-isp/README.md), los [contratos y casos de uso](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/application.ts) y el [almacén compartido](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/design-principles/src/adapters/memory.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/design-principles test
pnpm --dir packages/design-principles typecheck
```

## Garantías y límites

El test de lectura funciona con un doble que solo tiene `find`. El typecheck contrasta que una capacidad de lectura no cumple la de escritura. El almacén en memoria implementa ambas sin exponer su `Map` interno.

Eso no demuestra aislamiento de seguridad, estabilidad futura de las interfaces o cumplimiento de un contrato SQL. No hay infraestructura externa ni pruebas de adaptadores que todavía no existen.

## Ejercicio: añadir una consulta sin inflar al escritor

Introduce una consulta `hasQuote` mediante un consumidor que solo necesite `find`. No amplíes `QuoteWriter`. Prueba existencia, ausencia y rechazo del almacenamiento. Decide si `hasQuote` debe delegar en el mismo reader o merece un contrato distinto; justifícalo por sus necesidades, no por el nombre del patrón.

Seguimos con [DIP e inyección de dependencias](/posts/dip-inyeccion-dependencias-sin-contenedor): los contratos ya son pequeños; ahora veremos quién los define y dónde se conectan sus implementaciones.

## Referencias

- [TypeScript: Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html).
- [TypeScript: Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html).
- [TypeScript: @ts-expect-error](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#ts-expect-error-comments).

Fuentes consultadas el 21 de octubre de 2026. La división de contratos se justifica por los dos consumidores del laboratorio, no como plantilla obligatoria para cualquier repositorio.
