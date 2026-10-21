---
id: P051
title: 'Kafka y el log retenido: leer un evento no lo elimina'
published: 2026-10-21T12:00:00Z
locale: es
translationKey: kafka-retained-log-topics
slug: kafka-topics-log-retencion-replay
draft: true
status: draft
level: intermedio
prerequisites: [P048, DIST-QUEUES]
description: 'Comprende topics, logs, retención y compaction con un broker local real. Distingue consumo y borrado, y observa por qué un replay no recupera historia eliminada.'
author: 'Luis Ramírez Calle'
series: 'Kafka: logs, consumidores y reconstrucción de estado'
tags: [kafka, event-streaming, sistemas-distribuidos, retencion, typescript]
---

Un consumidor ya procesó los envíos de hoy. Después aparece una nueva necesidad: reconstruir un panel con otra lógica. Si el historial sigue disponible, ese segundo consumidor puede volver a leerlo sin pedir al primero que repita su trabajo.

Esa posibilidad explica buena parte del interés de **Kafka**. No se limita a guardar una tarea hasta que alguien la termine: conserva un log que distintos lectores recorren con posiciones independientes.

Esta serie continúa los [fundamentos distribuidos](/posts/replicacion-consistencia-lecturas-obsoletas) y las [colas con ACK](/posts/colas-ack-leases-trabajos-duplicados). Usaremos un broker real para reconstruir estados de envíos ficticios. Primero hay que entender qué conserva, durante cuánto tiempo y qué no se recupera con un replay.

## Un topic contiene logs divididos en particiones

Un **topic** es un flujo identificado por un nombre. Sus registros se distribuyen entre **partitions**. Cada partición tiene un orden de append y posiciones llamadas **offsets**.

Un registro puede tener **key**, **value**, timestamp y headers. En nuestro ejemplo la key identifica el envío y el value contiene JSON con su cambio de estado. Kafka almacena esos bytes; no decide por nosotros si `delivered` es una transición válida.

El productor publica. El broker conserva. El consumidor lee y mantiene su avance. Son responsabilidades distintas: que el productor haya recibido confirmación no significa que todos los consumidores hayan aplicado el evento.

La [introducción oficial de Kafka](https://kafka.apache.org/39/getting-started/introduction/) sitúa almacenamiento y procesamiento de eventos en ese modelo. Aquí no vamos a convertir seis mensajes en una recomendación de plataforma para cualquier aplicación.

## Leer no borra el registro ni avanza a todos los lectores

El consumidor live recorre seis eventos y reconstruye dos envíos. Un grupo rebuild, con otra identidad y sin posición previa, vuelve a recorrer los mismos seis. El primer consumo no vació el topic.

<img src="/assets/visuals/kafka-streaming/P051.svg" alt="Un productor escribe en el log de shipments; live lee seis eventos y avanza su cursor, rebuild vuelve a leerlos con otro cursor y ambos dependen de que el historial siga retenido." width="310" height="708" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kafka-streaming/P051.svg).

Frente al patrón clásico de una cola con ACK que permite retirar trabajo completado, el log retenido resulta útil para lectores independientes, nuevas proyecciones y reprocesamiento. Hay colas con otras políticas de retención y productos que combinan modelos; no es una frontera absoluta entre marcas.

Si solo necesitamos ejecutar una tarea y no volver a consultarla como historial, mantener un log y sus contratos puede aportar más operación que valor. Tampoco necesitamos Kafka para guardar seis eventos: lo usamos para observar su semántica.

## El laboratorio fija una política, no usa defaults invisibles

Archivo: `packages/kafka-streaming/tests/broker.test.mjs`, creación de cada topic de prueba. `name` es un nombre aleatorio propiedad de esa ejecución y `partitions` lo elige el caso.

```javascript
await admin.createTopics({ waitForLeaders: true, topics: [{ topic: name,
  numPartitions: partitions, replicationFactor: 1, configEntries: [
    { name: 'cleanup.policy', value: 'delete' }, { name: 'retention.ms', value: '3600000' },
  ] }] })
```

**`cleanup.policy=delete`** selecciona borrado de segmentos según la política de retención. **`retention.ms=3600000`** configura una hora. El test consulta después esa configuración al broker para comprobar el valor aplicado.

