# Pruebas de software: reglas, fronteras y evidencia

Primer bloque específico de Serie 06: cinco drafts españoles para ampliar P055.
Se reutiliza DESIGN-TDD como introducción, sin cambiar su ID ni su URL.
Laboratorio completo solo en `luisrc-blog-examples/packages/testing-strategy`.

## Orden de lectura

1. [Diseño desde invariants y casos límite](../../src/content/posts/es/disenar-pruebas-invariantes-casos-limite.md): oracle independiente, matriz y observaciones.
2. [TDD con una máquina de estados](../../src/content/posts/es/tdd-maquina-estados-red-green-refactor.md): rojo de aserción, green mínimo y separación de reglas/estado.
3. [Test doubles y contrato compartido](../../src/content/posts/es/test-doubles-stubs-spies-fakes-contratos.md): stub/spy, fake Map y SQLite real.
4. [Unit, integration y E2E](../../src/content/posts/es/unit-integration-e2e-fronteras-piramide-pruebas.md): fronteras, fixtures, HTTP real y recorrido que falta.
5. [Coverage y mutation testing](../../src/content/posts/es/coverage-mutation-testing-aserciones-que-detectan-fallos.md): 100 % en un archivo con test débil, cuatro mutaciones manuales.

## Por qué cinco entregas

Diseñar el oracle, practicar TDD, sustituir dependencias, elegir fronteras y revisar
aserciones son decisiones distintas con ejercicios propios. Un único resumen
ocultaría especialmente el contraste Map/SQLite y el alcance del coverage.
No se divide por cada término: el contrato de repositorio necesita presentarse
junto al fake que contrasta. La introducción anterior sigue siendo útil como mapa.

## Alcance y siguiente bloque

Un registro de jobs, no un scheduler. Node 24.19.0/TS 5.9.2, núcleo puro, servicio,
fake y adaptador SQLite; componente HTTP loopback. Sin UI E2E, PostgreSQL,
Testcontainers o Pact. Contratos compartidos de adaptador, no consumer-driven.
Versiones fijadas para reproducir, no recomendación de últimas versiones.

Siguiente: P056, integración y contratos de API. Leer contratos-http-recursos-operaciones,
evolucion-api-paginacion-contratos y los labs api-contracts/api-pagination-evolution.
Separar lifecycle Testcontainers/fixtures/factories de evolución verificada por
clientes y consumer-driven contracts; no recrear el artículo de HTTP/OpenAPI.
Usar PostgreSQL real si se afirma su comportamiento y declarar diferencias de motor.
Después P057 generación/shrinking/fuzzing y P058 carga/profile antes de observabilidad.
La evidencia de este bloque no acepta toda Serie 06. Sin audio, traducción o push.
