# Diseño de APIs y seguridad web

Treinta y seis entregas españolas y draft: P020–P031 de la Serie 03.
La división mantiene las URL originales y no añade fichas al catálogo.
P030 y P031 desarrollan su temario con límites de laboratorio explícitos.
Ejemplos independientes de Paysafe; sin traducción, audio
o publicación automática.

El código ejecutable vive ahora en el [monorepo de ejemplos](https://github.com/luckys/luisrc-blog-examples),
con carpetas en inglés e índice por ID de artículo. Los recuentos de ZIP y comandos
de empaquetado que aparecen en revisiones anteriores son históricos; sigue
[el flujo actual entre repositorios](../examples-repository.md).

## Orden de lectura

1. **P020.** [Diseñar una API: el contrato es más que un JSON que funciona](../../src/content/posts/es/api-contrato-esquema-clientes.md).
   Contrato, representación, unidades y límites que el consumidor puede asumir.
2. **P021.** [Recursos HTTP: qué prometen GET, POST, PUT, PATCH y DELETE](../../src/content/posts/es/recursos-http-metodos-idempotencia.md).
   Recursos, métodos y diferencia entre safe e idempotente.
3. **P022.** [Validación de APIs: separar parsing, JSON Schema y reglas de negocio](../../src/content/posts/es/validacion-runtime-json-schema-zod-pydantic.md).
   Parsing, semántica de entrada, negocio y JSON Schema.
4. **API-VALIDATION-ZOD.** [Validación con Zod: del dato desconocido a un comando comprobado](../../src/content/posts/es/validacion-zod-contratos-errores-runtime.md).
   Schema ejecutable, safeParse, errores por campo y DTO de salida.
5. **API-VALIDATION-PYDANTIC · alternativa Python.** [Validación con Pydantic: tipos estrictos, campos ausentes y reglas entre campos](../../src/content/posts/es/validacion-pydantic-strict-null-refinements.md).
   Ruta Python alternativa: strict, before/after, defaults y ausencia.
6. **P023.** [Errores de API: diseñar Problem Details y distinguir conflictos de negocio](../../src/content/posts/es/errores-api-problem-details-stock-concurrencia.md).
   Problemas públicos, catálogo estable y conflictos de stock/versión.
7. **API-ERROR-LOGGING.** [Diagnosticar errores de API sin filtrar datos: logs y request IDs](../../src/content/posts/es/errores-api-logs-request-id-diagnostico-seguro.md).
   Request ID, allowlist, secretos ficticios y fallo del logger.
8. **P024.** [Paginación de APIs: OFFSET, keyset y cursores con un orden estable](../../src/content/posts/es/paginacion-offset-keyset-postgresql-concurrencia.md).
   Orden total, OFFSET/keyset, lookahead y ámbito del cursor.
9. **API-PAGINATION-CONSISTENCY.** [Paginación bajo escrituras: qué conserva keyset y qué necesita un snapshot](../../src/content/posts/es/paginacion-escrituras-concurrentes-snapshots.md).
   Dos conexiones, inserciones, clave mutable y snapshots.
10. **API-PAGINATION-PERFORMANCE.** [Medir paginación en PostgreSQL: índices, filtros y planes de ejecución](../../src/content/posts/es/paginacion-postgresql-indices-explain-mediciones.md).
    Índices, 56 planes, siete muestras, filtros y búsqueda.
11. **P025.** [Compatibilidad de APIs: detectar breaking changes con contract tests](../../src/content/posts/es/evolucion-api-versiones-consumidores-contratos.md).
    Consumidores, cambios aditivos/breaking y schemas frente a significado.
12. **API-VERSION-MIGRATION.** [Versionar y retirar una API: convivencia, deprecación y migración de clientes](../../src/content/posts/es/versionado-api-deprecacion-migracion-consumidores.md).
    URL o headers, SDK, deprecación, guía y criterios de retirada.
13. **P026.** [Sesiones web: mantener la identidad sin exponerla en cada petición](../../src/content/posts/es/sesiones-web-cookies-identidad.md).
    Estado, token opaco, cookie, fixation, expiración y logout.
14. **API-SESSION-REFRESH.** [Access y refresh tokens: rotación, reutilización y revocación](../../src/content/posts/es/access-refresh-tokens-rotacion-reutilizacion.md).
    Modelo separado de familias, replay, carreras y límites absolutos.
15. **P027.** [OAuth y OIDC: entender Authorization Code con PKCE paso a paso](../../src/content/posts/es/oauth-oidc-authorization-code-pkce.md).
    Roles, fronteras, scopes, state, nonce y canje con un OP de test real.
16. **API-OIDC-VALIDATION.** [Validar un ID token: firma, JWKS y claims que tu aplicación espera](../../src/content/posts/es/oidc-validar-id-token-jwks-claims.md).
    Firma RS256, issuer, audience, exp, iat, nonce, sub y azp, con variantes adversariales.
17. **P028.** [Autorización por recurso: combinar RBAC, ABAC y ownership sin permisos implícitos](../../src/content/posts/es/autorizacion-rbac-abac-permisos-recursos.md).
    Política explícita, roles locales, atributos, relaciones, least privilege y cierre por defecto.
18. **API-AUTHZ-TENANT.** [Autorización multi-tenant: llevar el contexto hasta la lectura y la escritura](../../src/content/posts/es/autorizacion-multi-tenant-contexto-datos.md).
    Membership, claves compuestas, listados autorizados, proyección y límites de concurrencia.
19. **API-AUTHZ-TESTS.** [Probar autorización por HTTP: detectar BOLA sin conformarse con un 403](../../src/content/posts/es/autorizacion-tests-adversariales-bola.md).
    Controles positivos y adversariales, lectura/escritura entre tenants y estado posterior.
20. **P029.** [XSS en el DOM: mostrar texto sin convertirlo en código](../../src/content/posts/es/xss-dom-texto-html-contextos.md).
    Source/sink, texto, contextos, HttpOnly, storage y scripts de terceros.
21. **API-BROWSER-CSP.** [CSP con nonces: bloquear ejecución no es corregir el HTML inyectado](../../src/content/posts/es/csp-nonces-report-only-defensa-adicional.md).
    Nonces por respuesta, directivas, enforce/Report-Only y verificación de funcionalidad.
22. **API-BROWSER-CSRF.** [CSRF: por qué una cookie válida no demuestra que el usuario quiso actuar](../../src/content/posts/es/csrf-cookies-samesite-origin-token.md).
    Same-site frente a same-origin, formularios, cookie, Origin y token ligado a sesión.
23. **API-BROWSER-CORS.** [CORS y SOP: bloquear la lectura de una respuesta no autoriza una API](../../src/content/posts/es/cors-sop-preflight-no-autorizacion.md).
    Lectura y efectos separados, preflight real, credenciales, wildcard y cliente Node.
24. **P030.** [Threat modeling de una API: convertir amenazas en decisiones y pruebas](../../src/content/posts/es/threat-model-api-multi-tenant-pruebas.md).
    Activos, actores, fronteras, escenarios, prioridades cualitativas, evidencia y riesgos abiertos.
25. **API-THREATS-ASSIGNMENT.** [Mass assignment: editar un título no debería permitir cambiar el propietario](../../src/content/posts/es/mass-assignment-comandos-propiedades-autorizadas.md).
    Comando title-only, propiedades permitidas, UPDATE explícito y DTO; visor de diferencias.
26. **API-THREATS-SQL.** [SQL injection: separar valores y consultas sin perder el filtro de tenant](../../src/content/posts/es/sql-injection-parametros-tenant-ordenacion.md).
    SQLite real, concatenación frente a binding, autorización independiente y sort cerrado.
27. **API-THREATS-SSRF.** [SSRF: elegir un recurso no debería permitir elegir cualquier destino de red](../../src/content/posts/es/ssrf-destinos-permitidos-redirecciones.md).
    Referencias por tenant, origen exacto, redirects y credenciales de salida; conexiones a fixtures.
28. **API-THREATS-DNS.** [SSRF y DNS: validar una IP no basta si te conectas después a otra](../../src/content/posts/es/ssrf-dns-validacion-conexion-ip.md).
    Resolver programado, TOCTOU, IP fijada al socket real, Host, límites TLS/proxy y trazas interactivas.
29. **API-THREATS-CAPACITY.** [Consumo de recursos: limitar trabajo activo sin crear una cola infinita](../../src/content/posts/es/consumo-recursos-concurrencia-bulkheads.md).
    Cupos global/tenant, rechazo sin cola, release idempotente y finally que espera trabajo/deadline.
30. **API-THREATS-RATE.** [Token bucket: limitar solicitudes por tenant sin confundir ráfagas y concurrencia](../../src/content/posts/es/rate-limiting-token-bucket-tenant.md).
    Burst, recarga, reloj, coste fijo, clave verificada, Retry-After y gráfica de decisiones.
31. **API-THREATS-CREDENTIALS.** [API keys: verificar al cliente sin confundir identidad y permisos](../../src/content/posts/es/api-keys-credenciales-clientes-permisos.md).
    Digest, caducidad, revocación, scopes, errores del almacén y ausencia de fallback.
32. **API-THREATS-SECRETS.** [Rotar secretos: comprobar la nueva credencial antes de retirar la anterior](../../src/content/posts/es/secretos-rotacion-recarga-revocacion.md).
    Recarga verificada, convivencia, revocación, proyección de logs y cinco etapas HTTP reproducibles.
33. **P031.** [Polling o eventos: seguir un pedido sin perder cambios](../../src/content/posts/es/polling-eventos-estado-pedido.md).
    Snapshot/ETag, 304, SSE, replay entre lectura y conexión, retención y reconciliación.
34. **API-INTEGRATION-GRAPHQL.** [GraphQL y N+1: un request no implica una sola lectura](../../src/content/posts/es/graphql-resolvers-n-mas-uno-dataloader.md).
    Schema, resolvers, 4 frente a 2 lecturas, batch ordenado y caché por operación/tenant.
35. **API-INTEGRATION-GRPC.** [gRPC: contratos Protobuf, deadlines y compatibilidad](../../src/content/posts/es/grpc-protobuf-deadlines-compatibilidad.md).
    Unary real, metadata, validación, deadline/cancelación y consumidor binario anterior.
36. **API-INTEGRATION-CHOICE.** [Elegir una integración: REST, callbacks, subscriptions y eventos](../../src/content/posts/es/elegir-integracion-rest-callbacks-subscriptions-eventos.md).
    Separar contrato/interacción/entrega; callbacks, seguridad y evolución con referencias a webhooks/SSE previos.

La ruta común pasa del contrato de validación a Zod y errores. Pydantic parte del
mismo contrato y puede leerse en paralelo o en su lugar; ningún artículo posterior
la exige como prerrequisito. Las fechas y el manifiesto conservan este orden en
la interfaz del blog.

## Un laboratorio por bloque, no treinta y seis proyectos independientes

| Bloque                 | Artículos | Fuentes y evidencia                                                                                                                                                                      |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contratos HTTP         | 1–2       | [api-contracts](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-contracts/README.md), once tests sin instalaciones.                                                |
| Validación y errores   | 3–7       | [api-validation-errors](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-validation-errors/README.md), trece tests Node y cuatro Python.                            |
| Paginación y evolución | 8–12      | [api-pagination-evolution](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-pagination-evolution/README.md), trece tests sin Docker y seis PostgreSQL.              |
| Identidad              | 13–16     | [api-identity](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-identity/README.md), diez tests Node y Chromium.                                                    |
| Permisos               | 17–19     | [api-authorization](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-authorization/README.md), cinco tests de política y trece HTTP.                                |
| Navegador              | 20–23     | [browser-security](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/browser-security/README.md), siete tests HTTP y ocho Chromium.                                      |
| Amenazas               | 24–32     | [api-threats](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/README.md), 58 tests y tres visores.                                                         |
| Integración            | 33–36     | [api-integration](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/README.md), HTTP/SSE, GraphQL.js/DataLoader y gRPC reales; tiempo simulado separado. |

Cada README relaciona la entrega con sus archivos y pruebas. La reserva de inventario
pertenece al bloque de validación; el listado de pedidos al de paginación. No se
presentan como un único servidor que implemente todas las capacidades a la vez.

El código se comparte por bloque en el monorepo, sin ZIPs en el blog. La tabla de medianas y su gráfica
viven en rendimiento; la inserción y el [visor educativo](../../public/assets/interactive/api-pagination/explorer.html)
viven en consistencia. El visor no consulta PostgreSQL ni mide latencia.

## Qué desarrolla cada ficha original

- P020: una entrega de contrato.
- P021: una entrega comparativa de métodos HTTP; no se fragmenta por verbo.
- P022: tres entregas, conceptos comunes y dos implementaciones de lenguaje.
- P023: dos entregas, respuesta pública y diagnóstico interno.
- P024: tres entregas, navegación, consistencia y coste.
- P025: dos entregas, detectar incompatibilidad y operar una transición.
- P026: dos entregas, sesión opaca y modelo de rotación/reutilización.
- P027: dos entregas, protocolo y política de validación del resultado.
- P028: tres entregas, política RBAC/ABAC, aislamiento de datos y tests adversariales.
- P029: cuatro entregas, DOM XSS, CSP, CSRF y SOP/CORS. Se evita reunir mecanismos distintos en un único tutorial.
- P030: nueve entregas, threat modeling, mass assignment, SQL injection, dos de SSRF, concurrencia, token bucket, credenciales de clientes y rotación de secretos. No equivale a una auditoría de producción.
- P031: cuatro entregas, seguimiento polling/SSE, lecturas GraphQL, RPC/Protobuf y elección de interacción. No se reúnen cuatro mecanismos distintos en un tutorial superficial. Webhooks e inbox conservan sus artículos previos.

Los IDs API-\* nuevos identifican partes editoriales. No se usan IDs
reservados del roadmap para inflar el avance. La división, las ampliaciones y las
comprobaciones están en [api-series-split-review.md](api-series-split-review.md).

## Continuación pendiente

| Ficha             | Trabajo que sigue necesitando una entrega propia                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| P030. Amenazas    | Revisar cobertura conjunta de las nueve partes; T01/T05–T07 solo fixtures. No exigir un despliegue cloud no pedido.                                 |
| P031. Integración | Entregada con evidencia local; sin GraphQL subscriptions, gRPC streaming o broker durable implementados. Ver [revisión](api-integration-review.md). |

## Límites conservados

Loopback, datos ficticios y sin identidades de producción o pagos. P020/P021 validan
manualmente su contrato. Ajv, Zod y Pydantic se contrastan en casos concretos, no
se demuestra equivalencia universal. Pydantic no es un servidor HTTP de la demo.

Los conflictos de inventario son de un proceso síncrono, no transacciones SQL.
El benchmark de lectura usa tmpfs, cachés calientes y ancla conocida; no mide HTTP
o carga concurrente. Firma de cursor no es autorización. Los dos lectores de
contrato viven en el mismo repo, no son SDK publicados. Deprecación ficticia, sin
telemetría de adopción o retirada automática. Los límites se explican también en
cada entrega para que no dependan de haber leído el artículo anterior.

Identidad integra un OP oidc-provider local con devInteractions: no verifica
contraseña ni MFA. RP HTTPS autofirmado y OP HTTP exclusivamente en loopback,
no configuración de producción. El RP crea una sesión opaca; el modelo de
refresh es complementario, no una renovación OAuth integrada en esa sesión.
Map de un proceso, sin persistencia o recolección completa. Logout local no
cierra el OP. M2M se explica, no se ejecuta. Ver [api-identity-review.md](api-identity-review.md).

Permisos no se integra con el OP: un adaptador de fixtures reconoce IDs internos
y el servidor consulta membership en cada petición. Política y almacenamiento
en memoria, sin SQL/RLS, cachés o infraestructura multi-tenant. El tramo de decisión
y escritura es síncrono, no una transacción de base de datos. El visor es un modelo
educativo, no una API. Ver [api-authorization-review.md](api-authorization-review.md).

Navegador reproduce vulnerabilidades solo en loopback. HTTP sin Secure, cookie y
sesión públicas de fixture, sin integración OIDC. Puertos separan orígenes pero no
cookies; servicios controlados por los tests. Chromium real, sin interceptación de
preflight; no otros navegadores o política de terceros. Enforce bloquea un handler,
no elimina HTML. Ver [api-browser-review.md](api-browser-review.md), que conserva
también el criterio de posts pequeños y específicos para futuras entregas.

Amenazas usa fixtures públicos, HTTP local y SQLite síncrono en memoria. La ruta
segura solo escribe title y exige owner/draft en el UPDATE; no hay versiones
optimistas o auditoría de infraestructura. El visor cuenta cambios de propiedades,
no mide riesgo. SSRF se reproduce con dos destinos loopback, HTTP real y resolver
programado: no servidor DNS, TLS, IPv6, proxy o firewall. La guardia del harness
no es egress desplegado. Admisión usa cupos y token bucket en memoria, sin réplicas,
colas, persistencia, load test o límites económicos. Credenciales opt-in y ciclo de
rotación con fuente en memoria; sin secret manager o auditoría durable. No es login
de personas ni remedia el gap de refresh de P026.
Ver [api-threats-review.md](api-threats-review.md).
La continuación de SSRF y la evidencia actual se describen en [api-ssrf-review.md](api-ssrf-review.md).
Consumo/rate limiting y su alcance están en [api-admission-review.md](api-admission-review.md).
La continuación de identidad/secretos está en [api-credentials-review.md](api-credentials-review.md).
