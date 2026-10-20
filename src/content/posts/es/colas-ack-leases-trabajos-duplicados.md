---
id: DIST-QUEUES
title: 'Colas y workers: cuándo confirmar un trabajo y qué pasa si se repite'
published: 2026-10-17T03:03:00Z
locale: es
translationKey: reliable-queues-leases
slug: colas-ack-leases-trabajos-duplicados
draft: true
status: draft
level: intermedio
prerequisites: [DIST-RETRIES]
description: 'Entiende ACK, redelivery, visibility timeout y leases. Un worker puede recibir otra vez un trabajo cuyo efecto ya ocurrió.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [colas, workers, mensajeria, resiliencia]
---

Un worker envía una notificación y cae antes de confirmar el trabajo. La cola lo vuelve a entregar. Si el siguiente worker repite el envío sin reconocer la operación anterior, el usuario recibe dos notificaciones.

Mover trabajo a segundo plano cambia dónde espera, no elimina las ventanas de fallo. Después de [limitar retries y concurrencia](/posts/retries-deadlines-backoff-backpressure), veremos qué promete realmente una cola.

## Enviar, recibir y aplicar son hechos distintos

El **producer** publica un mensaje. El broker puede confirmar su recepción bajo su contrato. Un **consumer** recibe una entrega y después confirma que ha terminado mediante un **ACK**. La confirmación del productor no demuestra que el consumidor haya completado el trabajo.

Si confirmamos antes de guardar el efecto y caemos, podemos perder el trabajo. Si confirmamos después, una caída intermedia puede generar una nueva entrega. Esta segunda estrategia requiere un consumidor que soporte repetición.

**At-most-once** evita ciertas entregas repetidas a costa de poder perderlas. **At-least-once** admite repetición para recuperar trabajo, bajo las condiciones y la disponibilidad del sistema. Ninguna etiqueta equivale por sí sola a «email enviado exactamente una vez».

<img src="/assets/visuals/reliable-services/DIST-QUEUES.svg" alt="La cola entrega un trabajo al worker A con una lease; al vencer puede entregarlo al worker B, cuyo token nuevo invalida el ACK antiguo pero no deshace efectos externos." width="701" height="788" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-QUEUES.svg).

## Una lease concede tiempo, no inmortalidad

En algunos sistemas el trabajo deja de ser visible temporalmente; en otros permanece asociado a una entrega no confirmada. Los mecanismos concretos varían. El modelo del laboratorio utiliza una **lease**, una reclamación que caduca.

Archivo: `reliable-services/src/distributed.ts` (extracto de `LeaseQueue`).

```typescript
  claim(now: number, duration: number): { id: string; token: number } | undefined {
    const job = this.jobs.find((job) => !job.done && job.until <= now)
    if (!job) return undefined
    job.until = now + duration
    job.token = ++this.sequence
    return { id: job.id, token: job.token }
  }
```

El worker recibe un token distinto en cada reclamación. El ACK solo se acepta si coincide con la reclamación actual. El test deja vencer la primera lease, reclama desde otro worker y comprueba que el ACK antiguo se rechaza.

Eso protege el estado de **esta cola en memoria**. No detiene al worker antiguo: podría despertar tras una pausa y seguir llamando al proveedor. Un fencing token solo protege un recurso si ese recurso también lo comprueba. Para un tercero que no lo acepta, necesitaremos otra coordinación o una identidad externa idempotente.

## Un trabajo defectuoso no debe circular para siempre

Define número de intentos, espera y condiciones para enviar un mensaje a una **dead-letter queue**, o **DLQ**. La DLQ necesita propietario, inspección y procedimiento de replay; no es una papelera que resuelve el fallo.

Conserva el identificador lógico al reintentar para que el consumidor pueda reconocerlo. Si cada entrega recibe una identidad de negocio nueva, la deduplicación deja de servir.

También importa el orden. Una cola con varios workers puede completar trabajos en orden distinto al de recepción. Si dos mensajes actualizan la misma operación, utiliza versiones y reglas o limita explícitamente la coordinación por esa clave.

## Una cola y un event log sirven a necesidades distintas

Una cola suele repartir trabajos entre consumidores. Un **event log** retenido permite que distintos consumidores mantengan posiciones y reproduzcan historia. Kafka puede ser adecuado para replay y múltiples proyecciones, pero añade operación y contratos de partición.

Si solo necesitas recuperar un pequeño trabajo local, una tabla de pendientes puede ser suficiente. Si necesitas publicar eventos hacia otros sistemas, aparece otro problema: guardar y publicar de forma consistente. Lo abordaremos con Outbox.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-queues/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

`LeaseQueue` pierde todo al reiniciar. No es un broker, no renueva leases ni implementa DLQ. El experimento verifica redelivery y rechazo de ACK antiguo con tiempo simulado. No mata un proceso real ni afirma durabilidad de mensajes.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/distributed.ts). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="lease:" tests/core.test.mjs
```

## Ejercicio: caída después del efecto

Añade un contador de efecto lógico y ejecuta el mismo trabajo tras vencer su lease. Primero reproduce dos efectos; después introduce deduplicación y exige uno. No uses el token de entrega como identidad de negocio.

Seguimos con [webhooks: mensajes que no controlamos al publicar](/posts/webhooks-firmas-inbox-eventos-desordenados).

## Referencias

- [RabbitMQ: consumer acknowledgements y publisher confirms](https://www.rabbitmq.com/docs/confirms).
- [Amazon SQS: visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html).
- [Apache Kafka: diseño y garantías](https://kafka.apache.org/41/design/design/).

Fuentes consultadas el 17 de octubre de 2026. No se ejecutan RabbitMQ, SQS ni Kafka en esta demo.
