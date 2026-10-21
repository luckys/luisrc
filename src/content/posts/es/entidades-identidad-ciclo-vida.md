---
id: DOMAIN-ENTITIES
title: 'Entidades en DDD: qué permanece cuando cambian los datos'
published: 2026-10-20T09:02:00Z
locale: es
translationKey: domain-entities-identity
slug: entidades-identidad-ciclo-vida
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-CONTEXTS]
description: 'Distingue identidad, igualdad de datos y referencia en memoria con un envío que cambia de estado. Modela transiciones explícitas sin confundir entidad con tabla o agregado.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, entidades, identidad, typescript, testing]
---

Un envío cambia de «en tránsito» a «entregado». Si comparamos todos sus campos, el resultado es distinto. Sin embargo, seguimos hablando del mismo envío: el que salió del almacén y ahora ha llegado al comprador.

Ese seguimiento a lo largo del tiempo es lo que necesitamos representar con una **entidad**. Añadir una propiedad `id` es una parte posible de la implementación, no la explicación del concepto.

Después de [delimitar el modelo](/posts/bounded-context-limites-modelos), veremos qué significa identidad dentro de él, cómo protegerla y qué pruebas distinguen el mismo objeto de negocio de dos objetos con datos parecidos.

## Qué caracteriza a una entidad

Una **entidad** representa algo cuya identidad interesa mantener aunque cambien sus atributos. Puede tener un ciclo de vida y transiciones que el modelo necesita reconocer.

En el ejemplo, `s1` identifica un envío. Su pedido asociado y su estado son datos sobre ese envío. Dos envíos de un mismo pedido no se convierten en el mismo envío por compartir `orderId`.

La [descripción de entidades en el diseño táctico de Microsoft](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design) distingue ese seguimiento de identidad del valor de sus atributos. Aquí lo probaremos sin persistencia: una entidad puede existir antes de que haya una tabla o un ORM.

## Identidad de negocio, igualdad de estado y referencia no son lo mismo

Necesitamos separar tres preguntas:

1. ¿Son dos versiones del mismo envío?
2. ¿Tienen los mismos datos en este momento?
3. ¿Son la misma instancia en memoria?

La primera puede responderse con la identidad estable del modelo. La segunda comparando el estado relevante. La tercera con `===` en TypeScript ejecutado como JavaScript.

Si un repositorio carga dos veces el mismo envío, podría crear dos instancias distintas con el mismo ID. Si una función devuelve un estado nuevo inmutable, también cambia la referencia. Ninguno de esos hechos implica por sí solo que haya aparecido otro envío.

<img src="/assets/visuals/domain-design/DOMAIN-ENTITIES.svg" alt="El envío s1 pasa de en tránsito a entregado conservando identidad aunque cambie su instancia; otro envío s2 del mismo pedido mantiene una identidad distinta. Estado y referencia no definen por sí solos la entidad." width="218" height="634" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama de identidad](/assets/visuals/domain-design/DOMAIN-ENTITIES.svg).

## Un ejemplo pequeño con transición explícita

Nuestro `Shipment` permite crear un envío en tránsito y marcarlo como entregado. La identidad y el pedido asociado no se pueden reemplazar desde fuera.

Archivo: `packages/domain-design/src/entities.ts`, clase `Shipment`.

```typescript
export class Shipment {
  readonly #id: string
  readonly #orderId: string
  readonly #state: 'in_transit' | 'delivered'

  private constructor(id: string, orderId: string, state: 'in_transit' | 'delivered') {
    if (!validId(id) || !validId(orderId)) throw new Error('invalid shipment id')
    this.#id = id
    this.#orderId = orderId
    this.#state = state
  }

  static start(id: string, orderId: string): Shipment {
    return new Shipment(id, orderId, 'in_transit')
  }

  get id(): string {
    return this.#id
  }
  get orderId(): string {
    return this.#orderId
  }
  get state(): 'in_transit' | 'delivered' {
    return this.#state
  }

  sameIdentityAs(other: Shipment): boolean {
    return this.id === other.id
  }

  markDelivered(): Shipment {
    if (this.state === 'delivered') return this
    return new Shipment(this.id, this.orderId, 'delivered')
  }
}
```

En el mismo archivo, `validId` comprueba que el identificador tenga entre 1 y 64 caracteres alfanuméricos o guiones. Es el formato de este fixture; DDD no exige este formato ni un UUID.

La fábrica `start` solo crea el estado inicial permitido. `markDelivered` expresa una operación reconocible, en lugar de permitir un `setState` que acepte cualquier cadena. Repetir la transición sobre una instancia ya entregada devuelve esa instancia sin otro cambio.

