# Fundamentos distribuidos: réplicas, orden y particiones

Seis artículos españoles en draft para ampliar P048, después de la serie de
arquitectura. No repiten los ocho posts de fallos parciales, idempotencia, colas,
webhooks, Outbox/Inbox, sagas, retries y reconciliación. Tampoco sustituyen sus labs.

## Orden recomendado

1. [Replicación y consistencia](../../src/content/posts/es/replicacion-consistencia-lecturas-obsoletas.md): confirmación, stale reads y frescura de sesión.
2. [Quorum](../../src/content/posts/es/quorum-interseccion-lecturas-escrituras.md): intersección, versiones y supuestos de R + W > N.
3. [Consenso y Raft](../../src/content/posts/es/consenso-raft-eleccion-lider-terminos.md): elección, seguridad, progreso y lo que falta después del voto.
4. [Relojes de Lamport](../../src/content/posts/es/relojes-logicos-lamport-causalidad.md): orden parcial, mensajes y límites del contador.
5. [CAP y PACELC](../../src/content/posts/es/cap-pacelc-particiones-latencia-consistencia.md): particiones, contrato de respuesta y coordinación sin fallos.
6. [Sharding](../../src/content/posts/es/sharding-claves-buckets-rebalanceo.md): claves, hotspots, routing versionado y migración.

## Por qué seis entregas

Cada tema cambia la pregunta y el ejercicio. Replicar no es votar; la intersección
no implementa consenso; un contador no mide duración; CAP no es una etiqueta de
producto; repartir claves no mueve registros. Mantenerlos separados permite explicar
supuestos y contraejemplos sin convertir P048 en un glosario extenso.

El código completo vive solo en `luisrc-blog-examples/packages/distributed-foundations`.
Los posts conservan snippets comprobados y diagramas. Lab determinista de un proceso,
sin red, disco, Raft completo ni base de datos distribuida. Retener mensajes hace
visible divergencia; no reproduce el comportamiento de un motor comercial.

## Siguiente bloque

P051: Kafka, dividido en log/retención, particiones/claves, groups/offsets y replay
de una proyección. Exige distinguir un modelo de log de un broker Kafka real y
comprobar qué infraestructura local hay antes de prometer resultados. Después,
revisar las lagunas de la Serie 06. Ningún recuento da P048 o Serie 05 por aceptados.
