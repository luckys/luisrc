---
id: KAFKA-PARTITIONS
title: 'Particiones y claves en Kafka: el orden que necesitas tiene un ámbito'
published: 2026-10-21T12:01:00Z
locale: es
translationKey: kafka-partitions-keys-ordering
slug: kafka-particiones-claves-orden-eventos
draft: true
status: draft
level: intermedio
prerequisites: [P051, DIST-SHARDING]
description: 'Publica eventos con key, observa su partición y distingue orden de append, orden de negocio y ejecución del handler. Incluye el coste de cambiar el particionado.'
author: 'Luis Ramírez Calle'
series: 'Kafka: logs, consumidores y reconstrucción de estado'
tags: [kafka, particiones, ordering, event-streaming, typescript]
---

El envío se marca como entregado y después vuelve a «en camino». Antes de culpar a Kafka por desordenar mensajes, necesitamos saber a qué partición fue cada uno y en qué orden terminó nuestro propio código.

La promesa útil no es «Kafka mantiene el orden» sin más. Hay que declarar **qué registros**, **dentro de qué partición** y **hasta qué punto del procesamiento** queremos ordenados.

En [el log retenido](/posts/kafka-topics-log-retencion-replay) vimos que podemos releer. Ahora elegiremos la key y observaremos el routing. La relación con [sharding](/posts/sharding-claves-buckets-rebalanceo) ayuda a entender la distribución, pero una partición de Kafka no tiene el mismo contrato que un shard de aplicación.

## El offset solo ordena una partición

Un topic de dos particiones tiene dos secuencias de offsets. La posición 10 de la partición 0 no significa «antes» o «después» de la posición 8 de la partición 1 en un único orden global del topic.

Dentro de una partición, el log ordena sus registros. Ese orden es el de append, no una reconstrucción automática de la intención humana ni de relojes físicos de productores distintos.

Si dos productores envían cambios incompatibles, ponerles la misma key puede llevarlos al mismo log, pero no determina cuál tenía autoridad para decidir el estado. El broker puede ordenar dos instrucciones que la aplicación no debería haber aceptado juntas.

