# Revisión: integración y contratos de API

22 de octubre de 2026. Serie anterior confirmada: blog `f50c079`, ejemplos `c56d6aa`,
sin push. Antes de confirmar se repitieron ocho checks estructurales/editoriales,
28 tests locales, once de contratos/HTTP, contraejemplo débil, cuatro mutaciones
manuales y typecheck. No se repitieron entonces los diez recorridos visuales, cuya
evidencia está en testing-strategy-review.md. Esta entrega nueva sigue sin commit.

## Criterio editorial y división

Cinco drafts españoles de Luis Ramírez Calle, 1300–1550 palabras incluyendo
metadata/código: P056 lifecycle, INT-FIXTURES datos/tiempo, INT-ISOLATION conexiones,
CONTRACT-SCHEMA estructura/significado y CONTRACT-CDC generación/verificación Pact.
Ruta y manifest propios. La guía de escritura motivó separar las cinco preguntas
con ejercicios independientes, manteniendo consumidor y proveedor juntos en Pact.
La guía flow motivó distinguir cada afirmación de la frontera realmente ejecutada.

Se contrastaron DESIGN-TDD/P055 y P025 antes de ampliar; no se recrean la introducción
HTTP/OpenAPI ni el ejemplo previo de compatibilidad. Ahora se añaden lifecycle real
Testcontainers, namespaces de tests, dos conexiones identificadas, factories/tiempo,
contrato Pact generado y provider states. Sin relación comercial con Paysafe.

Fuentes primarias: docs Node Testcontainers (PostgreSQL, containers y lifecycle),
Pact JS consumer/provider y provider states/Broker, PostgreSQL18 schemas/transacciones/
SQLSTATE, node-postgres transacciones, Ajv/JSON Schema y AIP180. Consultadas el 22;
APIs contrastadas también con tipos y fuentes instaladas. Versiones fijadas para
reproducir, no afirmación de últimas versiones o recomendación de producción.

## Laboratorio y desarrollo observado

Solo packages/integration-contracts del monorepo. Node24.19.0, TS5.9.2 estricto en
src/**/*.ts; glue/tests mjs verificados mediante ejecución. pg8.23.1, Ajv8.20.0,
Testcontainers12.2.1, Pact17.1.4/pact-core20.2.0. pnpm en toda instalación, scripts
de instalación desactivados, binario nativo Pact distribuido como paquete opcional.
Instalación con lockfile congelado repetida y política de supply-chain activa.

Tests del núcleo escritos antes de módulos: rojo por import ausente y green tras
implementar. No se atribuye un ciclo red-green individual a cada comportamiento.
Typecheck detectó parameter property no soportada por erasableSyntaxOnly; se cambió
a campo y asignación explícitos. No se habilitó una transformación incompatible
con el runner nativo. No se presenta ese error de tipos como una regresión de negocio.

Primera integración pasó cinco escenarios SQL y falló cuatro de Pact: su validación
exigía providerVersion por existir publishVerificationResult, aun siendo false.
Se añadió local-lab manteniendo publicación desactivada y sin configurar Broker.
La expectativa negativa de contrato rechazó ese fallo de configuración, no lo contó
como prueba de incompatibilidad. Repetición final: nueve escenarios pasan.

Lecturas iniciales tras reanudación expiraron en revisión automática de permisos,
sin ejecución; los reintentos acotados completaron la lectura. No rechazo de seguridad
ni acciones parcialmente aplicadas en esos intentos expirados.

## Dependencias, datos y lifecycle

Imagen oficial local, sin pull implícito:
postgres:18-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15.
Servidor observado 18.4. Un nodo, 0.5GiB/CPU1, datos tmpfs256MiB. Puerto efímero
127.0.0.1: docker inspect comprueba bind y ausencia de volúmenes/binds del host.
Subclass con hook protegido para HostIp, dependencia fijada y configuración efectiva
comprobada. Docker remoto rechazado, sin DATABASE_URL ajeno o credenciales reales.

Una instancia por run, schema UUID/pool por escenario y tablas cualificadas. Mismo
usuario del ejercicio: namespaces no son permisos entre tenants. Pool de dos clientes
para el caso de rollback. API solo lectura, HTTP loopback, sin reset público o modo
de fallo seleccionable por URL. SQL parametrizado para valores; identificadores
interpolados solo generados/validados por el fixture.

