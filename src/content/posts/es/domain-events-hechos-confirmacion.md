---
id: DOMAIN-EVENTS
title: 'Domain events: qué ha ocurrido y cuándo podemos anunciarlo'
published: 2026-10-20T09:07:00Z
locale: es
translationKey: domain-events-confirmation
slug: domain-events-hechos-confirmacion
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-REPOSITORIES]
description: 'Distingue intención, hecho candidato, confirmación y publicación. Comprueba qué ocurre al fallar un commit sin confundir domain events, integration events o event sourcing.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, domain-events, eventos, transacciones, testing]
---

El sistema anuncia que ha aceptado una solicitud de reembolso y después falla al guardar la reserva. Quien recibió el aviso cree que existe una operación que el sistema no conserva. Si además actuó sobre ese aviso, no basta con hacer rollback en memoria.

Un **domain event** ayuda a expresar hechos del modelo. No decide por sí solo cuándo son definitivos ni cómo llegan a otro componente. Tenemos que separar esas preguntas para no prometer más de lo que sabemos.

Después de [repositorios y confirmación](/posts/repositorios-eventos-dominio-concurrencia), seguiremos una solicitud desde la decisión del agregado hasta su confirmación. El laboratorio no tiene broker ni proveedor: eso permite observar el contrato sin atribuirle una entrega que no implementa.

## Un evento describe un hecho; un comando pide una acción

El comando expresa una intención: «solicita un reembolso de 70 euros». Puede rechazarse por importe, moneda o repetición. El evento describe algo que el modelo reconoce como sucedido: la solicitud fue aceptada por esta decisión.

Lo llamamos **RefundRequested**, no `RefundCompleted`, porque no hemos consultado un proveedor ni devuelto dinero. El tiempo verbal no sustituye la evidencia del hecho.

La [guía de domain events de Microsoft](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation) distingue el hecho del dominio de la coordinación de sus efectos. Aquí precisaremos además cuándo se confirma el estado que lo origina.

## El payload no necesita exponer el objeto entero

Archivo: `packages/domain-design/src/domain.ts`.

```typescript
export type RefundRequested = Readonly<{
  type: 'RefundRequested'
  paymentId: string
  refundId: string
  minor: number
  currency: Currency
}>
```

Incluye identidad del pago, identidad de la solicitud e importe con moneda. No contiene una referencia editable al agregado, su colección interna o una conexión al repositorio.

El objeto construido por `Payment.requestRefund` también utiliza `Object.freeze`. Sus campos son primitivos: no hay un objeto anidado editable detrás del payload. `Readonly` es una restricción TypeScript, no una protección del runtime.

Este contrato interno es mínimo. No tiene ID único de evento, versión de schema, secuencia o correlación. Sirve para el ejercicio sin constituir un mensaje completo para una integración durable.

## Construir un candidato no equivale a confirmar su existencia

El agregado devuelve `{ next, event }`. Podemos construir esa decisión y descartarla. Mientras no se confirme, el repositorio conserva el estado anterior.

Archivo: `packages/domain-design/tests/concepts.test.mjs`, extracto.

```javascript
const payment = Payment.capture('p1', new Money(10000, 'EUR'))
const repository = new InMemoryPayments(payment)
const decision = payment.requestRefund('r1', new Money(7000, 'EUR'))
assert.equal(decision.event.type, 'RefundRequested')
assert.equal(repository.events.length, 0)
assert.equal(payment.reservedMinor, 0)
```

El hecho forma parte de la **decisión candidata**. Para este contrato, la aplicación solo lo anuncia como aceptado después de que `commit` termine correctamente. No escondemos esa diferencia bajo «emitir», una palabra que a veces se utiliza para construir, guardar y publicar como si fueran lo mismo.

<img src="/assets/visuals/domain-design/DOMAIN-EVENTS.svg" alt="El agregado construye estado y evento candidatos; el commit puede fallar sin confirmarlos o conservar ambos en el fixture. Solo después se anuncia aceptación; la publicación fuera del proceso permanece pendiente." width="270" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar la secuencia](/assets/visuals/domain-design/DOMAIN-EVENTS.svg).

## Prueba que un fallo no anuncia un hecho confirmado

La prueba hace fallar el almacenamiento antes de confirmar. Después verifica que no dejó reserva ni evento guardado y que un nuevo intento puede confirmar uno.

Archivo: `packages/domain-design/tests/concepts.test.mjs`.

