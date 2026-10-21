---
id: DOMAIN-SERVICES
title: 'Domain services: dónde colocar una regla que no pertenece a una entidad'
published: 2026-10-20T09:05:00Z
locale: es
translationKey: domain-services-policies
slug: domain-services-politicas-negocio
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-AGGREGATES, DOMAIN-CONTEXTS]
description: 'Implementa una política de devoluciones con tiempo explícito. Distingue domain service, entidad y application service sin esconder reglas en un Service genérico.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, domain-service, politicas, typescript, testing]
---

La solicitud de devolución solo se admite durante los treinta días posteriores a la entrega. La regla no trata de guardar un pago ni de cambiar el estado de un envío. Combina un hecho logístico con una política de Returns y un instante de evaluación.

¿La metemos en `Payment`, en `Shipment` o en una clase `ReturnService` que también consulta SQL y envía correos? Ninguna de esas opciones debería elegirse solo porque ya existe una clase donde añadir otro método.

Después de [agregados e invariantes](/posts/value-objects-agregados-invariantes), usaremos un **domain service** pequeño para esta decisión. Su forma será una función: el concepto se reconoce por la responsabilidad, no por acabar en `Service`.

## Qué responsabilidad tiene un domain service

Un **domain service** expresa una operación del modelo que no encaja de forma natural en una entidad o Value Object. Su significado pertenece al negocio, aunque no haya un objeto concreto que deba «poseer» la operación.

La [referencia de diseño táctico de Microsoft](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design) presenta este recurso junto a entidades, valores y agregados. No significa extraer todos los métodos a servicios. Si una regla pertenece claramente a un pago y sus reservas, mantenerla en `Payment` conserva la responsabilidad donde se entiende mejor.

Aquí la política pertenece a Returns. Fulfillment afirma cuándo hubo entrega; no debería conocer nuestra ventana de devolución. Payment conoce importes; añadirle fechas de entrega lo haría depender de una decisión logística que no necesita para proteger su saldo.

## Antes de programar, decide qué significa treinta días

Para este ejercicio, la ventana es una **duración transcurrida** de treinta bloques de 24 horas, expresada en milisegundos. El límite exacto está incluido. Un milisegundo después, el resultado es `expired`.

No son treinta días de calendario en una zona horaria ni una política legal de desistimiento. Son decisiones ficticias para que el ejemplo tenga un resultado verificable. Si el producto utiliza días naturales o reglas por país, el cálculo debe cambiar con sus tests.

También distinguimos tres situaciones:

- No hay entrega: `awaiting-delivery`.
- Hay entrega dentro de la ventana: `eligible`.
- Hay entrega y la ventana terminó: `expired`.

Un reloj anterior a la fecha de entrega se trata como un error de coherencia. No lo convertimos silenciosamente en una autorización. El dato podría ser incorrecto o el reloj del evaluador estar desajustado; la función no puede saber cuál de las dos cosas ha ocurrido.

## La política recibe hechos propios, no el modelo externo completo

En la [frontera entre contextos](/posts/bounded-context-limites-modelos) dejamos de compartir una entidad universal. Para la política temporal, una nueva traducción produce `ReturnDelivery`: referencia del pedido e instante de entrega, o `null` si todavía está en tránsito.

Archivo: `packages/domain-design/src/return-policy.ts`, contrato de entrada del modelo.

```typescript
export type ReturnDelivery = Readonly<{ orderId: string; deliveredAtMs: number | null }>
```

`returnDeliveryFromShipment` recibe `unknown`, valida el ID y los estados, y acepta fechas únicamente en el formato UTC canónico del fixture, como `2026-01-01T00:00:00.000Z`. Compara el resultado de `toISOString()` con la entrada para rechazar fechas que se normalicen a otro día, como un 30 de febrero.

La función completa está en el laboratorio. No es un parser de todos los formatos ISO 8601. El contrato estrecho es deliberado y está probado. Un estado en tránsito con fecha de entrega se rechaza porque mezcla dos afirmaciones incompatibles en este modelo.

<img src="/assets/visuals/domain-design/DOMAIN-SERVICES.svg" alt="Una entrada logística se valida y traduce a ReturnDelivery; una política pura recibe esos hechos, el instante actual y la ventana y decide entre espera, elegibilidad y caducidad sin acceder a red o base de datos." width="279" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recorrido de la política](/assets/visuals/domain-design/DOMAIN-SERVICES.svg).

## Implementar la regla sin leer el reloj dentro de ella

Archivo: `packages/domain-design/src/return-policy.ts`.

