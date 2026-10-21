---
id: KAFKA-REPLAY
title: 'Offsets, commits y replay: reconstruir una proyección sin repetir sus efectos'
published: 2026-10-21T12:03:00Z
locale: es
translationKey: kafka-offsets-commits-rebuild
slug: kafka-offsets-commits-reconstruir-proyeccion
draft: true
status: draft
level: intermedio
prerequisites: [KAFKA-GROUPS, ARCH-CQRS]
description: 'Comprueba redelivery sin commit y reanudación desde la siguiente posición. Reconstruye dos envíos con un grupo nuevo y separa deduplicación, checkpoints y exactly-once.'
author: 'Luis Ramírez Calle'
series: 'Kafka: logs, consumidores y reconstrucción de estado'
tags: [kafka, offsets, replay, cqrs, idempotencia, typescript]
---

Un consumidor aplica el evento de un envío y se detiene antes de confirmar el avance. Al arrancar otra instancia del mismo grupo, ese registro vuelve a aparecer. Kafka no sabe si la aplicación terminó su trabajo: solo conoce el checkpoint que recibió.

La solución no es confirmar cuanto antes para evitar repeticiones. Confirmar antes del efecto crea la ventana opuesta: podemos saltarnos trabajo que nunca terminó.

Después de [consumer groups](/posts/kafka-consumer-groups-rebalance-asignacion), necesitamos concretar qué significa avanzar y cómo reconstruir una proyección. Partimos del [read model de CQRS](/posts/cqrs-modelos-lectura-consistencia), pero ahora los registros llegan desde un broker real.

## Offset, posición de lectura y commit no son el mismo estado

El **offset del registro** identifica su posición dentro de una partición. La posición actual del consumidor indica por dónde va leyendo. El **committed offset** del grupo es el checkpoint desde el que podrá reanudarse.

En el contrato que usamos, confirmar 1 significa que la siguiente posición es 1: el registro 0 ya se consideró procesado. No confirmamos 0 para expresar que hemos terminado con 0.

Ese checkpoint pertenece al grupo, topic y partición. No hay un único offset global para todo el topic. Tampoco debe confundirse con `version: 3` de un envío: varios envíos intercalados comparten el log, pero cada uno tiene su secuencia de negocio.

La [referencia de KafkaConsumer](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html) distingue posición y commit. Los offsets tampoco tienen que ser consecutivos en cualquier topic: limpieza y transacciones pueden producir huecos visibles para el lector.

## Sumamos la siguiente posición sin perder precisión

KafkaJS representa offsets como strings. Convertirlos a `number` puede perder precisión con enteros grandes. Archivo: `packages/kafka-streaming/src/offsets.ts`.

```typescript
export function nextOffset(current: string): string {
  const next = offset(current) + 1n
  if (next > maximum) throw new Error('offset_overflow')
  return next.toString()
}
```

`offset` valida una representación decimal canónica no negativa dentro del rango definido por el helper; `maximum` es el máximo entero positivo de 64 bits con signo. Los tests incluyen `9007199254740993`, fuera de la precisión entera segura de `number`.

No exigimos que el siguiente registro físico tenga exactamente ese offset. Es una posición de reanudación; si hay un hueco, el broker puede devolver el siguiente registro disponible a partir de ella.

## El handler termina antes de confirmar

Archivo: `src/collect.ts`, extracto del consumidor de pruebas. `onRecord` es el trabajo que queremos esperar y `nextOffset` es el helper anterior.

```typescript
await onRecord(record, { pause, heartbeat })
if (commit) await consumer.commitOffsets([
  { topic, partition, offset: nextOffset(message.offset) },
])
```

Desactivamos auto commit y confirmamos explícitamente después del callback. Esto permite observar el punto de fallo. No hace atómicos el callback y el commit de Kafka.

El caso sin commit lee 0 y desconecta limpiamente. El mismo grupo vuelve a leer 0. Después confirma 1 y otra instancia reanuda en 1 y 2, hasta dejar el checkpoint en 3. El parámetro `fromBeginning: true` no ignora un checkpoint válido ya existente.

No matamos un proceso ni cortamos la red. Simulamos deliberadamente el resultado «lectura realizada, checkpoint no enviado» y observamos la repetición mediante nuevas instancias. La incertidumbre de una pérdida real de respuesta al commit sería otro caso.

<img src="/assets/visuals/kafka-streaming/KAFKA-REPLAY.svg" alt="Se lee el registro cero, se valida y aplica antes de confirmar la siguiente posición uno; una reconstrucción independiente usa otro grupo y una proyección vacía para releer la historia y obtener dos envíos entregados." width="315" height="708" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kafka-streaming/KAFKA-REPLAY.svg).

## El evento necesita un contrato además de JSON válido

El decoder exige key y value, limita el value a 4096 bytes, rechaza UTF-8 inválido y valida los campos que utiliza: schema version, event ID, shipment ID, versión y estado. La key debe coincidir con el shipment ID del payload.

No aceptamos tombstones en este contrato. Tampoco convertimos una versión string a número. Es una decisión del formato del fixture, no una afirmación de que Kafka prohíba esos otros valores.

Los eventos describen tres transiciones ficticias: **created → shipped → delivered**, con versiones 1, 2 y 3. No modelamos devoluciones, incidencias o correcciones. La proyección sirve para aprender replay sin esconder esas posibilidades bajo un workflow supuestamente completo.

