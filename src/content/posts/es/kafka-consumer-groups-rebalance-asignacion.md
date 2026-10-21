---
id: KAFKA-GROUPS
title: 'Consumer groups en Kafka: repartir particiones no es repartir efectos una sola vez'
published: 2026-10-21T12:02:00Z
locale: es
translationKey: kafka-consumer-groups-rebalance
slug: kafka-consumer-groups-rebalance-asignacion
draft: true
status: draft
level: intermedio
prerequisites: [KAFKA-PARTITIONS]
description: 'Observa dos consumidores de un grupo repartiendo particiones y una reasignación al salir un miembro. Distingue ownership del grupo, posiciones confirmadas y efectos de negocio.'
author: 'Luis Ramírez Calle'
series: 'Kafka: logs, consumidores y reconstrucción de estado'
tags: [kafka, consumer-groups, rebalance, concurrencia, sistemas-distribuidos]
---

Añadimos una segunda instancia del consumidor, pero no queremos que ambas reconstruyan todo el panel por separado. Queremos repartir el trabajo y poder reasignarlo cuando una deje de participar.

Un **consumer group** permite esa coordinación. No garantiza que un efecto externo ocurra exactamente una vez, ni convierte cualquier número de instancias en paralelismo útil.

En [particiones y claves](/posts/kafka-particiones-claves-orden-eventos) delimitamos el orden. Ahora observaremos quién recibe cada partición y qué cambia cuando un miembro sale.

## Un group ID representa un suscriptor lógico

Las instancias que comparten **`groupId`** participan en un mismo grupo. Bajo el modelo clásico utilizado aquí, las particiones se asignan entre sus miembros: una partición tiene un miembro asignado dentro de ese grupo en una asignación estable.

Otro grupo tiene asignación y posiciones independientes. Por eso live y rebuild pueden leer todo el historial cada uno, mientras dos instancias de live se reparten sus particiones.

No debemos mezclar las identidades. Si queremos que dos aplicaciones reciban todos los eventos por separado, normalmente necesitan grupos distintos. Si hacemos que una instancia use un ID aleatorio en cada arranque, también dejamos de reanudar el grupo estable anterior.

La [referencia de KafkaConsumer](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html) describe ese modelo. Aunque sus ejemplos sean Java, es la coordinación que el cliente del laboratorio utiliza con el broker.

## Dos miembros y dos particiones permiten observar una asignación

Archivo: `packages/kafka-streaming/tests/broker.test.mjs`. `kafka` es el cliente fijado a loopback; `groupId` pertenece a la ejecución actual.

```javascript
const one = kafka.consumer({ groupId, sessionTimeout: 10000, heartbeatInterval: 1000, allowAutoTopicCreation: false })
const two = kafka.consumer({ groupId, sessionTimeout: 10000, heartbeatInterval: 1000, allowAutoTopicCreation: false })
```

Creamos dos objetos consumidores dentro del mismo proceso de test. Son dos miembros reales del grupo, con conexiones y protocolo reales. No son dos máquinas independientes y no probamos aislamiento de fallos entre procesos.

Cada uno conecta, se suscribe al mismo topic y ejecuta un handler. Registramos el evento **`GROUP_JOIN`** de KafkaJS para observar la asignación que obtuvo. No deducimos el reparto contando líneas de logs.

El test espera hasta que cada miembro tenga una partición y comprueba que son distintas. No fija que one deba recibir siempre la 0. La identidad concreta puede variar y no forma parte del contrato que queremos verificar.

## Una salida limpia provoca una nueva asignación

Publicamos un registro en cada partición de forma explícita. Así aseguramos que ambos miembros tienen trabajo en este caso, independientemente de las colisiones de keys observadas en la entrega anterior.

Después detenemos y desconectamos two. Archivo: `tests/broker.test.mjs`, extracto posterior a recibir los dos registros.

```javascript
await two.stop(); await two.disconnect()
await eventually(() => assignments.get('one')?.length === 2)
assert.deepEqual([...assignments.get('one')].sort(), [0, 1])
```

El miembro restante recibe ambas particiones. `eventually` tiene un deadline y consulta una condición observable. No es un `sleep` que da el test por válido porque pasó cierto tiempo.

<img src="/assets/visuals/kafka-streaming/KAFKA-GROUPS.svg" alt="Un topic tiene dos particiones repartidas entre dos miembros del mismo grupo; uno sale limpiamente, ocurre un rebalance del grupo clásico y el miembro restante recibe ambas particiones." width="291" height="692" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kafka-streaming/KAFKA-GROUPS.svg).

La salida es **graceful**, no un `kill -9`, una partición de red o un proceso bloqueado. Esas situaciones requieren detección y tiempos diferentes. No llamamos «recuperación tras crash» a esta prueba.

## Heartbeats y procesamiento tienen obligaciones distintas

Los **heartbeats** permiten mantener la participación en el grupo bajo su protocolo. Si el cliente deja de cumplir las condiciones temporales, puede perder su asignación y provocar una reasignación.