Reaper desactivado solo en este fixture: sin Ryuk/socket Docker dentro de helper.
finally explícito en schema, API, base y wrapper por runId con inspección de etiquetas.
Se prueba callback que lanza error y schema retirado. Recuperación por timeout
codificada, pero sin SIGKILL/fallo del wrapper inyectado: no afirmar cleanup ante
cualquier crash. Docker no dejó contenedores propios ni se tocó otro proyecto.

## Resultados y límites observados

4 tests del núcleo + 2 del consumidor + 9 PostgreSQL/HTTP/Pact, repetidos con código
final y archivados en evidence/verification.json, con SHA-256. No sumar repeticiones.

- ID repetido 23505 e importe cero 23514, lectura real conserva valores.
- Mismo o-1 en dos schemas con 1250/9900, sin mezclar resultados.
- Dos backend PIDs: o-1 no confirmado invisible a API; rollback A no revierte o-2
  confirmado por B. B lo escribe el repositorio, no un endpoint POST inexistente.
- planned_failure retira su schema, comprobado en pg_namespace.
- ALTER ADD label/UPDATE en tabla mínima conserva v1/v2=1250 y label=Libro.
- Contrato Pact v4 generado con cliente real: dos interacciones, pedido 200 y ausencia404.
  Baseline y aditiva verificadas contra API/PostgreSQL, no respuestas del mock.
- Renamed devuelve 200 pero pierde amountMinor: schema/cliente/verifier rechazan.
- Unit-drift devuelve12: schema y matcher integer aceptan; expectativa1250 falla.

Sin Broker/publicación, can-i-deploy, consumidores externos, CI desplegada, UI E2E,
auth/TLS/workers, HA, almacenamiento durable o benchmark. ALTER en tabla pequeña
no demuestra migración online sin locks. createdAt solo string en el schema JSON,
no validación temporal completa. Factory y función isRecent son ejercicios propios,
no filtro de API integrado. No se da por aceptada toda Serie06 o el roadmap por IDs.

## Verificación editorial y de sitio

78 checks cruzados/estructurales pasan: cuatro nuevos para metadata/orden, trece
extractos, cinco D2/SVG con alt/dimensiones reales y hashes/Pact/resultados acotados.
179 índices, 24 paquetes y mismos 48 exports estáticos. Enlaces GitHub contrastados
con checkout local, no disponibilidad de un remoto todavía pendiente de creación/push.

Build pasa: 50 rutas, 61 HTML, diez páginas publicadas y 4280 palabras Pagefind.
Los cinco drafts no se publican. Diecinueve tests del blog pasan después del build.
Inventario regenerado: 60 IDs exactos, 27 relacionados, 88 sin artículo. No aceptación.
Tests relacionados api-contracts(11), api-pagination-evolution locales(13) y
testing-strategy locales(28) pasan. No se repite su PostgreSQL de un millón de filas.

La resolución pnpm mantiene las versiones existentes; reordena snapshots e incluye
supports-color como peer opcional de debug/oidc-provider. Revisión de diff realizada,
sin actualización de oidc-provider9.12.2 o React19.2.0. Los diez tests locales de
api-identity pasan tras esa resolución. No se ejecutan todos los labs.

Chromium: cinco posts a 1440/360, diez vistas pasan en
/tmp/integration-contracts-layout.mBECfe/report.json. H1/noindex, recursos cargados,
enlaces locales, sin overflow de página, foco/scroll de código y regiones de tabla.
Cinco capturas de diagramas móviles inspeccionadas, legibles. Las dos tablas móviles
se revisaron también: mantienen su ancho dentro de regiones con scroll horizontal,
sin ensanchar la página; el recorrido automatizado comprueba su manejo con teclado.
Sin nueva descarga de navegador. Servidor temporal PID3108793 cerrado y puerto4322
sin listener. Retirado únicamente el pruning automático del lockfile del blog;
se conserva el lockfile del monorepo con las nuevas dependencias del laboratorio.

## Continuidad

Siguiente P057: contrastar fault-injection-pruebas-propiedades y reliable-services.
Ampliar propiedades/generadores/shrinking, fuzzing, scheduling y replay, con bug
reproducible y caso mínimo. Mutation testing ya tiene introducción ejecutada en P055;
no recrearla como si cerrara toda P057. Después P058 carga/profile y observabilidad.
Gaps P026 y Stripe sandbox P045 se mantienen. Español/draft, sin traducción, audio,
publicación o push automáticos. Nuevos posts/lab pendientes de commit.
