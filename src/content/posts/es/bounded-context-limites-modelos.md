---
id: DOMAIN-CONTEXTS
title: 'Bounded contexts: cuándo una misma palabra necesita modelos distintos'
published: 2026-10-20T09:01:00Z
locale: es
translationKey: domain-bounded-contexts
slug: bounded-context-limites-modelos
draft: true
status: draft
level: intermedio
prerequisites: [P044]
description: 'Delimita el significado y ownership de un modelo. Compara un pedido en pagos, logística y devoluciones, y traduce sus contratos sin imponer microservicios.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, bounded-context, arquitectura, typescript]
---

La clase `Order` tiene estados de cobro, almacén, transporte y devolución. Cada equipo añade sus campos y condiciones. Al cambiar qué significa «completado» para logística, se rompe una comprobación de pagos que nadie sabía que dependía de ese estado.

Compartir una clase parecía ahorrar duplicación. En realidad, estábamos obligando a varios modelos a utilizar una única definición de pedido.

Después de [acordar el lenguaje del negocio](/posts/ddd-lenguaje-bounded-contexts), la siguiente pregunta es dónde se mantiene válido ese lenguaje. Ahí aparece el **bounded context**. Veremos cómo proponer una frontera, cómo se relaciona con otras y cómo comprobar una traducción sin desplegar servicios.

## Qué delimita un bounded context

Un **bounded context** es el ámbito explícito en el que un modelo conserva un significado coherente. Define qué representan sus términos y reglas, y dónde hay que negociar o traducir para relacionarse con otros modelos.

No equivale a «una carpeta por área». Si un módulo solo funciona porque conoce todos los campos privados de los demás, el directorio no ha establecido una frontera útil.

