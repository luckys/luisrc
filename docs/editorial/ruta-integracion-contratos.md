# Integración y contratos: probar acuerdos con dependencias reales

Cinco drafts españoles de P056. Continúan la ruta-pruebas-software.md y amplían
los artículos previos de contrato HTTP y evolución, sin cambiar sus IDs/URLs.
Laboratorio completo en `luisrc-blog-examples/packages/integration-contracts`.

## Orden de lectura

1. [Testcontainers y lifecycle](../../src/content/posts/es/testcontainers-postgresql-integracion-ciclo-vida.md): imagen/readiness, puertos, SQL real y cleanup.
2. [Fixtures, factories y determinismo](../../src/content/posts/es/fixtures-factories-datos-prueba-deterministas.md): defaults, identidad, oracle y tiempo explícito.
3. [Rollback y schemas](../../src/content/posts/es/aislamiento-tests-postgresql-rollback-schemas.md): transacciones por conexión y datos separados por escenario.
4. [Schema tests y semántica](../../src/content/posts/es/schema-tests-contratos-api-semantica.md): JSON Schema, consumidor, cambio SQL y unidades.
5. [Pact y provider states](../../src/content/posts/es/consumer-driven-contracts-pact-provider-states.md): generar/verificar contrato, estados independientes y límites.

## Decisión de división

Cada entrega tiene pregunta y ejercicio propios. Lifecycle no se mezcla con los
detalles del matcher; datos de prueba no se confunden con aislamiento de conexiones.
Se conservan schema y semántica juntos para que se vea exactamente qué detecta
cada expectativa. Pact necesita consumidor y proveedor en el mismo artículo para
no presentar solo el mock como evidencia del acuerdo completo.

## Evidencia y límites

PostgreSQL18.4/Testcontainers12.2.1/Pact17.1.4 reales, versiones fijadas, HTTP local.
Cuatro tests de núcleo, dos de consumidor y nueve de integración; artefacto con hashes.
Solo datos ficticios y contenedores propios. Ver integration-contracts-review.md.
Sin Pact Broker, CI desplegada, UI E2E, auth, HA, disco durable o benchmark. Recuperación
por timeout codificada pero sin SIGKILL inyectado. No aceptar toda Serie06 por IDs.

## Siguiente bloque

P057 ya se desarrolla en siete entregas: ver [pruebas basadas en propiedades](ruta-pruebas-propiedades.md).
El contraste y la división propuestos a continuación se conservan como contexto.

P057: leer fault-injection-pruebas-propiedades y reliable-services antes de ampliar.
Separar propiedades/generadores/shrinking, fuzzing de entradas, scheduling de carreras
y fallos/replay; mutation testing ya tiene introducción ejecutada en P055. El modelo
de pagos debe revelar una regresión reproducible y conservar su caso mínimo, no solo
un bucle aleatorio que pase. Después P058: carga/profile, contrastando el post previo.
Mantener español/draft, ejemplos separados, sin audio/traducción/publicación/push.