Esto no demuestra que haya terminado su trabajo de negocio. Un servidor puede seguir vivo mientras una escritura externa está atascada. También puede perder participación después de aplicar un cambio y antes de confirmar el offset.

Con KafkaJS hay que conocer cómo el handler colabora con sus heartbeats y los límites de sesión. No conviene bloquear el event loop con un cálculo largo y asumir que un temporizador de heartbeats seguirá ejecutándose normalmente.

Los diez segundos de `sessionTimeout` y el segundo de `heartbeatInterval` son valores de este harness. No son un SLO de recuperación ni una recomendación de tuning. La [documentación del consumidor KafkaJS](https://kafka.js.org/docs/consuming) concreta sus APIs y condiciones.

## Asignación exclusiva no implica efectos exactamente una vez

Supongamos que one aplica un evento a un sistema externo y pierde su participación antes de confirmar el avance. El siguiente miembro puede volver a leer ese registro. La asignación estable de cada momento no evita esa repetición entre momentos.

Además, perder una asignación no revierte una petición externa que ya salió. Hacen falta un diseño de checkpoint, idempotencia y, cuando corresponda, mecanismos para impedir escrituras de una autoridad antigua.

Este laboratorio de grupos no produce efectos externos ni persiste una proyección. Su handler solo registra qué miembro recibió cada partición. La siguiente entrega comprueba por separado repetición y reanudación con commits.

No confiamos en un array compartido para simular coordinación: el array recoge observaciones, pero la asignación procede del broker y los clientes. Tampoco confundimos el coordinador del grupo con un protocolo que decide nuestras reglas de negocio.

## El número de particiones limita este modo de repartir trabajo

Con dos particiones y tres miembros de un grupo clásico no pueden tener los tres una partición propia simultáneamente. Puede quedar un miembro sin asignación. Eso no es necesariamente un fallo del autoscaler: es un límite de la unidad que estamos repartiendo.

Si una partición concentra toda la carga, añadir miembros tampoco divide automáticamente su secuencia. Cambiar keys o particiones puede ayudar en unos casos y romper el ámbito de orden en otros.

Más consumidores también pueden aumentar carga sobre una base de datos o proveedor compartido. Antes de escalar conviene saber si el cuello de botella está en CPU, disco, red o en el destino del procesamiento.

Aquí no medimos throughput, duración de rebalance o coste de tener miembros inactivos. El test comprueba asignación y reasignación, no dimensiona un clúster.

## La explicación corresponde al protocolo usado, no a cualquier modo de Kafka

El laboratorio fija **Kafka 3.9.1 y KafkaJS 2.2.4 con el protocolo clásico**. No usa los nuevos protocolos de grupos ni share groups de otras versiones.

La [documentación de Kafka sobre el nuevo protocolo de rebalance](https://kafka.apache.org/41/operations/consumer-rebalance-protocol/) distingue grupos clásicos de la alternativa disponible desde Kafka 4.0. No hay que trasladar opciones y comportamiento de un cliente a otro por compartir el nombre «consumer group».

Esa distinción importa al leer recetas de tuning: versión, cliente, protocolo y asignador son parte del contexto. Mantener una versión reproducible en este ejercicio no implica recomendarla como la última para un proyecto nuevo.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/kafka-groups/README.md), el [test de miembros y asignaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kafka-streaming/tests/broker.test.mjs) y el consumidor acotado del laboratorio.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/kafka-streaming broker:up
pnpm --dir packages/kafka-streaming test:integration
pnpm --dir packages/kafka-streaming broker:down
```

Necesitas Docker y la imagen fijada indicada en el README. Los tests generan sus topics y grupos con un prefijo aleatorio y retiran solo esos recursos al terminar.

## Garantías y límites

Dos miembros reales se reparten dos particiones y reciben un registro cada uno. Tras la salida limpia de uno, el otro obtiene ambas. La evidencia archiva las asignaciones, sin exigir que una identidad conserve un número fijo.

Un broker, un proceso de test, plaintext local y sin efectos externos. No se comprueban crashes, failover del broker, solapamiento de efectos durante una pérdida de autoridad o exactly-once. El mismo test no demuestra todos los caminos de rebalance posibles.

## Ejercicio: distinguir suscripción y capacidad

Diseña dos consumidores que necesitan todos los eventos y dos réplicas de cada uno. ¿Cuántos group IDs estables usarías? Después reduce el topic a una partición y explica qué miembros podrán trabajar en cada grupo.

Anota qué debería ocurrir si una instancia aplica un cambio y se va antes de confirmar su posición. Esa es la situación que abordamos en [offsets, commits y replay](/posts/kafka-offsets-commits-reconstruir-proyeccion).

## Referencias

- [Apache Kafka 3.9: KafkaConsumer](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html).
- [KafkaJS: consumo y participación en grupos](https://kafka.js.org/docs/consuming).
- [Apache Kafka 4.1: protocolos de rebalance](https://kafka.apache.org/41/operations/consumer-rebalance-protocol/).

Fuentes consultadas el 21 de octubre de 2026. La prueba ejercita el protocolo clásico del entorno fijado.