La [explicación de Martin Fowler](https://martinfowler.com/bliki/BoundedContext.html) presenta este patrón como una forma de manejar modelos diferentes y sus relaciones. Nuestro caso lo concreta con tres responsabilidades: **Payments** decide sobre importes; **Fulfillment** sobre entrega; **Returns** sobre admisibilidad de una devolución.

## El mismo pedido puede tener tres representaciones legítimas

Payments necesita identificar el pago, conocer la moneda y el importe capturado. Fulfillment necesita el pedido asociado al envío y su estado logístico. Returns necesita hechos suficientes para decidir una solicitud, no toda la información de los otros dos.

Compartir `orderId` permite relacionar referencias. No obliga a compartir una clase con cada atributo que cualquiera pudiera necesitar.

<div class="overflow-x-auto" role="region" aria-label="Significado del pedido en tres contextos" tabindex="0">

| Contexto    | Pregunta que resuelve                               | Dato que no debería inventar          |
| ----------- | --------------------------------------------------- | ------------------------------------- |
| Payments    | ¿Cuánto se ha capturado y cuánto se puede reservar? | Si el paquete llegó                   |
| Fulfillment | ¿Qué envío se ha entregado?                         | Si un reembolso se ejecutó            |
| Returns     | ¿Admitimos esta solicitud según nuestra política?   | Un estado de cobro o transporte ajeno |

</div>

No estamos normalizando tres tablas ni proponiendo tres bases de datos. Estamos separando significados. Dos de estos modelos pueden compartir proceso y despliegue si eso encaja con sus necesidades.

## Cómo encontrar una frontera sin dibujarla por intuición

Empieza por los casos y las decisiones. ¿Quién puede afirmar que hubo entrega? ¿Quién conoce la disponibilidad de un importe? ¿Qué cambio de regla requiere consultar a las mismas personas y qué cambio no?

En este ejercicio, modificar la ventana de devolución no debería obligar a cambiar el estado de un envío. Cambiar la empresa de transporte no debería modificar la regla de sumar reservas sobre un pago. Son señales para separar responsabilidades, no un algoritmo automático que descubra la arquitectura correcta.

También hay señales para no separar todavía. Si dos supuestos «contextos» necesitan cambiar juntos por cada regla y comparten exactamente el mismo vocabulario, quizá estamos dividiendo prematuramente un único modelo. Añadir un contrato y una traducción tendría coste sin un beneficio claro.

## Un context map explica relaciones, no servidores

En nuestro mapa, Fulfillment aporta un hecho de entrega. Returns lo interpreta y decide su política. Payments protege el importe disponible. La integración entre política logística y reserva monetaria sigue pendiente en el laboratorio.

<img src="/assets/visuals/domain-design/DOMAIN-CONTEXTS.svg" alt="Fulfillment comunica datos del envío; Returns los traduce y aplica su política; Payments protege los importes. Las relaciones describen modelos y la coordinación completa está pendiente, no tres servicios desplegados." width="262" height="861" loading="lazy" style="width:100%;height:auto" />

[Ampliar el context map](/assets/visuals/domain-design/DOMAIN-CONTEXTS.svg).

Un **context map** permite discutir quién suministra información, quién depende de ella y qué contrato cruza la frontera. Una consulta, un evento o una llamada de función son decisiones posteriores sobre cómo materializar esa relación.

Si Returns consulta a logística, necesita tratar su indisponibilidad. Si mantiene una proyección a partir de eventos, necesita decidir cuánta antigüedad admite y cómo recupera mensajes perdidos. Un límite de modelo no elimina esos costes.

## Traducir no es copiar el DTO con otro nombre

La primera versión del laboratorio separa la precondición logística de otros criterios. Solo reconoce `in_transit` y `delivered`; un estado de cobros como `paid` se rechaza.

Archivo: `packages/domain-design/src/contexts.ts`.

```typescript
export function eligibilityFromShipment(
  input: unknown,
): 'awaiting-delivery' | 'eligible' {
  if (!input || typeof input !== 'object') throw new Error('invalid shipment')
  const data = input as Record<string, unknown>
  if (typeof data.orderId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(data.orderId))
    throw new Error('invalid order id')
  if (data.state === 'delivered') return 'eligible'
  if (data.state === 'in_transit') return 'awaiting-delivery'
  throw new Error('unknown shipment state')
}
```

`unknown` obliga a inspeccionar la entrada. El cast permite acceder a propiedades después de comprobar que hay un objeto; las condiciones siguientes validan el identificador y el estado. El resultado utiliza el vocabulario que necesita Returns.

`eligible` significa aquí «supera esta precondición logística», no «autoriza una devolución completa». El plazo y las condiciones monetarias no se evalúan en esta función. Esa precisión evita convertir una traducción pequeña en una garantía demasiado amplia.

Si el proveedor cambia a un estado nuevo, conviene fallar explícitamente hasta decidir su significado. Interpretar todo estado desconocido como entregado haría compatibles los tipos de datos a costa de cambiar la regla.

Esta traducción puede formar parte de una **Anti-corruption Layer**: una protección frente a conceptos externos que no queremos trasladar directamente al modelo propio. Puede empezar como una función. No necesita una jerarquía de adaptadores para merecer ese nombre.

## Compartir código es una decisión distinta de compartir significado

Una librería de formatos o identificadores puede resultar útil. Una librería que obliga a todos los contextos a utilizar la misma entidad `Order` también puede acoplar sus cambios de negocio.

No hay que copiar por principio ni deduplicar por principio. Pregunta si ambos lados quieren que el concepto evolucione conjuntamente. Dos estructuras parecidas con políticas diferentes pueden justificar modelos separados.

La alternativa más simple sigue siendo un único modelo cuando hay una sola semántica y pocas reglas. Tampoco todo módulo es un bounded context. Nombrarlo así no demuestra que el límite se haya discutido o que los equipos puedan mantenerlo.

## Código, pruebas y límites de la traducción

Consulta el [índice de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-contexts/README.md) y la [implementación completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/contexts.ts). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
```

Los tests aceptan estados reconocidos y rechazan `paid` y un identificador vacío. Verifican un contrato de traducción, no una integración logística en red.

## Garantías y límites

La función evita utilizar un estado de pagos como prueba de entrega. No comprueba procedencia, firma, actualidad, titularidad o permisos. Los tres modelos todavía no forman un flujo coordinado de pedidos y devoluciones.

Un bounded context hace explícita la responsabilidad del modelo; no crea aislamiento de ejecución, una transacción distribuida o un equipo independiente. Para decidir despliegues habrá que añadir requisitos y costes operativos.

## Ejercicio: un estado nuevo sin romper otros modelos

Añade `delivery_attempted`. Decide con un ejemplo si supera la precondición de Returns. El test debe verificar esa decisión y mantener el rechazo de `paid`. Payments no debe ganar un estado logístico nuevo por este cambio.

Seguimos con [entidades e identidad](/posts/entidades-identidad-ciclo-vida): dentro de cada modelo todavía necesitamos distinguir un objeto que cambia de otro que simplemente representa el mismo valor.

## Referencias

- [Martin Fowler: Bounded Context](https://martinfowler.com/bliki/BoundedContext.html).
- [Microsoft: análisis de dominio y relaciones entre contextos](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis).
- [Eric Evans: DDD Reference](https://www.domainlanguage.com/ddd/reference/).

Fuentes consultadas el 20 de octubre de 2026. Las fronteras propuestas pertenecen al ejercicio, no a una arquitectura universal para comercio.