Schema version y versión del envío responden preguntas distintas. La primera identifica el formato; la segunda indica el progreso de esa entidad. Cambiar un campo del JSON no debe interpretarse como una nueva transición del envío.

## Deduplicar exige reconocer el mismo evento, no cualquier versión antigua

La proyección guarda una huella canónica de cada **`eventId`** aplicado. Una repetición idéntica devuelve `false` y no cambia el estado. El mismo ID con contenido distinto produce `conflicting_event`.

Para un ID nuevo, exige la siguiente versión del envío y la transición esperada. No descarta silenciosamente cualquier registro antiguo: un hueco o una contradicción puede significar historia incompleta, un error del productor o un cambio de contrato.

Archivo: `src/projection.ts`, validaciones anteriores al cambio del read model.

```typescript
const current = shipments.get(event.shipmentId)
if (event.version !== (current?.version ?? 0) + 1) throw new Error('unexpected_version')
if (event.status !== stages[event.version - 1]) throw new Error('invalid_transition')
```

Las comprobaciones ocurren antes de guardar. Los tests verifican que un fallo no deja un estado parcialmente actualizado. Devolvemos snapshots con registros inmutables y arrays independientes para que una consulta no modifique la proyección.

Esa deduplicación vive en memoria. Al reiniciar se pierde. No presentamos el Map como almacenamiento durable ni como protección suficiente para enviar correos, cobrar o escribir en otra base de datos una sola vez.

## Reconstruir usa otra identidad de lector y un destino vacío

Publicamos seis eventos de dos envíos. El grupo live los aplica. Después creamos una proyección vacía y un **grupo rebuild nuevo**, que vuelve a leer el historial disponible. Ambos obtienen `s-1` y `s-2` en versión 3, estado delivered.

No reseteamos offsets de un grupo que esté atendiendo tráfico. Esa operación puede alterar su trabajo y requiere coordinación. Una reconstrucción en un destino separado permite comparar antes de decidir un cambio de lectura.

Si esa lógica ejecutara efectos externos al releer, la reconstrucción podría repetirlos. Aquí el callback solo deriva estado en memoria, sin correos, llamadas HTTP o pagos. Separar proyecciones de efectos ayuda a que «reprocesar» tenga un significado controlado.

También hay que conservar suficiente historia y decoders compatibles. El test de inicio avanzado del post anterior muestra que recibir solo la versión 3 no permite reconstruir estas transiciones desde cero.

## Un checkpoint durable con una vista volátil no es recuperación completa

Kafka conserva el checkpoint del grupo, pero nuestra proyección no sobrevive al reinicio. Reanudar ese grupo en la posición 6 con un Map vacío no devuelve por arte de magia los cambios 0 a 5.

Por eso el test de reanudación comprueba offsets, no recuperación durable del read model. Para reconstruir usamos otro grupo desde el historial disponible. Una aplicación permanente necesita decidir cómo conserva vista y checkpoint y qué hace ante diferencias entre ambos.

Las transacciones de Kafka tienen garantías dentro de su ámbito, especialmente al leer y escribir topics con los clientes y aislamiento adecuados. No incorporan automáticamente una base SQL o un proveedor externo. Este laboratorio no usa producer transactions ni demuestra **exactly-once** de efectos externos.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/kafka-replay/README.md), la [proyección](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kafka-streaming/src/projection.ts) y el consumidor acotado. Incluye ocho tests locales y los casos con broker.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/kafka-streaming test
pnpm --dir packages/kafka-streaming typecheck
pnpm --dir packages/kafka-streaming broker:up
pnpm --dir packages/kafka-streaming test:integration
pnpm --dir packages/kafka-streaming broker:down
```

Consulta la imagen requerida en el README antes de arrancar. El consumidor está limitado a topics/grupos editoriales, mil registros y un deadline; no es un worker de producción listo para dejar ejecutándose.

El deadline hace fallar la espera de resultados, pero no mata por la fuerza un callback que no termina. El cierre espera ese trabajo: los callbacks del harness deben finalizar o colaborar en su cancelación. No utilizamos el temporizador como garantía de que cualquier operación externa quedó cancelada.

## Garantías y límites

Observamos redelivery de 0 sin commit, reanudación en 1 tras confirmar 1 y reconstrucción independiente de dos envíos. Las pruebas locales contrastan duplicado idéntico, ID contradictorio, hueco y validación antes de mutar.

Sin read model durable, commit atómico con SQL, producer transactions, crash real o efectos externos. Las huellas crecen en memoria y no tienen política de retención. El resultado es una proyección didáctica comprobada, no una garantía distribuida de exactly-once.

## Ejercicio: localizar las dos ventanas de fallo

Dibuja aplicar y confirmar como pasos separados. Sitúa una caída entre ambos en cada orden posible. Explica cuándo aparece repetición y cuándo puede saltarse trabajo, y qué evidencia necesitarías para recuperar una vista persistente.

Después introduce un callback lento. ¿Cuánto trabajo dejarías entrar al proceso mientras esperas? La última entrega aborda [lag y backpressure](/posts/kafka-consumer-lag-backpressure-pause-resume).

## Referencias

- [Apache Kafka 3.9: KafkaConsumer, posiciones y commits](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html).
- [KafkaJS: manual committing](https://kafka.js.org/docs/consuming#manual-committing).
- [Apache Kafka 3.9: message delivery semantics](https://kafka.apache.org/39/design/design/#message-delivery-semantics).

Fuentes consultadas el 21 de octubre de 2026. La reconstrucción no llama a sistemas externos.