La [documentación introductoria de Kafka](https://kafka.apache.org/39/getting-started/introduction/) describe la relación entre keys y particiones. Necesitamos completarla con un contrato de productor y consumidor para conservar el orden que importa al negocio.

## Una key estable mantiene juntos los cambios relacionados

Para este fixture elegimos **`shipmentId`**. Todos los cambios de `s-1` utilizan la misma key; lo mismo ocurre con `s-2`. No usamos `eventId`, porque cambia en cada evento y no expresa qué registros deben compartir partición.

Archivo: `packages/kafka-streaming/src/client.ts`. El archivo importa `Partitioners` desde KafkaJS y fija el broker a loopback.

```typescript
export function localProducer() {
  return localKafka().producer({ allowAutoTopicCreation: false,
    createPartitioner: Partitioners.DefaultPartitioner, maxInFlightRequests: 1 })
}
```

Fijamos el **partitioner** para que el contrato no dependa de elegirlo implícitamente. KafkaJS ofrece más de uno y su [documentación de producción](https://kafka.js.org/docs/producing) explica la elección. Si combinamos clientes o lenguajes, no debemos asumir que todos aplican el mismo algoritmo sin verificarlo.

`maxInFlightRequests: 1` limita solicitudes simultáneas de ese productor. No convierte el historial en una transacción global, no elimina duplicados de negocio y no demuestra tolerancia a todos los retries posibles.

## La publicación del fixture espera cada envío

Archivo: `tests/broker.test.mjs`, helper de publicación. `partition` solo se especifica en el test de asignación a miembros, donde necesitamos poblar ambas particiones deliberadamente.

```javascript
async function publish(name, events, partition) {
  for (const event of events) await producer.send({ topic: name, acks: -1,
    messages: [{ key: event.shipmentId, value: JSON.stringify(event), ...(partition === undefined ? {} : { partition }) }] })
}
```

Esperar cada `send` hace explícito el orden de publicación del pequeño dataset. No presentamos ese bucle secuencial como una configuración de alto throughput. Batching y concurrencia cambian el coste y requieren conservar las garantías elegidas.

Cuando no forzamos partición, el partitioner decide a partir de la key y la metadata del topic. Cuando la forzamos, estamos saltándonos ese routing automático. El segundo caso sirve para comprobar dos consumidores, no es una recomendación para asignar envíos manualmente a servidores.

<img src="/assets/visuals/kafka-streaming/KAFKA-PARTITIONS.svg" alt="La key shipmentId pasa por un partitioner con número fijo de particiones, mantiene las versiones de cada envío en una partición y necesita un handler secuencial; no crea orden global o autoridad entre writers." width="360" height="708" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kafka-streaming/KAFKA-PARTITIONS.svg).

## Dos keys no garantizan dos particiones ocupadas

La ejecución archivada tiene un detalle útil: **s-1 y s-2 terminaron ambos en la partición 1**. Los seis registros obtuvieron allí los offsets 0 a 5. Un hash puede asignar claves distintas al mismo destino.

El test no exige que dos keys se repartan una en cada partición. Comprueba que cada envío se mantiene en una única partición y que sus versiones se leen como 1, 2 y 3. Cambiar esa expectativa a «deberían estar equilibradas» convertiría una suposición falsa en un test inestable.

Dos particiones disponibles tampoco significan el doble de capacidad utilizada. Importan la distribución de keys y el trabajo asociado a cada una. El caso de dos miembros usa particiones explícitas para medir asignación, separado de este caso de hashing.

No extrapolamos esos seis registros a una distribución de producción. La evidencia se conserva para mostrar exactamente qué pasó, no para afirmar que la key está bien elegida para cualquier carga.

## El handler puede desordenar efectos que leyó correctamente

Si leemos `shipped` y después `delivered`, pero lanzamos ambas tareas sin esperarlas, la primera podría terminar más tarde y sobrescribir el resultado de la segunda. El log seguiría ordenado; el desorden lo habría introducido el procesamiento.

El consumidor del laboratorio utiliza **`eachMessage`**, espera el callback y procesa una partición secuencialmente. No usa `forEach(async ...)` ni dispara promesas sin esperar. Antes de confirmar una posición necesita saber que el trabajo anterior terminó según su contrato.

Se puede aumentar concurrencia entre particiones manteniendo secuencia dentro de cada una, si el cliente y la implementación lo respetan. No equivale a paralelizar sin restricciones todos los mensajes de una partición.

La proyección comprueba además `version` por envío. Ese número es una regla del contrato de eventos, no el offset de Kafka. Las versiones de dos envíos pueden intercalarse en el mismo log y seguir siendo correctas para cada envío.

## Añadir particiones puede cambiar el destino de una key

Un partitioner basado en hash y número de particiones puede elegir otro destino si cambia ese número. Los registros antiguos no se mueven mágicamente a la nueva partición.

Durante una transición, el historial de una key puede quedar repartido entre destinos. Una promesa basada en «todos los cambios de este envío viven juntos» necesita un plan para esa modificación, no solo ejecutar una ampliación.

También puede cambiar el routing si modificamos la codificación de la key, el algoritmo o el modo de especificar particiones. Mantener la misma cadena visual no basta si un cliente envía otros bytes.

En este laboratorio fijamos dos particiones durante toda la prueba de keys. No aumentamos el topic ni demostramos una migración de particionado. El riesgo se explica para no atribuir a una configuración fija garantías sobre cualquier cambio futuro.

## Una key muy popular limita el paralelismo útil

Si todos los eventos usan la misma key, mantener su orden los concentra en una partición. Añadir consumidores a ese grupo no permite dividir libremente esa secuencia entre ellos bajo el modelo clásico de consumer groups.

Si dividimos artificialmente la key para repartir más, también cambia el ámbito de coordinación. Podría ser razonable si son operaciones independientes; podría romper una regla que exige una secuencia única.

Por eso primero identificamos qué debe procesarse junto. Después medimos distribución, coste por key, backlog y capacidad. El número de particiones no sustituye el análisis del acceso a los datos.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/kafka-partitions/README.md), el [productor configurado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kafka-streaming/src/client.ts), fixtures y pruebas del broker.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/kafka-streaming broker:up
pnpm --dir packages/kafka-streaming test:integration
pnpm --dir packages/kafka-streaming broker:down
```

La imagen oficial fijada debe estar descargada como indica la primera entrega y el README. El arranque no la obtiene implícitamente.

## Garantías y límites

Comprobamos publicación y consumo reales con broker 3.9.1, KafkaJS 2.2.4, un productor y topología fija. Cada envío conserva una partición y versiones ordenadas. La colisión de las dos keys se registra, no se oculta.

No hay orden global entre particiones, varios productores concurrentes, cambio de particionado, pruebas de retries bajo caída, rebalanceo de datos o benchmark. `acks=all` se ejecuta con RF=1; no demuestra redundancia.

## Ejercicio: elegir el ámbito de orden

Compara tres keys: `eventId`, `shipmentId` y `tenantId`. Explica qué cambios quedarían juntos, qué cliente podría concentrar carga y qué ocurriría al duplicar particiones. No elijas por el aspecto del identificador, sino por la regla que quieres proteger.

La siguiente entrega estudia [consumer groups y rebalance](/posts/kafka-consumer-groups-rebalance-asignacion): cómo se reparte el trabajo de esas particiones entre instancias.

## Referencias

- [Apache Kafka 3.9: eventos, keys y particiones](https://kafka.apache.org/39/getting-started/introduction/).
- [KafkaJS: producción, keys y partitioners](https://kafka.js.org/docs/producing).
- [Apache Kafka: API de KafkaConsumer y ámbito de los offsets](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html).

Fuentes consultadas el 21 de octubre de 2026. Las observaciones proceden de seis registros sintéticos, no de una carga representativa de producción.
