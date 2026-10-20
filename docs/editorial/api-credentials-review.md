# P030: credenciales de clientes y ciclo de secretos

## Reanudación y decisión editorial

Reanudado por «continua» el 20 de octubre de 2026. Se conservan los avances previos
sin commit sobre ed7a5b3. La interrupción había dejado credentials.mjs y sus once
tests verdes, pero credential-client.mjs todavía no existía y sus tests fallaban
por módulo ausente. Se implementó el cliente y se completó esta unidad verificable.
Sin commit, push, traducción, audio o publicación nuevos.

Se usa blog-writing-guide para abrir con un problema, explicar decisiones y límites,
probar los extractos y mantener voz directa; flow para recuperar el trabajo real y
verificar la unidad. Dos entregas españolas/draft, autor Luis Ramírez Calle:

1. API-THREATS-CREDENTIALS: generación/verificación de una API key para un cliente,
   caducidad, revocación, scopes y ausencia de fallback. No autentica personas.
2. API-THREATS-SECRETS: recarga comprobada, convivencia, selección, retirada y
   proyección de logs. Rotación programada y contención son decisiones distintas.

No dividir más: cada entrega conserva las piezas de una decisión comprobable. No
mezclar login/MFA con API keys ni presentar un source inyectado como un secret manager.
Dos D2/SVG y una tabla con observaciones HTTP de cinco etapas. Los cinco visores
dinámicos de la ruta siguen disponibles; no se añade otro solo para repetir la tabla.

## Código y pruebas

credentials.mjs emite token efímero con 32 bytes aleatorios de secreto y conserva
SHA-256 del token completo más metadatos, no su valor en claro. Parser acotado,
Authorization única, expiración exacta, revocación y digest comprobados por petición.
La comparación de digests no convierte todo el endpoint en tiempo constante.
Este uso de hash rápido no es una recomendación para contraseñas humanas.

startLab acepta identify opt-in: si se inyecta, nunca cae al fixture público.
Scopes por operación conservan tenant/owner/draft. 401 incluye desafío Bearer;
503 es service_unavailable, también para indisponibilidad del verificador.
Las demos previas sin identify mantienen sus fixtures públicos y tests.

credential-client.mjs copia la candidata antes del await, prueba un GET fijo y solo
tras 200 cambia current. Recargas concurrentes comparten promesa. Un fallo conserva
la anterior sin eludir revocación/caducidad del servidor; sin carga inicial no hay
credencial por defecto. Audit síncrono proyecta eventos/versiones validados, no
token, objeto de fuente o error.message. Fallos del audit no cambian identidad,
pero esa política puede perder eventos: no es auditoría durable.

Diecinueve tests nuevos sobre los 39 anteriores: once de credenciales, siete del
cliente y uno de evidencia. El test de dos recargas se añadió con la implementación;
los primeros tests de cada módulo se escribieron antes y fallaban por módulo ausente.
Los bordes de newline del parser se ampliaron en revisión y ya pasaban sin cambios
de producción; no se inventa una corrección para una regresión no reproducida.

observe-credentials ejecuta HTTP real y solo devuelve status/etapas/versiones. Reloj
lógico para expiración, no benchmark. El archivo archivado se contrasta con una
nueva ejecución y expectativas independientes: 200/200 durante convivencia,
401 antigua y 200 nueva/cliente tras revocar, todo 401 al expirar. No se serializan
credenciales, digests, identificadores aleatorios o puertos temporales.

## Revisión de P030 frente a su alcance

La ficha exige threat model y tests de abuso multi-tenant, no desplegar infraestructura
cloud. Nueve partes desarrollan el temario; no se da por auditada una plataforma:

