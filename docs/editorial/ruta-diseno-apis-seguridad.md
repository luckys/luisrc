# Diseño de APIs y seguridad web

Continuación autorizada después de ampliar estructuras de datos y algoritmos.
Serie 03 del catálogo: P020–P031. Español, borradores y ejemplos independientes
de Paysafe. No traducir, publicar, generar audio ni hacer commit automáticamente.

## Entregas nuevas

1. **P020.** [Diseñar una API: el contrato es más que un JSON que funciona](../../src/content/posts/es/api-contrato-esquema-clientes.md).
   Consumidores, representación, esquema, serialización, unidades y compatibilidad.
2. **P021.** [Recursos HTTP: qué prometen GET, POST, PUT, PATCH y DELETE](../../src/content/posts/es/recursos-http-metodos-idempotencia.md).
   Safe/idempotent, sustitución, cambios parciales, creación/procesamiento y REST.
3. **P022.** [Validar una API: del JSON correcto a una operación que tiene sentido](../../src/content/posts/es/validacion-runtime-json-schema-zod-pydantic.md).
   Parsing, JSON Schema, Zod/Pydantic ejecutados, optional/null, refinements,
   acumulación segura, validación de salida y compatibilidad.
4. **P023.** [Errores de API: distinguir un dato inválido, falta de stock y un conflicto de versión](../../src/content/posts/es/errores-api-problem-details-stock-concurrencia.md).
   Problem Details, catálogo, conflictos, causas, request ID y logging con allowlist.

5. **P024.** [Paginación con PostgreSQL](../../src/content/posts/es/paginacion-offset-keyset-postgresql-concurrencia.md).
   Millón de filas, índices, planes, inserciones, snapshots y visor educativo.
6. **P025.** [Evolución de APIs con consumidores](../../src/content/posts/es/evolucion-api-versiones-consumidores-contratos.md).
   Dos clientes, OpenAPI, breaking/aditivo, SemVer y deprecación con guía local.

P020/P021 comparten [laboratorio HTTP](../../examples/api-contratos/README.md),
[OpenAPI 3.1.1](../../examples/api-contratos/openapi.json) y
[ZIP](../../public/assets/examples/api-contratos-lab.zip). Sin instalaciones nuevas.

P022/P023 comparten un [segundo laboratorio](../../examples/api-validacion-errores/README.md)
y su [ZIP](../../public/assets/examples/api-validacion-errores-lab.zip). Zod/Ajv
fijados con pnpm y lockfile propio. Pydantic ejecutado en una imagen Python ya local,
sin instalaciones implícitas. No cambian las garantías de los ejemplos anteriores.

P024/P025 comparten un [tercer laboratorio](../../examples/api-paginacion-evolucion/README.md)
y [ZIP](../../public/assets/examples/api-paginacion-evolucion-lab.zip). pg/Ajv con
pnpm y PostgreSQL local efímero fijado por digest: trece tests sin Docker y seis
PostgreSQL. [Visor educativo](../../public/assets/interactive/api-pagination/explorer.html)
separado de las mediciones SQL. Sin autenticación o base externa.

## Continuación recomendada y cobertura previa

No se renombran artículos antiguos ni se dan fichas por completadas solo por afinidad.

| Orden | Ficha             | Material previo y ampliación necesaria                                                                                       |
| ----- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 7     | P026. Sesiones    | autenticacion-autorizacion-tenant explica conceptos. Falta rotación, revocación y prueba de reutilización de refresh token.  |
| 8     | P027. OAuth/OIDC  | Falta artículo propio e integración con proveedor de test; no sustituirla por un JWT decodificado.                           |
| 9     | P028. Permisos    | Ampliar la política existente a lectura/modificación multi-tenant por HTTP y casos adversariales.                            |
| 10    | P029. Navegador   | Reutilizar laboratorio de frontend/redes; comprobar XSS/CSRF en sandbox y correcciones, sin confundir CORS con autorización. |
| 11    | P030. Amenazas    | Threat model y tests de SQLi/SSRF/mass assignment/abuso; preservar límites claros del laboratorio.                           |
| 12    | P031. Integración | Reutilizar webhooks/SSE previos, comparar polling/eventos y desarrollar GraphQL/gRPC sin inventar benchmarks.                |

## Objetivos y fallos que evitar en el inicio

- P020: distinguir interfaz/implementación; publicar unidades y esquema; contrastar
  HTTP con el contrato. Evitar JSON válido implica negocio válido; OpenAPI valida
  automáticamente; persistencia implícita en una respuesta 201.
- P021: justificar métodos; distinguir safe/idempotent; probar sustitución y efecto
  repetido. Evitar idempotencia exige respuestas idénticas; todo PATCH idempotente;
  HTTP JSON demuestra todas las restricciones REST.
- P022: separar fronteras; ejecutar tres validadores; adaptar errores sin reflejar
  entradas. Evitar anotaciones validan runtime; optional equivale a null; un schema
  garantiza disponibilidad de stock. Prerrequisito de lectura P021: P014 permanece
  fuera del encargo de Serie 02 y no se introduce una dependencia a un post inexistente.
- P023: clasificar condiciones; contrastar códigos/estado; correlacionar sin filtrar.
  Evitar todo error es 400; 500 implica ausencia de efectos; dos clientes en un
  proceso prueban transacciones distribuidas.
- P024: orden total, continuidad y límites bajo escrituras. Evitar equiparar cursor
  con keyset, keyset con snapshot o firma con autorización.
- P025: dos consumidores, convivencia y transición. Evitar asumir que todo cambio
  aditivo es compatible, que el schema detecta unidades o que un SDK nuevo migra
  aplicaciones ya desplegadas.

## Límites

Estado en memoria, loopback, IDs secuenciales ficticios, sin autenticación ni pagos.
La validación de schemas de P020/P021 es manual. Su verificador soporta solo los
keywords usados, no certifica OpenAPI/JSON Schema completos. P022 usa Ajv real para
2020-12; el acuerdo de los tres validadores se prueba en veinte documentos y fronteras
Unicode, no en todos los valores posibles. P023 prueba dos POST concurrentes en un
proceso; la consulta posterior es conceptual y 503 se simula por inyección.
La propuesta de pagos sigue siendo conceptual. P024 usa datos sintéticos en tmpfs,
cachés calientes y ancla conocida; los tiempos no miden HTTP o carga concurrente.
P025 prueba lectores del mismo repo, sin SDK publicado o retirada automática.
Faltan P026–P031. Ver api-pagination-evolution-review.md y las revisiones previas.