Esa repetición no demuestra idempotencia de una llamada remota: aquí no hay mensajes ni efectos externos. Solo hemos definido qué hace el método si el estado ya es el solicitado.

El estado nuevo es otro objeto con el mismo ID. No hace falta que una entidad sea mutable para que su historia importe. Podríamos modificar campos privados internamente, pero entonces tendríamos que controlar las referencias compartidas para no observar cambios inesperados.

## El test debe demostrar qué igualdad queremos

Archivo: `packages/domain-design/tests/concepts.test.mjs`, extracto.

```javascript
const original = Shipment.start('s1', 'o1')
const delivered = original.markDelivered()
assert.notStrictEqual(original, delivered)
assert.ok(original.sameIdentityAs(delivered))
assert.equal(original.state, 'in_transit')
assert.equal(delivered.state, 'delivered')
assert.strictEqual(delivered.markDelivered(), delivered)
```

Comprobamos referencias distintas, identidad igual y conservación del estado anterior. Otro caso crea `s1` y `s2` para `o1`: compartir pedido no les da la misma identidad.

Si el test comparara únicamente `orderId`, no detectaría que un pedido puede dividirse en dos paquetes. Antes de elegir una clave hay que saber qué necesita distinguir el negocio.

## Una identidad tiene un ámbito y no concede permisos

Nuestro ID es único por acuerdo dentro del fixture de Fulfillment. No hemos implementado un registro que evite que dos procesos creen envíos con el mismo ID.

En otros sistemas puede hacer falta incluir el contexto o el tenant al interpretar una referencia. Dos números `123` no identifican necesariamente el mismo objeto si pertenecen a espacios distintos. Esa decisión debe expresarse también en búsquedas y constraints, no solo en documentación.

Tener el ID correcto tampoco autoriza a leer o cambiar el envío. La identidad del recurso y la identidad de quien actúa responden preguntas distintas. El ejemplo no tiene autenticación ni permisos.

## Entidad no significa tabla, y tampoco significa agregado

Un ORM puede llamar «entity» a una clase mapeada a una tabla. Ese uso no demuestra que hayamos diseñado su identidad, su comportamiento o su ciclo de vida.

Por otro lado, una entidad puede formar parte de una frontera mayor. El concepto **aggregate root** añade responsabilidad sobre reglas de coherencia de un conjunto, no solo identidad. Lo veremos después de entender [Value Objects](/posts/value-objects-igualdad-inmutabilidad).

Tampoco conviene convertir cada estructura en entidad. Si solo importa su valor actual y sustituirla por otra equivalente no cambia lo que significa, puede que necesitemos un Value Object o un dato sencillo.

## Código, alternativas y costes

Consulta el [índice por artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-entities/README.md) y la [clase completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/entities.ts). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
```

Una función pura sobre un estado tipado podría expresar esta misma transición. Elegimos una clase para mostrar cómo ocultar identidad y estado, no porque el patrón la exija.

Los campos `#` son privados en ejecución. El modificador TypeScript `private` del constructor, en cambio, es una restricción del compilador, no una validación de JSON ni una protección frente a código hostil. El [manual de clases](https://www.typescriptlang.org/docs/handbook/classes.html) distingue esas herramientas.

## Garantías y límites

El ejemplo conserva el ID al entregar, evita cambiarlo mediante su API pública y no modifica la versión anterior. No prueba unicidad global, carga desde DB, historial de eventos, coordinación concurrente o autenticidad de una entrega.

Solo hay dos estados. Añadir incidencias, entregas parciales o correcciones exigiría acordar nuevas transiciones; no basta con ampliar una unión de strings y permitir cualquier cambio entre ellas.

## Ejercicio: dos paquetes para un pedido

Crea dos envíos para `o1`, entrega uno y deja el otro en tránsito. Deben conservar IDs diferentes y el segundo no debe cambiar al modificar el primero. Añade un test que falle si comparas identidad mediante `orderId`.

La siguiente entrega trata [Value Objects e igualdad por valor](/posts/value-objects-igualdad-inmutabilidad). Compararemos por qué dos importes de 5 euros pueden ser equivalentes sin convertirse en el mismo pago o envío.

## Referencias

- [Microsoft: entidades y otros patrones de diseño táctico](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design).
- [TypeScript: clases, visibilidad y campos privados](https://www.typescriptlang.org/docs/handbook/classes.html).

Fuentes consultadas el 20 de octubre de 2026. El envío es un modelo ficticio local, no un servicio logístico desplegado.
