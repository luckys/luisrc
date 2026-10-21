# Arquitectura: dependencias, módulos y despliegues

Cinco drafts españoles. Continúa P045/P046 después de la serie de principios,
sin repetir DESIGN-MODULES o toda la serie DDD. Código de laboratorio solo en
`luisrc-blog-examples/packages/architecture-boundaries`, carpetas en inglés.
Extractos explicados, diagramas y ejercicios dentro de los posts.

## Orden recomendado

1. [Arquitectura hexagonal](../../src/content/posts/es/arquitectura-hexagonal-puertos-adaptadores.md): puertos, traducción y adaptadores fake/HTTP.
2. [Capas y Clean Architecture](../../src/content/posts/es/clean-architecture-capas-direccion-dependencias.md): dirección de imports y chequeo ejecutable.
3. [Monolito modular y ownership](../../src/content/posts/es/monolito-modular-ownership-datos-api-publica.md): API público y autoridad de datos.
4. [CQRS y consistencia de lectura](../../src/content/posts/es/cqrs-modelos-lectura-consistencia.md): proyección, cursor, huecos y replay.
5. [Costes de microservicios](../../src/content/posts/es/monolito-microservicios-despliegue-costes.md): despliegue, alternativas y ADR educativa.

## Decisión de división

Una pregunta por entrega. Hexagonal y capas se separan para distinguir conversaciones
externas de dependencias internas. Ownership no se confunde con despliegue. CQRS
tiene un mecanismo de estado y ejercicio propios; no se reduce a Reader/Writer.
El último post compara alternativas sin implementar microservicios innecesarios.
Diagramas estrechos, enlaces para ampliar, código probado y límites por artículo.

## Evidencia y aceptación

Ver architecture-boundaries-review.md. HTTP real solo loopback; proveedor ficticio,
sin credenciales. No Stripe sandbox, SQL, datos persistentes o infraestructura cloud.
El read model progresa por entrega manual de eventos, no por un worker autónomo.
Checker local, no prueba completa de Clean Architecture o seguridad.

P045 tiene desarrollo y pruebas, pero su DoD de sustitución de proveedor comercial
sigue abierto. P046 compara conceptualmente fronteras y despliegues; no tiene un
benchmark. Archivos e IDs no aceptan automáticamente las fichas.

Siguiente: [seis fundamentos de P048](ruta-fundamentos-distribuidos.md), que amplían
replicación, quorum/consenso, relojes, CAP/PACELC y sharding sin repetir el bloque
previo de fallos. Después P051 streaming y las lagunas de Serie 06.
No duplicar outbox, sagas o idempotencia sin leer su evidencia. Mantener español/draft
y ejemplos fuera del blog. Sin traducción, audio o push.
