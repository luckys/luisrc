# Diseño de APIs y seguridad web

Diecinueve entregas españolas y draft para las fichas **P020–P028** de la Serie 03.
La división mantiene las URL originales y no añade fichas al catálogo.
No completa P029–P031. Ejemplos independientes de Paysafe; sin traducción, audio
o publicación automática.

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

La ruta común pasa del contrato de validación a Zod y errores. Pydantic parte del
mismo contrato y puede leerse en paralelo o en su lugar; ningún artículo posterior
la exige como prerrequisito. Las fechas y el manifiesto conservan este orden en
la interfaz del blog.

## Un laboratorio por bloque, no diecinueve proyectos independientes

| Bloque                 | Artículos | Fuentes y evidencia                                                                                                      |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Contratos HTTP         | 1–2       | [api-contratos](../../examples/api-contratos/README.md), once tests sin instalaciones.                                   |
| Validación y errores   | 3–7       | [api-validacion-errores](../../examples/api-validacion-errores/README.md), trece tests Node y cuatro Python.             |
| Paginación y evolución | 8–12      | [api-paginacion-evolucion](../../examples/api-paginacion-evolucion/README.md), trece tests sin Docker y seis PostgreSQL. |
| Identidad              | 13–16     | [api-identidad](../../examples/api-identidad/README.md), diez tests Node y comprobación Chromium del flujo y la cookie.  |
| Permisos               | 17–19     | [api-permisos](../../examples/api-permisos/README.md), cinco tests de política y trece HTTP; visor con la misma función. |

Cada README relaciona la entrega con sus archivos y pruebas. La reserva de inventario
pertenece al bloque de validación; el listado de pedidos al de paginación. No se
presentan como un único servidor que implemente todas las capacidades a la vez.

Los ZIP se mantienen compartidos por bloque. La tabla de medianas y su gráfica
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

Los IDs API-\* nuevos identifican partes editoriales. No se usan IDs
reservados del roadmap para inflar el avance. La división, las ampliaciones y las
comprobaciones están en [api-series-split-review.md](api-series-split-review.md).

## Continuación pendiente

| Ficha             | Trabajo que sigue necesitando una entrega propia                                  |
| ----------------- | --------------------------------------------------------------------------------- |
| P029. Navegador   | Reproducir XSS/CSRF y verificar correcciones sin confundir CORS con autorización. |
| P030. Amenazas    | Threat model y tests de SQLi/SSRF/mass assignment/abuso.                          |
| P031. Integración | Polling/eventos, GraphQL/gRPC y límites ejecutados sin benchmarks inventados.     |

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