```typescript
export function evaluateReturn(
  delivery: ReturnDelivery,
  nowMs: number,
  windowMs: number,
): 'awaiting-delivery' | 'eligible' | 'expired' {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('invalid current time')
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) throw new Error('invalid window')
  if (
    typeof delivery.orderId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(delivery.orderId)
  )
    throw new Error('invalid delivery')
  if (delivery.deliveredAtMs === null) return 'awaiting-delivery'
  if (!Number.isSafeInteger(delivery.deliveredAtMs) || delivery.deliveredAtMs < 0)
    throw new Error('invalid delivery time')
  if (nowMs < delivery.deliveredAtMs) throw new Error('clock precedes delivery')
  return nowMs - delivery.deliveredAtMs <= windowMs ? 'eligible' : 'expired'
}
```

El instante actual y la ventana entran como argumentos. Así la función no necesita `Date.now()`, una configuración global o un fake timer para probar el borde. Las mismas entradas producen el mismo resultado.

La validación numérica evita evaluar duraciones negativas, fracciones o valores no finitos. Los hechos vienen de una frontera validada, pero el servicio también comprueba sus condiciones mínimas: el tipo TypeScript no es una garantía en ejecución.

No hemos creado una interfaz `Clock` porque aquí pasar un número basta. Si varios casos de uso necesitan obtener el tiempo de una misma fuente, un contrato de reloj puede tener sentido en esa capa. No hace falta anticiparlo para esta función.

## Un test de borde vale más que «devuelve eligible»

Archivo: `packages/domain-design/tests/concepts.test.mjs`, caso del plazo.

```javascript
const delivery = { orderId: 'o1', deliveredAtMs }
assert.equal(evaluateReturn(delivery, deliveredAtMs, windowMs), 'eligible')
assert.equal(evaluateReturn(delivery, deliveredAtMs + windowMs, windowMs), 'eligible')
assert.equal(evaluateReturn(delivery, deliveredAtMs + windowMs + 1, windowMs), 'expired')
```

En el archivo, `deliveredAtMs` corresponde al 1 de enero de 2026 a medianoche UTC y `windowMs` a treinta días de duración. No hay espera real. El ejemplo también cubre ausencia de entrega, reloj anterior, fecha imposible y parámetros inválidos.

Estas pruebas fallaron con la política sin implementar y pasaron al añadir la regla. No es una prueba de exactitud de los relojes de un sistema distribuido: solo verifica la decisión con los instantes que recibe.

## Domain service y application service hacen trabajos distintos

El **application service** obtiene entradas, verifica permisos, carga datos, invoca reglas y coordina la confirmación. El **domain service** de este ejemplo responde si la ventana temporal admite la solicitud.

Si la política empezara a abrir una conexión SQL, llamar a logística y enviar un correo, estaríamos mezclando la decisión con su coordinación. Cambiar cómo obtenemos la fecha obligaría entonces a tocar la regla del plazo.

Tampoco hay que crear un servicio para cada `if`. Esta regla podría ser un método de una entidad `ReturnRequest` si el modelo y su ciclo de vida justificaran que esa entidad poseyera los hechos y la política. Por ahora no existe esa entidad en Returns y una función resulta suficiente.

## Código completo y pruebas

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-services/README.md), la [política](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/return-policy.ts) y su [frontera de entrada](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/return-boundary.ts). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
```

## Garantías y límites

El servicio aplica esta política temporal a los hechos suministrados. No verifica que la entrega sea auténtica, que el usuario tenga permisos o que quede importe para reembolsar. `eligible` no constituye una aprobación completa.

La política no está integrada con la reserva monetaria y no hay una transacción entre logística y pagos. El ejemplo tampoco resuelve cambios de política históricos, calendarios por país o diferencias entre relojes.

## Ejercicio: otra ventana sin otra implementación

Evalúa los mismos hechos con ventanas de catorce y treinta días en el instante correspondiente al día veinte. El primer resultado debe ser `expired` y el segundo `eligible`. No dupliques la función ni leas el reloj desde dentro. Añade el caso del límite exacto para ambas ventanas.

Seguimos con [repositorios y confirmación](/posts/repositorios-eventos-dominio-concurrencia): decidir correctamente todavía no garantiza que otro proceso no haya cambiado el estado que utilizamos.

## Referencias

- [Microsoft: entidades, agregados y domain services](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design).
- [Eric Evans: DDD Reference](https://www.domainlanguage.com/ddd/reference/).

Fuentes consultadas el 20 de octubre de 2026. La ventana es una política didáctica de duración, no una interpretación de requisitos legales.
