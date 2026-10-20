# P031: integración de APIs, revisión del bloque

Cuatro artículos españoles, draft y con autor Luis Ramírez Calle. Se mantienen en
la Serie 03, después de las 32 entregas previas. Una ficha del roadmap, no cuatro.
El código nuevo vive solo en `luisrc-blog-examples/packages/api-integration`.

## División editorial

1. Polling/SSE: estado frente a historial, ETag, hueco snapshot/conexión, replay y resync.
2. GraphQL: schema, resolvers y N+1, batching/memoización y aislamiento de caché.
3. gRPC: un RPC unary completo, contrato binario, cliente anterior y plazo de espera.
4. Elección: separar contrato, interacción y entrega; callbacks y subscriptions.

Cada entrega desarrolla una pregunta y un ejercicio coherente. No se fragmenta
gRPC por palabra clave: la compatibilidad y el deadline comprueban el mismo RPC
de lectura. Webhooks, inbox y SSE de interfaz ya tienen tutoriales específicos;
el cierre enlaza esos mecanismos y no los condensa en otra implementación.
No se crea una comparación de cinco tecnologías con promesas de rendimiento.

## Cobertura de la ficha

| Temario                            | Desarrollo y evidencia                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Request/response y latencia        | GET/ETag/304, unary RPC y presupuestos; recuentos, no p95 inventado                       |
| Schemas                            | GraphQL.js y dos contratos `.proto` cargados por runtime                                  |
| RPC y versionado                   | gRPC HTTP/2 real, cliente anterior ignora campo 4; reservas y semántica                   |
| GraphQL N+1                        | Mismo documento/datos: 1+3 lecturas frente a 1+1, repositorio instrumentado               |
| Subscriptions                      | Semántica GraphQL y transporte explicados; SSE propio ejecutado, sin afirmar equivalencia |
| Callbacks                          | Contrato/OpenAPI, SSRF y firma/inbox, con enlace al laboratorio previo de webhooks        |
| Autenticación y seguridad          | Fixture público, filtro de tenant en cada adaptador, límites, caché por operación         |
| Laboratorio pedido polling/eventos | HTTP y SSE reales, mismo pedido y estado final, replay y cursor vencido                   |

La ficha no exige un broker cloud ni implementar todos los protocolos de subscription.
Estos límites se explican, no se presentan como capacidades ejecutadas.

## Verificación

- Se escribieron primero los tests y se observó el fallo por módulos ausentes.
  Implementados y contrastados contra expectativas independientes.
- `pnpm --dir packages/api-integration test`: 17 tests; HTTP/SSE, GraphQL y gRPC reales,
  contratos adversariales, evidencia reproducible y dos comprobaciones de tiempo lógico.
- `pnpm test`: cuatro tests de estructura, índices y conservación de fuentes originales.
- `BLOG_ROOT=../luisrc-blog pnpm test:editorial`: 46 tests, incluidos metadatos,
  seis extractos JavaScript, GraphQL, Protobuf y dimensiones SVG.
- `pnpm install --frozen-lockfile` y las trece suites locales `pnpm test:labs`: pasan.
- Blog: build y 19 pruebas pasan. Los cuatro drafts no se emiten como HTML o Markdown
  público, ni aparecen en sitemap/llms. Las fuentes estáticas tienen hashes de procedencia.
- Chromium: ocho vistas de los cuatro artículos, a 1440/360 px, sin overflow de página,
  imágenes rotas, errores KaTeX o de ejecución. Seis visores pasan sus casos, incluido
  el timeline nuevo: teclado, versiones intermedias, fin de ventana y scroll de tabla.
  Informe final: `/tmp/api-contracts-layout.KLNUd9/report.json`.
- Inspección visual de la captura móvil del diagrama gRPC y del timeline realizada.
  Se redujeron los márgenes de los cuatro SVG y se abreviaron etiquetas para móvil,
  sin cambiar los mecanismos explicados; después se repitieron las ocho vistas.

## Límites que no deben desaparecer en una continuación

Identidades públicas de fixture, loopback sin TLS, datos/eventos en memoria. El ETag
solo reconoce la etiqueta exacta de su cliente. SSE propio, retención acotada y sin
auto-reconnect de cliente; no heartbeat, revalidación de permisos o persistencia.
No se asegura exactly once ni que una versión de proyección haga idempotente un efecto.

DataLoader por operación, repositorio Map, sin SQL ni benchmark. Allowlist HTTP de
un documento, sin gateway GraphQL general o subscriptions ejecutadas. Contratos
Protobuf dinámicos, sin generación TypeScript, gRPC streaming o gateway navegador.
Cancelación de un timer, no rollback ni cancelación demostrada de un driver SQL.

No se ha ejecutado un broker o secret manager, ni repetido PostgreSQL/Redis/Docker
de otras series. Tampoco se cierra el límite P026: refresh sigue separado del RP.
Los enlaces GitHub se verifican contra archivos locales; no se hace push ni se crea
el repositorio remoto en esta tarea.
