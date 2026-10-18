# Diseño de APIs y seguridad web

Doce entregas españolas y draft para las fichas **P020–P025** de la Serie 03.
La división mantiene las seis URL originales y no añade fichas al catálogo.
No completa P026–P031. Ejemplos independientes de Paysafe; sin traducción, audio
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

La ruta común pasa del contrato de validación a Zod y errores. Pydantic parte del
mismo contrato y puede leerse en paralelo o en su lugar; ningún artículo posterior
la exige como prerrequisito. Las fechas y el manifiesto conservan este orden en
la interfaz del blog.

## Un laboratorio por bloque, no doce proyectos independientes

| Bloque                 | Artículos | Fuentes y evidencia                                                                                                      |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Contratos HTTP         | 1–2       | [api-contratos](../../examples/api-contratos/README.md), once tests sin instalaciones.                                   |
| Validación y errores   | 3–7       | [api-validacion-errores](../../examples/api-validacion-errores/README.md), trece tests Node y cuatro Python.             |
| Paginación y evolución | 8–12      | [api-paginacion-evolucion](../../examples/api-paginacion-evolucion/README.md), trece tests sin Docker y seis PostgreSQL. |

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

Los IDs API-\* nuevos identifican partes editoriales. No se usan P026 u otros IDs
reservados del roadmap para inflar el avance. La división, las ampliaciones y las
comprobaciones están en [api-series-split-review.md](api-series-split-review.md).

## Continuación pendiente

| Ficha             | Trabajo que sigue necesitando una entrega propia                                  |
| ----------------- | --------------------------------------------------------------------------------- |
| P026. Sesiones    | Rotación, revocación y reutilización de refresh tokens.                           |
| P027. OAuth/OIDC  | Proveedor de test real, firma, issuer, audience, expiración y PKCE.               |
| P028. Permisos    | Lectura y modificación multi-tenant con casos adversariales por HTTP.             |
| P029. Navegador   | Reproducir XSS/CSRF y verificar correcciones sin confundir CORS con autorización. |
| P030. Amenazas    | Threat model y tests de SQLi/SSRF/mass assignment/abuso.                          |
| P031. Integración | Polling/eventos, GraphQL/gRPC y límites ejecutados sin benchmarks inventados.     |

## Límites conservados

Loopback, datos ficticios y sin identidades, permisos o pagos. P020/P021 validan
manualmente su contrato. Ajv, Zod y Pydantic se contrastan en casos concretos, no
se demuestra equivalencia universal. Pydantic no es un servidor HTTP de la demo.

Los conflictos de inventario son de un proceso síncrono, no transacciones SQL.
El benchmark de lectura usa tmpfs, cachés calientes y ancla conocida; no mide HTTP
o carga concurrente. Firma de cursor no es autorización. Los dos lectores de
contrato viven en el mismo repo, no son SDK publicados. Deprecación ficticia, sin
telemetría de adopción o retirada automática. Los límites se explican también en
cada entrega para que no dependan de haber leído el artículo anterior.
