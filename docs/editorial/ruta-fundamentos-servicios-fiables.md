# Ruta de fundamentos para construir servicios fiables

Solo español, en borrador. Los artículos enseñan conocimientos transferibles, no
son capítulos de implementación de PaySafe ni requieren conocer ese proyecto.

## Cómo leer la ruta

Empieza por [la serie de bases de datos](database-series-scope.md). Después sigue
las cuatro series siguientes. El orden evita necesitar Outbox antes de conocer
transacciones, o retries antes de entender resultados inciertos e idempotencia.

Las fechas de los borradores conservan el orden dentro de cada serie. Cada artículo
enlaza su siguiente lectura y los prerrequisitos imprescindibles. El inventario
comprobable está en [reliable-services-series.json](reliable-services-series.json).

## 1. APIs y seguridad sin atajos

1. [Dinero, tipos y validación](../../src/content/posts/es/dinero-tipos-validacion-typescript.md): representación, unidades menores y fronteras runtime.
2. [Asincronía y carreras en Node.js](../../src/content/posts/es/asincronia-nodejs-carreras-concurrencia.md): intercalados, barreras y estado compartido.
3. [Contratos HTTP y operaciones](../../src/content/posts/es/contratos-http-recursos-operaciones.md): creación, aceptación y resultado de negocio.
4. [Validación y Problem Details](../../src/content/posts/es/validacion-errores-api-problem-details.md): input allowlist y errores estables.
5. [Evolución y cursor pagination](../../src/content/posts/es/evolucion-api-paginacion-contratos.md): compatibilidad, empates y límites del cursor.
6. [Autenticación y autorización](../../src/content/posts/es/autenticacion-autorizacion-tenant.md): sesión, OAuth/OIDC, tenant y ownership.
7. [Seguridad web y de API](../../src/content/posts/es/seguridad-api-navegador-limites-confianza.md): TLS, CORS, CSRF, XSS, SSRF y límites de recursos.

## 2. Diseñar servicios que se puedan cambiar

8. [Requisitos, invariantes y capacidad](../../src/content/posts/es/requisitos-capacidad-invariantes-servicio.md): convertir necesidades en pruebas e hipótesis.
9. [Monolito modular y SOLID](../../src/content/posts/es/monolito-modular-solid-sin-sobreingenieria.md): cohesión, puertos pequeños y costes de alternativas.
10. [Máquinas de estados](../../src/content/posts/es/maquinas-estados-reglas-negocio.md): transiciones, terminales e intentos separados de la operación.
11. [TDD y niveles de prueba](../../src/content/posts/es/tdd-pruebas-unitarias-integracion-contrato.md): red-green-refactor, fakes e integración real.

## 3. Sistemas distribuidos ante fallos reales

12. [Fallos parciales](../../src/content/posts/es/fallos-parciales-timeout-resultado-desconocido.md): timeout no equivale a fallo del negocio.
13. [Idempotencia](../../src/content/posts/es/idempotencia-api-claves-efectos.md): scope, fingerprint, persistencia y contrato externo.
14. [Retries y backpressure](../../src/content/posts/es/retries-deadlines-backoff-backpressure.md): deadlines, full jitter y bulkhead.
15. [Colas y leases](../../src/content/posts/es/colas-ack-leases-trabajos-duplicados.md): ACK, redelivery, DLQ y fencing limitado al recurso que lo respeta.
16. [Webhooks seguros](../../src/content/posts/es/webhooks-firmas-inbox-eventos-desordenados.md): raw body, HMAC, timestamp y aplicación duradera.
17. [Outbox e Inbox](../../src/content/posts/es/transactional-outbox-inbox-eventos.md): atomicidad local y deduplicación del consumidor.
18. [Sagas y compensación](../../src/content/posts/es/sagas-compensaciones-workflows-duraderos.md): recuperación sin rollback global ficticio.
19. [Reconciliación](../../src/content/posts/es/reconciliacion-operaciones-inciertas.md): consultar evidencia, controlar carreras y escalar incertidumbre.

## 4. Probar y operar servicios fiables

20. [Fault injection y propiedades](../../src/content/posts/es/fault-injection-pruebas-propiedades.md): secuencias, semilla, oráculo y límites de la exploración.
21. [Observabilidad](../../src/content/posts/es/observabilidad-logs-metricas-trazas-workers.md): identidades, señales, privacidad y cardinalidad.
22. [Pruebas de carga](../../src/content/posts/es/pruebas-carga-percentiles-saturacion.md): percentiles, trabajo útil y sobrecarga, con medición HTTP local.
23. [SLI, SLO y presupuesto](../../src/content/posts/es/sli-slo-error-budget-servicios.md): denominadores, ventanas y alertas útiles.
24. [Entorno, entrega y runbooks](../../src/content/posts/es/docker-ci-despliegues-runbooks.md): Compose, tipos, CI, despliegue compatible y recuperación.

## Qué sigue en el proyecto integrador

Los conocimientos permiten empezar el alcance PS01–PS10. Todavía hay que implementar
y probar una API, workers, proveedor fake por HTTP, recuperación persistente,
autorización real e instrumentación. Los artículos no afirman que ese producto
ya esté construido.

No hace falta completar antes el resto de los 175 temas del roadmap. Kafka,
Kubernetes, AWS, Terraform, motores de workflows y especializaciones de IA
se mantienen como ampliaciones. OAuth/OIDC se explica aquí como frontera de
identidad; integrar un proveedor real requiere otra validación específica.

El [laboratorio](../../packages/reliable-services/README.md) sirve de apoyo a las
cuatro series. Las limitaciones y los checks se registran en
[la revisión editorial](reliable-services-review.md).

## Siguiente serie generalista

[Frontend y tiempo real](ruta-frontend-tiempo-real.md) continúa con nueve borradores
sobre las interfaces que consumen estos servicios. No obliga a implementar un
proyecto concreto ni convierte cloud o Kubernetes en prerrequisitos de una pantalla.
