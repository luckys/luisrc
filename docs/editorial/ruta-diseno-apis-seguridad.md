# Diseño de APIs y seguridad web

Continuación autorizada después de ampliar estructuras de datos y algoritmos.
Serie 03 del catálogo: P020–P031. Español, borradores y ejemplos independientes
de Paysafe. No traducir, publicar, generar audio ni hacer commit automáticamente.

## Entregas nuevas

1. **P020.** [Diseñar una API: el contrato es más que un JSON que funciona](../../src/content/posts/es/api-contrato-esquema-clientes.md).
   Consumidores, representación, esquema, serialización, unidades y compatibilidad.
2. **P021.** [Recursos HTTP: qué prometen GET, POST, PUT, PATCH y DELETE](../../src/content/posts/es/recursos-http-metodos-idempotencia.md).
   Safe/idempotent, sustitución, cambios parciales, creación/procesamiento y REST.

Comparten [laboratorio HTTP](../../examples/api-contratos/README.md),
[OpenAPI 3.1.1](../../examples/api-contratos/openapi.json) y
[ZIP](../../public/assets/examples/api-contratos-lab.zip). Sin instalaciones nuevas.

## Continuación recomendada y cobertura previa

No se renombran artículos antiguos ni se dan fichas por completadas solo por afinidad.

| Orden | Ficha | Material previo y ampliación necesaria |
| --- | --- | --- |
| 3 | P022. Validación | validacion-errores-api-problem-details introduce el tema. Separar sintaxis/semántica/negocio, schemas, optional/refinement, errores acumulados y ejemplos Zod/Pydantic comprobados. |
| 4 | P023. Errores | Ampliar Problem Details, catálogo estable, stock/concurrencia, correlación y logging seguro con pruebas de adaptador. |
| 5 | P024. Paginación | evolucion-api-paginacion-contratos tiene modelo en memoria. Falta laboratorio con un millón de filas, índices e inserciones concurrentes. |
| 6 | P025. Evolución | Ampliar a dos consumidores/versiones, transición, contract tests y política de deprecación real. |
| 7 | P026. Sesiones | autenticacion-autorizacion-tenant explica conceptos. Falta rotación, revocación y prueba de reutilización de refresh token. |
| 8 | P027. OAuth/OIDC | Falta artículo propio e integración con proveedor de test; no sustituirla por un JWT decodificado. |
| 9 | P028. Permisos | Ampliar la política existente a lectura/modificación multi-tenant por HTTP y casos adversariales. |
| 10 | P029. Navegador | Reutilizar laboratorio de frontend/redes; comprobar XSS/CSRF en sandbox y correcciones, sin confundir CORS con autorización. |
| 11 | P030. Amenazas | Threat model y tests de SQLi/SSRF/mass assignment/abuso; preservar límites claros del laboratorio. |
| 12 | P031. Integración | Reutilizar webhooks/SSE previos, comparar polling/eventos y desarrollar GraphQL/gRPC sin inventar benchmarks. |

## Objetivos y fallos que evitar en el inicio

- P020: distinguir interfaz/implementación; publicar unidades y esquema; contrastar
  HTTP con el contrato. Evitar JSON válido implica negocio válido; OpenAPI valida
  automáticamente; persistencia implícita en una respuesta 201.
- P021: justificar métodos; distinguir safe/idempotent; probar sustitución y efecto
  repetido. Evitar idempotencia exige respuestas idénticas; todo PATCH idempotente;
  HTTP JSON demuestra todas las restricciones REST.

## Límites

Estado en memoria, loopback, IDs secuenciales ficticios, sin autenticación ni pagos.
La validación de schemas es manual. El verificador de tests soporta solo los keywords
usados y falla si aparece uno nuevo; no certifica OpenAPI/JSON Schema completos.
La propuesta de pagos es conceptual, no un endpoint ejecutado. P020/P021 no completan
la serie ni el objetivo editorial global. Ver api-contracts-series-review.md.