```javascript
const repository = new InMemoryPayments(Payment.capture('p1', new Money(10000, 'EUR')))
repository.failNextCommit = true
await assert.rejects(
  requestRefund(repository, 'p1', 'r1', new Money(7000, 'EUR')),
  /storage/,
)
assert.equal(repository.events.length, 0)
assert.equal((await repository.load('p1')).payment.reservedMinor, 0)
const event = await requestRefund(repository, 'p1', 'r1', new Money(7000, 'EUR'))
assert.deepEqual(repository.events, [event])
```

El fake comprueba revisión, reemplaza estado y registra el evento sin un `await` intermedio. El fallo inyectado sucede antes. No es una caída durante un commit SQL ni una respuesta perdida después de persistir.

Si el commit pudiera haberse completado sin respuesta, repetir la intención requeriría conocer su resultado o utilizar idempotencia. No podemos concluir «no ocurrió» solo por un timeout.

## Los handlers también tienen un momento y un contrato

Un **handler** reacciona al evento: podría actualizar una proyección, preparar otro trabajo o notificar. Esos efectos no son intercambiables.

Si debe participar en la misma transacción local, hace falta una unidad de trabajo que permita confirmar o revertir sus escrituras conjuntamente. Este fixture no tiene esos handlers ni una transacción de DB.

Si actúa después del commit, el proceso puede detenerse antes de ejecutarlo. Para trabajo que no podemos perder necesitamos conservar la intención y procesarla de forma recuperable.

Un correo o una llamada bancaria enviados antes del commit no se deshacen al rechazar la escritura. Por eso «ejecutar todos los handlers inmediatamente» no es una política segura para cualquier efecto.

## Domain event e integration event tienen consumidores diferentes

Un **domain event** expresa un hecho del modelo para sus colaboradores. Un **integration event** es un contrato ofrecido a consumidores que pueden desplegarse y evolucionar por separado.

Pueden compartir contenido, pero no conviene exponer una clase interna por accidente. El contrato externo puede necesitar otra selección de datos, compatibilidad, identidad estable y reglas de entrega.

Un **outbox** guardado con el estado permite conservar qué debe publicarse. El relay puede repetir envíos y el consumidor debe tratar duplicados. Se desarrolla con otro laboratorio en [Transactional Outbox e Inbox](/posts/transactional-outbox-inbox-eventos).

Aquí solo guardamos un array en memoria. No hay relay, ACK, retención durable o entrega a otro proceso. No lo presentamos como un outbox de producción.

## Tener eventos no significa hacer event sourcing

El estado actual se conserva como un objeto `Payment`. La lista de `RefundRequested` no es la fuente canónica desde la que reconstruimos el agregado. Ni siquiera incluye el hecho inicial de captura o toda la información necesaria para hacerlo.

En **event sourcing**, la historia de eventos tiene ese papel de fuente para derivar estado, como explica [Fowler al distinguir el estado actual del log de eventos](https://martinfowler.com/eaaDev/EventSourcing.html). Eso exige decisiones de persistencia, orden, evolución y replay. Añadir eventos a un modelo que guarda su estado actual no introduce ese patrón automáticamente.

Tampoco hace falta un evento por setter. Tiene sentido cuando un hecho importa y un colaborador necesita reaccionar. Una llamada directa puede expresar mejor una colaboración local pequeña; un bus interno también añade indirección y seguimiento de errores.

## Código completo y pruebas

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-events/README.md), el [contrato del evento](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/domain.ts) y las [pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/tests/concepts.test.mjs). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
```

## Garantías y límites

El fixture distingue evento candidato de confirmado y no guarda cambios ante el fallo previo al commit probado. No demuestra durabilidad, entrega, ejecución bancaria o recuperación tras una caída.

Un ID de solicitud repetido se rechaza, no se reutiliza su resultado. No hay garantía **exactly once** para efectos externos, replay completo o un sistema de integración que consuma estos eventos.

## Ejercicio: una reacción que no debe adelantarse

Añade una reacción de prueba que cuente solicitudes aceptadas únicamente después del commit. Ante el fallo, el contador debe seguir a cero; después de confirmar un intento debe valer uno. Documenta qué ocurriría al caer entre commit y reacción, sin afirmar que el contador resuelve esa ventana.

Seguimos con [C4 y niveles de arquitectura](/posts/c4-contexto-contenedores-componentes): podemos dibujar las responsabilidades existentes y los mecanismos que todavía son una propuesta.

## Referencias

- [Microsoft: domain events, handlers e integration events](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation).
- [Martin Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html).
- [Eric Evans: DDD Reference](https://www.domainlanguage.com/ddd/reference/).

Fuentes consultadas el 20 y 21 de octubre de 2026. Pruebas en memoria, sin broker, event store o proveedor externo.
