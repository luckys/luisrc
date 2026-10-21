# Kafka: logs, consumidores y reconstrucción de estado

Cinco drafts españoles para P051, después de los fundamentos distribuidos.
Laboratorio completo solo en `luisrc-blog-examples/packages/kafka-streaming`.
Los posts conservan snippets comprobados y diagramas, no solo enlaces.

## Orden de lectura

1. [Topic, log y retención](../../src/content/posts/es/kafka-topics-log-retencion-replay.md): consumo no destructivo, retención y límites del replay.
2. [Particiones, claves y orden](../../src/content/posts/es/kafka-particiones-claves-orden-eventos.md): ámbito de orden, routing y cambios de particionado.
3. [Consumer groups y rebalance](../../src/content/posts/es/kafka-consumer-groups-rebalance-asignacion.md): asignación real a dos miembros y salida limpia.
4. [Offsets, commits y proyección](../../src/content/posts/es/kafka-offsets-commits-reconstruir-proyeccion.md): redelivery, reanudación, schema y reconstrucción independiente.
5. [Lag y backpressure](../../src/content/posts/es/kafka-consumer-lag-backpressure-pause-resume.md): posiciones, pausa y capacidad del consumidor.

Lag se separa porque tiene pregunta y ejercicio propios; no se esconde como una
opción de configuración al final del replay. Retención y compaction se distinguen
sin convertir esta entrega en una guía operativa completa de Kafka.

## Alcance verificable

Broker real Apache Kafka 3.9.1, KRaft de un nodo, imagen oficial fijada por digest;
KafkaJS 2.2.4, Node 24.19.0 y TypeScript estricto. Versiones de laboratorio, no
afirmación de que sean las últimas o una recomendación de producción. TCP loopback,
sin TLS/SASL, RF=1 y datos ficticios. Ver evidencia y límites en kafka-streaming-review.md.
No se atribuyen a un nodo garantías de failover o consenso entre réplicas.

## Siguiente bloque

Auditar Serie 06 contra artículos existentes antes de escribir: pruebas, calidad,
CI/CD, AWS, Terraform/Kubernetes y observabilidad tienen entregas previas parciales.
No declarar aceptación por ID. Los gaps anteriores de P026 y P045 no desaparecen.
Mantener español y draft; sin traducción, audio, publicación o push automáticos.