No espera una hora ni comprueba el instante exacto del borrado. La configuración observada y la expiración temporal observada serían evidencias distintas. La [referencia de topics](https://kafka.apache.org/39/configuration/topic-level-configs/) define esas propiedades y el funcionamiento por segmentos.

La **replication factor** es uno porque solo hay un broker. `acks=all` en el productor no crea copias adicionales: en este entorno no probamos failover ni durabilidad ante pérdida del nodo.

## Retention no es un TTL exacto por mensaje

Los logs se organizan en segmentos. La limpieza considera los segmentos elegibles y sus límites configurados; no hay que interpretar la hora de retención como un temporizador independiente que elimina cada mensaje en su milisegundo de cumpleaños.

También existe retención por tamaño. Una política puede eliminar historia que un consumidor lento todavía no ha leído. El commit de ese consumidor no es una reserva que obligue a conservarla indefinidamente.

Por eso el requisito de replay debería incluir una ventana: cuánto tiempo puede estar parado el lector, cuánto tarda en reconstruir y qué ocurre si el inicio disponible ya pasó su posición. «Se puede releer» no significa «se conserva para siempre».

Los offsets no se renumeran empezando en cero al quitar un prefijo. Una partición puede conservar su siguiente posición final y tener un inicio disponible mayor. Necesitamos conocer ambos límites para razonar sobre lo que aún puede recuperarse.

## El test de historia incompleta elimina un prefijo de forma explícita

Para evitar presentar una espera breve como prueba de retención de una hora, usamos otra operación claramente identificada: **DeleteRecords**. Publicamos tres transiciones de un envío y avanzamos el inicio del log hasta 2.

Archivo: `tests/broker.test.mjs`, extracto del caso de inicio avanzado.

```javascript
await admin.fetchTopicMetadata({ topics: [name] })
await admin.deleteTopicRecords({ topic: name, partitions: [{ partition: 0, offset: '2' }] })
const [{ low, high }] = await admin.fetchTopicOffsets(name)
assert.equal(low, '2')
assert.equal(high, '3')
```

La llamada previa carga metadatos que KafkaJS necesita para localizar al líder. El primer intento del laboratorio falló precisamente por ese detalle del cliente; no lo resolvimos cambiando la expectativa de `low`.

Queda disponible el registro de offset 2, versión 3 del envío. Una proyección vacía que exige versiones 1, 2 y 3 no puede reconstruirse con él y rechaza el hueco. El broker no hizo nada incorrecto: la historia necesaria ya no está.

Este caso demuestra una lectura después de **truncado administrativo**, no la ejecución natural de `retention.ms`. No usamos DeleteRecords como recomendación para administrar topics de producción.

## Compaction conserva otra clase de historia

Con **log compaction**, el criterio incluye la key: se pueden retirar versiones anteriores y conservar el valor más reciente por clave, con reglas adicionales para tombstones. No equivale a una lista inmutable de todos los cambios originales.

Un topic compactado puede ser útil para reconstruir una vista del último valor conocido por clave. No necesariamente sirve para un algoritmo que exige ejecutar cada transición intermedia. Usar `shipmentId` como key no garantiza que todas sus versiones sobrevivan a la limpieza.

Nuestra proyección valida una secuencia completa. Por eso el fixture usa `delete`, no `compact`, y no afirma haber probado compaction. Si quisiéramos reconstruir desde snapshots compactados, cambiaría el contrato del evento y de la proyección.

La [sección oficial de log compaction](https://kafka.apache.org/39/design/design/#log-compaction) explica también que borrar versiones no cambia los offsets. El hueco en posiciones no es por sí solo un error del consumidor.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p051/README.md), el [arranque aislado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kafka-streaming/scripts/broker.mjs) y las pruebas contra broker.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
docker pull apache/kafka:3.9.1@sha256:4ceccc577f03f51f6af8dbfda55194d0d892f4fa7913ffbded567ce3895622ed
pnpm --dir packages/kafka-streaming broker:up
pnpm --dir packages/kafka-streaming test:integration
pnpm --dir packages/kafka-streaming broker:down
```

`broker:up` no descarga imágenes automáticamente y publica únicamente `127.0.0.1:19092`. `broker:down` detiene solo el contenedor etiquetado del laboratorio; es desechable y se pierde su contenido. No monta datos del usuario.

## Garantías y límites

Se ejecuta **Apache Kafka 3.9.1**, KRaft de un nodo, con **KafkaJS 2.2.4** y Node.js 24.19.0. Son versiones fijadas para reproducir este ejercicio, no una afirmación de que sean las últimas ni una configuración recomendada para producción.

Observamos consumo independiente y reconstrucción de dos envíos, política configurada y lectura tras DeleteRecords. Sin TLS/SASL, varios brokers, failover, prueba de retención por tiempo o compaction. El archivo `evidence/broker.json` conserva los resultados de las pruebas que pasan.

## Ejercicio: definir una ventana de reconstrucción

Una proyección puede permanecer parada dos días y tarda seis horas en reconstruirse. ¿Qué margen necesita el historial? ¿Qué harías si el inicio disponible ya pasó la posición requerida? Especifica cuándo fallar, cuándo obtener un snapshot y cuándo aceptar una reconstrucción parcial explícita.

En la siguiente entrega veremos [particiones, claves y orden](/posts/kafka-particiones-claves-orden-eventos). Conservar eventos no basta si repartimos mal los que necesitan procesarse juntos.

## Referencias

- [Apache Kafka 3.9: introducción](https://kafka.apache.org/39/getting-started/introduction/).
- [Apache Kafka 3.9: configuración por topic](https://kafka.apache.org/39/configuration/topic-level-configs/).
- [KafkaJS: administración de topics y registros](https://kafka.js.org/docs/admin).

Fuentes consultadas el 21 de octubre de 2026. Los datos son ficticios y la topología es local.