| Temario                           | Artículos y prueba                                                           | Límite conservado                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Threat model / OWASP API Top 10   | P030, threat-model.json, escenarios T01–T07 y correspondencia a tests        | La lista OWASP orienta; no se reproducen las diez categorías como una certificación        |
| Mass assignment                   | API-THREATS-ASSIGNMENT, tests/lab.test.mjs                                   | Comando title-only, sin publishing o edición anidada                                       |
| SQL injection                     | API-THREATS-SQL, tests/lab.test.mjs                                          | SQLite en memoria, sin servidor SQL/RLS                                                    |
| SSRF                              | API-THREATS-SSRF y DNS, tests/ssrf.test.mjs                                  | HTTP loopback, resolver programado y socket real; no DNS/TLS/firewall desplegados          |
| Abuso de recursos / rate limiting | CAPACITY y RATE, tests/admission.test.mjs                                    | Cupos y bucket de un proceso, no prueba de carga o límite distribuido                      |
| Broken auth                       | CREDENTIALS, tests/credentials.test.mjs; remite a sesiones/OIDC de P026/P027 | Claves de clientes, no login de personas; sin MFA, recuperación o antibrute-force de login |
| Secretos                          | SECRETS, tests/credential-client.test.mjs y credential-evidence.test.mjs     | Fuente en memoria, no proveedor remoto, varias réplicas o audit durable                    |

T07 pasa de pending a demonstrated_in_fixture_only; T01 documenta ambos modos.
No se deja pendiente ficticiamente un despliegue de secret manager como condición
para poder seguir escribiendo. P026 sí mantiene su gap independiente: refresh es
un modelo separado del RP, no renovación OAuth integrada. El objetivo editorial
completo no está demostrado por esta revisión ni por contar 32 artículos API.

## Verificación final

- `pnpm build`: pasa, 48 rutas estáticas; Pagefind ocho páginas/4104 palabras.
- `node --test tests/*.test.mjs`: 72 tests pasan después del build. Nueve drafts
  de amenazas, 14 extractos reales, dimensiones SVG, enlaces, modelo y ZIP exactos.
- `pnpm test` del laboratorio: 58 tests pasan. ZIP final extraído en
  `/tmp/api-credentials-zip.wmLUXd`: los mismos 58 pasan sin instalar dependencias;
  no se cuentan dos veces. `pnpm demo:credentials` del ZIP reproduce las cinco
  etapas y termina solo, con servidor cerrado y sin imprimir tokens.
- ZIP allowlisted de 40 archivos, byte a byte igual a fuentes. Dist y public
  contienen el mismo ZIP. Los 32 drafts API no aparecen en HTML/Markdown de posts
  ni llms.txt; los tests SEO verifican además sitemap y metadatos publicados.
- Chromium, revisión proporcional: seis vistas de los tres artículos afectados
  (P030 y las dos nuevas entregas), a 1440/360 px, y los cinco visores existentes.
  Todos pasan. Sin overflow de página, errores JS/KaTeX, enlaces locales rotos o
  imágenes sin cargar. noindex conservado. Tabla nueva desplazable por teclado.
  Informe `/tmp/api-contracts-layout.L90fJV/report.json`.
- Inspección visual de ambos diagramas móviles y tabla: texto legible y diagrama
  dentro del ancho. Tabla mantiene scroll interno sin ensanchar el documento.
  Se reutiliza la evidencia previa de 60 vistas para los 29 artículos no modificados,
  no se afirma haber vuelto a ejecutar 64 vistas en este turno.
- Astro temporal pid 2024526 detenido; status confirma que no hay dev server.
  Prettier y `git diff --check` pasan. No se dejaron servicios de las demos activos.

## Próxima unidad

P031: leer sus dos candidatos previos y diseñar el ejercicio de estado de pedido
mediante polling y eventos. Separar mecanismos y ejercicios: comparación observable,
GraphQL/N+1 y contratos RPC/gRPC no deben quedar mezclados en un resumen largo.
Reutilizar webhooks/SSE previos donde ya exista profundidad; revisar esquemas,
autenticación, seguridad y versionado sin inventar latencias o garantías de entrega.
