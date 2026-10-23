# Continuación del objetivo editorial completo

## Continuación vigente: rendimiento y profiling, 22 de octubre de 2026

Propiedades confirmadas en el turno anterior: blog 74b3eef, ejemplos c778ec9,
sin push. Ahora siete drafts de P058: distribuciones, modelos de carga,
saturación/recuperación, carga sostenida, microbenchmarks, CPU y memoria.
Ruta-rendimiento-profiling.md, performance-series.json y performance-review.md.
Se conserva OPS-LOAD y su laboratorio original, con enlace a la ampliación.

Código solo en packages/performance-lab; snippets dentro de los artículos.
Node24.19.0/TS5.9.2, k6 2.3.0 oficial instalado con pnpm tools:install y SHA-256.
Siete fases HTTP reales, procesos separados/misma máquina. Dos ventanas open350
dan 958/1751 y 953/1751 éxitos; recovery25 sin errores. Un VU descarta240
iteraciones sin HTTP fallidos. Fase60s tiene1501 éxitos; no soak de horas.
Tres procesos de benchmark, tres CPU profiles, seis snapshots V8. Perfil normal
lento opaco; diagnóstico no-turbo-inlining separado muestra findRateSlow.
Caché sin límite retiene500/1500; acotada100/100; retirando referencia ambas0.
No retained size, SQL, cloud, proveedor o CPU aislada. Timings no universales.

Diez tests del lab y verificación de muestras/hashes pasan;87 checks cruzados
y19 tests del blog, build correcto.193 índices,26 paquetes,53 exports estáticos.
Siete D2, dos gráficas derivadas y visor de siete escenarios, solo datos archivados.
Chromium16 vistas:14 de posts más2 del visor,14 selecciones de escenario, teclado,
iframe, tablas y sin overflow. Diagrama/gráficas/tablas móviles inspeccionados.
Informe /tmp/performance-layout.UWIYeG/report.json. Servidor3280870 cerrado,
puerto4322 sin listener. Lock del blog restaurado solo de pruning automático;
monorepo añade importador nuevo sin versiones nuevas de dependencias npm.
Heaps y binario k6 locales/ignorados, no publicados. Artículos/lab sin commit.

Siguiente P059/P060: contrastar observabilidad-logs-metricas-trazas-workers,
sli-slo-error-budget-servicios y reliable-services. Verificar OpenTelemetry,
propagación, métricas agregables/exemplars y recorrido frontend/worker real;
no atribuir esas garantías a logs manuales. Después operaciones y CI/CD según
fichas. Gaps P026, Stripe sandbox P045 y soak prolongado P058 conservados.
No aceptar Serie06 por recuentos/IDs. Español/draft, sin traducción, audio,
publicación, commit o push automáticos. Las notas inferiores son históricas.

## Continuación vigente: pruebas basadas en propiedades, 22 de octubre de 2026

Serie de integración confirmada: blog c0a1b48, ejemplos d7c9f26, sin push.
La evidencia P056 previa se conserva; checks cruzados verifican hashes y fuentes,
sin volver a arrancar su PostgreSQL/Pact en este turno.

P057 se amplía en siete drafts: propiedades/generadores, shrinking/replay, modelo
de secuencias, scheduler de carreras, fuzzing, fault injection y evaluación de
oráculos con variantes manuales. Ruta-pruebas-propiedades.md y manifest/revisión
property-testing propios. Se conserva OPS-FAULTS como introducción, con enlace
a la ampliación, sin atribuir shrinking a su antiguo generador LCG.

Código solo en packages/property-testing. fast-check4.10.2, Node24.19.0, TS5.9.2.
Quince tests, catorce extractos, siete D2/SVG. Seed5702 reduce rechazo atrasado
a submit/confirm/decline; cuatro reducciones y replay confirmado. Duplicado
submit/confirm/confirm y after-effect con clave nueva también detectados.
Scheduler muestra read/read/write/write con valor1; arreglo local da2. No SQL,
red, crash real o disco durable. Tres mutaciones seleccionadas, sin Stryker o
score global. Proveedor Set/journal en memoria, no proceso reiniciado ni PSP.

82 checks cruzados/estructurales, build y19 tests del blog pasan. Catorce vistas
Chromium1440/360, siete diagramas móviles inspeccionados; tabla mejorada y
recorrido repetido. Informe /tmp/property-testing-layout.FD5dfr/report.json.
Servidor temporal3178077 cerrado,4322 sin listener. Lockfile del blog restaurado
solo del pruning automático; monorepo conserva fast-check/pure-rand nuevos.
186 índices,25 paquetes,48 exports estáticos. Nuevos posts/lab sin commit.

Siguiente P058: contrastar pruebas-carga-percentiles-saturacion y reliable-services.
Ampliar carga real/modelo abierto-cerrado, percentiles/warm-up/reproducibilidad,
saturación/stress/soak y profiling CPU/memoria en posts específicos según evidencia.
No presentar cola determinista o tiempos de un test como medición de servidor.
Después P059/P060 observabilidad. Conservar gaps P026 y Stripe sandbox P045;
no dar toda Serie06 por aceptada por IDs. Español/draft, sin traducción, audio,
publicación o push automáticos. Las entradas inferiores son históricas.

## Continuación vigente: integración y contratos, 22 de octubre de 2026

Serie de pruebas confirmada: blog `f50c079`, ejemplos `c56d6aa`, sin push.
Revalidados ocho checks estructurales/editoriales, 28+11 tests, contraejemplo débil,
cuatro mutaciones manuales y typecheck antes de confirmar. Ahora cinco drafts de
P056: Testcontainers, fixtures/factories, aislamiento, schemas y Pact. Ver
ruta-integracion-contratos.md, integration-contracts-series.json y revisión propia.

Código solo en packages/integration-contracts del monorepo. PostgreSQL18.4 por
digest, Testcontainers12.2.1 y Pact17.1.4; HTTP loopback, schemas privados y tmpfs.
Cuatro tests de núcleo, dos del consumidor y nueve de integración. Contrato local
de dos interacciones, no Broker o matriz de despliegue. Variante renombrada rechazada;
unit-drift pasa schema/integer pero falla expectativa monetaria. Reaper desactivado
solo en el fixture, cierre explícito/wrapper; sin SIGKILL probado, HA o disco durable.
Nuevos posts/lab sin commit. No dar toda Serie06 por aceptada contando IDs.

Siguiente P057: contrastar fault-injection-pruebas-propiedades y reliable-services;
ampliar generadores/shrinking, fuzzing, scheduling y replay con regresión mínima
reproducible. Después P058 carga/profile y observabilidad. Mantener gaps P026 y
Stripe sandbox P045. Español/draft; sin traducción, audio, publicación o push.
Las entradas inferiores son históricas.

## Continuación vigente: pruebas de software, 22 de octubre de 2026

Kafka confirmado: blog `4cd1476`, ejemplos `b501dab`, sin push. Revalidados ocho
checks estructurales/editoriales de Kafka, ocho tests locales y typecheck antes
del commit; integración del broker conservada de la revisión anterior.

P055 se amplía en cinco drafts: diseño/oracle, TDD, test doubles, niveles de prueba
y coverage/mutaciones. Ver ruta-pruebas-software.md, testing-strategy-series.json
y testing-strategy-review.md. Se conserva DESIGN-TDD como introducción. Código
solo en packages/testing-strategy del monorepo, con snippets dentro de los posts.

Registro de jobs, no worker. Fake Map, SQLite real, HTTP loopback y archivo
cerrado/reabierto. Sin UI E2E, PostgreSQL o Testcontainers. 28 tests locales y once
de contratos/HTTP; suite débil aparte con 100 % solo en transitions.ts. Cuatro
mutaciones manuales detectadas por el núcleo, tres en el archivo ejecutado por
la suite débil y una fuera de su alcance. Sin Stryker ni score global.
Nuevos artículos/lab sin commit; no aceptar toda Serie 06 por recuentos o IDs.

Siguiente: P056 específico, contrastar api-contracts y api-pagination-evolution
antes de redactar lifecycle Testcontainers/fixtures/factories y contratos de API
verificados por clientes. Después P057 y P058, luego observabilidad y operaciones.
Mantener los gaps P026 y Stripe sandbox P045. Español/draft, sin traducción, audio,
publicación o push automáticos. Las notas inferiores son históricas.

## Continuación vigente: Kafka, 21 de octubre de 2026

Confirmada fundamentos distribuidos: blog `4b33999`, ejemplos `7e50860`, sin push.
Después se añaden cinco drafts de P051: log/retención, particiones/keys,
consumer groups, offsets/replay y lag/backpressure. Ver ruta-kafka-streaming.md,
kafka-streaming-series.json y kafka-streaming-review.md. Código solo en
packages/kafka-streaming del monorepo; snippets explicados dentro del post.

Broker real oficial 3.9.1 fijado por digest, KafkaJS 2.2.4, loopback, KRaft de un
nodo y RF=1. Reconstrucción de dos envíos, redelivery/checkpoint, asignación/salida
limpia, pause/resume y prefijo eliminado por DeleteRecords. No confundirlo con
expiración temporal observada, compaction, crash, RF>1, failover o exactly-once.
Proyección/dedup en memoria; checkpoint durable no reconstruye una vista volátil.
No dar por aceptada toda Serie 05 contando IDs. La serie nueva queda sin commit.

Siguiente: auditar las fichas de Serie 06 y posts existentes antes de redactar
pruebas/calidad/CI/CD, AWS, Terraform/Kubernetes y observabilidad. Los gaps de P026
y Stripe sandbox de P045 siguen declarados. Mantener español/draft, laboratorios
fuera del blog, sin audio, traducción, publicación o push automáticos.

## Continuación vigente: fundamentos distribuidos, 21 de octubre de 2026

Revisada y confirmada la serie de fronteras: `fbeba30` blog, `92dba16` ejemplos,
sin push. Después se añaden seis drafts de P048: replicación/consistencia, quorum,
consenso/elección, Lamport, CAP/PACELC y sharding. Ruta en
ruta-fundamentos-distribuidos.md; laboratorio en packages/distributed-foundations.
Los ocho posts anteriores de fallos, idempotencia, colas, webhooks, Outbox, sagas,
retries y reconciliación se reutilizan, no se renumeran ni se recrean.

Modelos de un proceso: réplicas y mensajes manuales, conjuntos, regla de voto,
contador y directorio. Sin red, disco, Raft completo, clúster CP/AP, movimientos de
registros o migración recuperable. Mantener límites explícitos en posts y README.
No dar P048 o Serie 05 por aceptados contando artículos. Siguiente bloque P051:
log/retención, particiones/claves, consumer groups/offsets y replay; comprobar antes
infraestructura local si se quiere afirmar Kafka real. Después lagunas de Serie 06.
Sin traducción, audio, publicación o push. Esta serie nueva queda sin commit.
Evidencia de revisión en distributed-foundations-review.md; notas inferiores históricas.

## Continuación vigente: fronteras de arquitectura, 21 de octubre de 2026

Tras revisar y confirmar principios (`8cb7108` blog, `e3fb352` ejemplos), se añaden
cinco drafts: P045 puertos/adaptadores, ARCH-LAYERS capas/Clean, ARCH-OWNERSHIP
módulos/datos, ARCH-CQRS proyección y P046 costes de despliegue. Ruta en
ruta-fronteras-arquitectura.md; evidencia en architecture-boundaries-review.md.
Código solo en packages/architecture-boundaries del monorepo de ejemplos.

HTTP real contra fixture loopback y checker de imports; dos módulos en un proceso,
entrega manual de eventos, estado y deduplicación volátiles. No Stripe sandbox,
SQL, broker, worker autónomo, TLS, despliegues independientes o benchmark cloud.
No aceptar P045 por su ID: la integración comercial exigida sigue sin ejecutarse.
No dar Serie 05 por completa. Siguiente: contrastar P048/P051 y gaps distribuidos
sin duplicar outbox, sagas o idempotencia; después Serie 06. Mantener español/draft,
sin traducción, audio, publicación o push automáticos. Notas posteriores históricas.

## Continuación vigente: principios de diseño, 21 de octubre de 2026

Confirmada la entrega anterior: blog `a7b4e69`, ejemplos `9316534`, sin push.
Después se añaden siete drafts españoles para profundizar P043: cohesión/SRP,
OCP/composición, LSP, ISP, DIP/DI, KISS/YAGNI y DRY. Ver ruta-principios-diseno.md
y design-principles-review.md. Laboratorio en packages/design-principles, snippets
dentro de los posts, contratos y tests locales, sin proveedor o base de datos.

La división separa siete preguntas de diseño, no siete fichas del roadmap. No
repetir el resumen DESIGN-MODULES. El usuario pide revisar y confirmar este bloque
y continuar P045/P046 con entregas específicas sobre puertos/adaptadores, capas,
ownership modular, consistencia/modelos de lectura y costes de despliegue. No dar
P045 por completo: todavía no se sustituye un proveedor Stripe sandbox. Después
revisar P048/P051 y Serie 06. Mantener español/draft, sin audio, traducción,
publicación o push automáticos. Notas posteriores son históricas.

## Continuación vigente: división conceptual DDD, 21 de octubre de 2026

La serie de modelado pasa de cinco a diez drafts: ocho conceptos DDD con post
propio (lenguaje, contextos, entidades, valores, agregados, servicios, repositorios
y eventos), más C4 y ADR. Se conservan las URLs anteriores y se amplían mecanismos,
ejemplos y ejercicios. Ver ruta-modelado-arquitectura.md y domain-design-review.md.
Código completo en packages/domain-design del monorepo: 25 tests, incluidos nuevos
casos de identidad, igualdad, fechas, política temporal y confirmación de eventos.
Las notas de cinco posts más abajo son históricas y su decisión de agrupar Money
y Payment queda sustituida por la petición expresa de separarlos.

No declarar P044 completo por tener ocho partes: política logística, entidad y
reservas monetarias siguen siendo ejercicios separados. Sin SQL, proveedor o
entrega durable. Siguiente bloque sigue siendo P043/P045/P046; este encargo solo
amplía y reorganiza la serie actual. Mantener draft/español, sin commit automático.

## Continuación vigente: modelado y arquitectura, 20 de octubre de 2026

Se añaden cinco borradores españoles: vocabulario/contextos (P044), valores y
agregados, repositorios/eventos, C4 (P047), ADR/RFC. Ver
[orden de lectura](ruta-modelado-arquitectura.md) y
[contraste de persistencia/arquitectura](persistence-architecture-coverage-review.md).
Los quince posts de bases de datos se reutilizan sin renumerar sus IDs DB-*.
Se corrigen referencias malformadas `publichttps` y rutas anteriores del manifiesto.

Código completo en `luisrc-blog-examples/packages/domain-design`; snippets explicados
dentro de los posts. Node 24.19.0 y TypeScript 5.9.2 estricto. Reglas, revisión optimista
y eventos en memoria; tres SVG C4 son diseño objetivo, no servicios desplegados.
ADR propuesta, sin comparación ejecutada PostgreSQL/DynamoDB. No dar P044/P047 ni
Serie 05 completa por la presencia de archivos o tests. El flujo logístico y las
reservas de pago se prueban separados. No hay proveedor, SQL, outbox durable o auth.

Siguiente paso editorial: ampliar P043/P045/P046 sin repetir el artículo introductorio
de monolito modular. Después P048/P051 y lagunas distribuidas, luego Serie 06.
Mantener posts específicos, español y draft, código de laboratorio en monorepo.
No traducción, audio, publicación, commit o push automáticos. Los apartados posteriores
son históricos; los límites de P026 y demás laboratorios siguen abiertos.

La revisión y la evidencia de esta entrega se registran en `domain-design-review.md`.

## Continuación vigente: P031, 20 de octubre de 2026

Las notas posteriores de «P031 pendiente» son históricas. Hay cuatro drafts nuevos,
36 entregas API en total: polling/SSE, GraphQL N+1, gRPC y elección de integración.
Ruta y manifest actualizados. Código en `packages/api-integration` del monorepo,
con carpetas en inglés e índices por post. No recrear ejemplos o ZIPs en el blog.

Ver [la revisión P031](api-integration-review.md) para pruebas, división y límites.
Verificados: 17 tests del laboratorio, cuatro estructurales, 46 editoriales,
trece suites locales, build y 19 tests del blog; ocho vistas Chromium y seis visores.
El inventario tiene 51 IDs exactos, 33 relacionados y 91 sin artículo identificado;
no certifica aceptación. El gap de renovación OAuth de P026 permanece explícito.

Siguiente paso editorial: revisar cobertura de las Series 04–06 contra cada ficha,
aprovechando los artículos de bases de datos y sistemas distribuidos ya escritos,
antes de crear duplicados. Después Deep Learning y Series 11–16. Mantener español,
drafts, posts específicos y pruebas de ejemplos en el monorepo separado. Sin traducción,
audio, publicación o push automáticos.

## Separación de ejemplos, 20 de octubre de 2026

Los ejemplos se han trasladado a `/home/luckys/Projects/Frontend/luisrc-blog-examples`,
con destino GitHub `luckys/luisrc-blog-examples`. Los 16 paquetes tienen carpetas
en inglés; `posts/<locale>/<id>/README.md` relaciona cada artículo con sus fuentes.
El blog ya no guarda `examples/` ni ZIPs. No recrear esas carpetas al continuar
P031. El código nuevo y sus tests deben ir al monorepo de ejemplos.

El commit `96424b4` conserva el estado anterior a esta migración, incluidos los
artículos P029/P030 que las notas históricas de abajo describían sin commit.
Esas notas y sus resultados ZIP documentan revisiones anteriores, no el flujo actual.
Consulta [el flujo vigente](../examples-repository.md): las verificaciones cruzadas
se ejecutan en el monorepo con `BLOG_ROOT`, y el blog compila independientemente.
El repositorio remoto aún debe crearse y subirse antes de que funcionen sus enlaces.

Objetivo activo del usuario: «Escribe en español todos los articulos que faltan por
series siguiendo el roadmap docs/roadmap-editorial-ingenieria-paysafe-ia.md , las buenas
practicas de escribir articulos, usa diagramas, graficos tanto estaticos como dinamicos
para que la informacion se entienda muy bien y este detallada».

Los últimos turnos han producido progreso verificable: diez borradores de ML clásico
y nueve de Computación, sistemas y redes, con laboratorios y recursos visuales.
La instrucción más reciente restringe la Serie 02 a estructuras de datos y algoritmos:
P011 se ha ampliado a 21 entregas, sin redactar P010 o P012–P019.
Después se continúa Serie 03 con P020–P029: contratos, validación, errores,
paginación, evolución, identidad, permisos y navegador, en veintitrés entregas.
P030 continúa con nueve entregas específicas: threat modeling, mass assignment,
SQL injection, dos sobre SSRF, concurrencia, token bucket, credenciales de clientes
y rotación de secretos. Treinta y dos entregas API en total. No es una auditoría
de infraestructura; el alcance del laboratorio es local.
No es una espera ni una declaración de finalización. Mantener el objetivo activo.

## Estado de trabajo

- Commit `ed7a5b3` guarda las tres entregas de permisos P028 y su laboratorio.
  Commit `09fe2e5` guarda las cuatro entregas de identidad P026/P027.
  Commit `cdea5a0` guarda la división editorial de P020–P025 en doce entregas,
  sobre `89f67b4` para P024/P025 y `fb190d4` para validación/errores.
  Las cuatro entregas nuevas de navegador P029 son posteriores y siguen sin commit.
  Las tres de inicio de P030, su laboratorio y visor son también posteriores, sin commit.
  También las dos entregas SSRF y su ampliación del laboratorio, posteriores, sin commit.
  También las dos de consumo/rate limiting y el visor de cuota, posteriores, sin commit.
  También las dos de credenciales/rotación y sus pruebas, posteriores, sin commit.
  Sin push solicitado.
- `roadmap-progress.md` y `.json`: generados desde las 175 fichas reales con
  `node scripts/audit-editorial-roadmap.mjs`. No alteran el alcance del objetivo.
- Hay 50 IDs exactos, 34 fichas con candidatos relacionados y 91 sin artículo
  identificado. No son contadores de aceptación. Los candidatos agrupados se han
  conservado, no renumerado para aparentar completitud.
- La ruta corta anterior para PS01–PS10 no sustituye las fichas generales. AWS,
  Terraform/Kubernetes, Kafka, OIDC y otros laboratorios siguen necesitando revisión.
- Entrega ML: `ml-series-review.md`, ruta-machine-learning.md y laboratorio en
  examples/machine-learning. CLI Docker sin red y --pull=never, imagen ya local.
- Entrega Computación: ruta-computacion-redes.md y laboratorio examples/computacion-redes.
  P001–P009 redactados; CPU/memoria, DNS/HTTP, TLS y navegador observados de verdad;
  los modelos de localidad/transporte se distinguen de mediciones de hardware o red.
- Entrega de algoritmos: ruta-estructuras-algoritmos.md, algorithms-series-review.md
  y examples/estructuras-algoritmos. 21 partes de P011, no 21 IDs del catálogo.
  28 tests de laboratorio, 18 extractos y 42 vistas móvil/escritorio verificadas.
- Inicio de APIs: ruta-diseno-apis-seguridad.md, api-contracts-series-review.md y
  examples/api-contratos. P020/P021 con OpenAPI 3.1.1, HTTP real y 11 tests.
  Continúa con P022/P023, examples/api-validacion-errores y revisión propia:
  13 tests Node y cuatro Python, JSON Schema/Ajv/Zod/Pydantic reales, errores por
  campo, stock/versión, dos peticiones concurrentes y proyección segura de logs.
  P024/P025 continúan en packages/api-pagination-evolution, diecinueve tests:
  PostgreSQL con un millón de filas, 56 planes SQL archivados, escrituras entre
  páginas, snapshots, dos lectores HTTP y schemas OpenAPI contrastados.
  Los tres primeros laboratorios no tienen autenticación o pagos; la base es efímera.
  La revisión solicitada divide P022 en tres, P023 en dos, P024 en tres y P025 en dos;
  junto a P020/P021 son doce entregas, no doce fichas. Se mantienen URLs y laboratorios.
  Pydantic es opcional. Ver api-series-split-review.md y la ruta actualizada.
- Identidad: P026/P027 se desarrollan en cuatro entregas con examples/api-identidad.
  Diez tests Node y flujo Chromium. OP oidc-provider real de test, Authorization
  Code/PKCE, firma RS256 con JWKS y variantes adversariales. RP HTTPS con sesión
  opaca y logout; modelo refresh separado con revocación familiar y replay.
  No afirmar que el RP tiene renovación OAuth integrada: ese enlace no se ha
  implementado. Sin contraseñas verificadas, MFA, permisos por objeto o M2M real.
  No dar el DoD de P026 por completo solo por la existencia de sus dos drafts.
  Ver api-identity-review.md. Este límite de P026 se conserva.
- Permisos: P028 se desarrolla en tres entregas con examples/api-permisos.
  Cinco tests de política y trece HTTP, fixtures de identidad públicas y memberships
  locales, casos de lectura y modificación de documentos de otro tenant, IDs
  repetidos, listas, roles/estado y verificación de título posterior. Sin SQL/RLS
  o autenticación de producción. Visor estático con la misma función probada.
  Ver api-authorization-review.md.
- Navegador: P029 se divide preventivamente en cuatro entregas específicas:
  DOM XSS, CSP, CSRF y SOP/CORS. packages/browser-security, siete tests HTTP y ocho
  Chromium. Sesión de fixture, loopback HTTP sin Secure; puertos no aíslan cookies.
  Sin integración OIDC/permisos, sin otros navegadores ni colector remoto CSP.
  Ver api-browser-review.md. P031 sigue sin entregas propias.
- Amenazas: P030 parcial en siete partes pequeñas, no un resumen de todo el temario.
  packages/api-threats, 39 tests HTTP/SQLite/SSRF/admisión y threat-model.json con responsables,
  controles y riesgos residuales. T01 fixture, T02 aislamiento, T03 mass assignment,
  T04 SQL injection. T05 SSRF demostrado solo en fixtures: HTTP real, dos destinos
  loopback y resolver programado. No servidor DNS, TLS, IPv6, proxy o firewall.
  Referencia por tenant, redirects rechazados y IP aprobada fijada al lookup del
  transporte. Harness impide salida externa incluso en variantes malas, no es una
  política egress desplegada. T06 añade cupos global/tenant, rechazo sin cola y token
  bucket por tenant verificado. Un proceso, sin réplicas/load test o límites económicos.
  T07 secretos/broken auth sigue abierto.
  Visor estático comparte parser; no consulta SQLite ni mide riesgo. Sin dependencias.
  Ver api-threats-review.md. Ningún recuento de IDs o tests cierra P030 por sí solo.
  Verificación final: 69 tests del blog y trece del ZIP extraído; build normal pasa.
  52 vistas completas y tres visores Chromium; repeticiones de las vistas afectadas
  por los últimos ajustes. Servidor temporal cerrado. Un fallo DNS del calendario
  externo fue transitorio y el reintento normal pasó, sin cambios en ese componente.
  Ejecutar tests SEO después del build, no contra dist mientras se está regenerando.
  Esta evidencia de 69/13 corresponde al avance anterior. La continuación SSRF y
  verificación actual están en api-ssrf-review.md; no suman ejecuciones repetidas.
  Segundo visor reproduce cinco trazas archivadas de peticiones reales; no abre
  sockets a los destinos representados desde el navegador ni mide latencia/riesgo.
  Verificación SSRF final: build, 70 tests raíz, 27 del ZIP extraído, 56 vistas de
  artículos y cuatro visores pasan; cuatro vistas afectadas y los visores repetidos
  tras cambios finales. Servidor temporal cerrado. Ver api-ssrf-review.md.
  Esa evidencia SSRF corresponde al avance anterior. Para el bloque de admisión
  consultar api-admission-review.md; no sumar repeticiones como pruebas nuevas.
  Verificación actual: build, 71 tests raíz, 39 del ZIP independiente, 60 vistas y
  cinco visores pasan. CLI con ambos tenants y modo inseguro rechazado verificada;
  servidor temporal cerrado. Quedan T07/broken auth/secretos y P031, no se completa P030.

## Actualización más reciente: credenciales y rotación

P030 tiene nueve partes y el laboratorio 58 tests: once nuevos de credenciales,
siete de cliente y uno de evidencia sobre los 39 previos. El modo opt-in verifica
claves de clientes con digest, caducidad, revocación y scopes, sin fallback a fixtures.
La recarga comprueba la candidata antes de cambiar; audit por allowlist sin secretos.
T07 demonstrated_in_fixture_only, no secret manager o autenticación de personas.
Dos drafts, dos diagramas y tabla de cinco etapas HTTP. Sin claves reales en assets.

Verificación de esta continuación: build y 72 tests raíz pasan. ZIP de 40 archivos
extraído independientemente: 58 tests y demo de rotación pasan. Chromium verifica
seis vistas de los tres posts afectados y los cinco visores, no vuelve a recorrer
todos los anteriores. Inspección de ambos diagramas móviles y tabla realizada.
Informe `/tmp/api-contracts-layout.L90fJV/report.json`. Servidor temporal detenido.
Los 32 drafts API siguen excluidos del HTML/Markdown/llms de producción.
Detalle, revisión de P030 y límites: [api-credentials-review.md](api-credentials-review.md).
Sin commit nuevo. Inventario conserva 50 IDs exactos/34 relacionados/91 no escritos,
no aceptación del objetivo global. El siguiente bloque es P031.

## Próxima acción concreta

1. Revalidar git, procesos y estado real después de cualquier interrupción.
2. Respetar el alcance nuevo: en Serie 02 **solo estructuras de datos y algoritmos**.
   P011 tiene 21 entregas, código, medición y recursos. No volver a proponer escribir
   Git ni P012–P019 como continuación automática. Esas fichas permanecen en el
   catálogo original, pero fuera del encargo actual de esta serie.
3. Leer cada ficha completa y fuentes primarias antes de escribir. Tests antes del
   código; medir ejemplos sin convertirlos en benchmarks universales. Un laboratorio
   compartido por serie es válido si identifica qué archivo y evidencia usa cada post.
   **Valorar siempre posts pequeños y específicos**: dividir al cambiar de problema,
   mecanismo o ejercicio autónomo; no separar las piezas necesarias para explicar
   una misma decisión. Detalle en api-browser-review.md. La revisión de P028 mantiene
   sus tres partes porque ya separan política, aislamiento y verificación.
4. Revisar el límite del laboratorio P026 (sesión y modelo refresh separados)
   antes de dar por aceptada su ficha. P030 ya tiene nueve entregas y T07 se
   demuestra en fixture, no se debe seguir exigiendo un secret manager cloud
   para un laboratorio local. Revisar su cobertura conjunta. Después P031 según
   ruta-diseno-apis-seguridad.md, contrastando los artículos agrupados previos.
   Después revisar series 04–06 y los límites
   declarados de las series 07–09. Continuar después P096–P175 por series.
5. Mantener español, draft, autor Luis Ramírez Calle; no traducciones, audio,
   publicación o nuevos commits/push sin el encargo aplicable.

Usar pnpm en instalaciones. No instalar Python con pip/conda implícitamente. Reutilizar
entornos locales; si falta GPU o un proveedor, avanzar lo verificable y declarar el
límite real, sin dar por cumplido un laboratorio que no se haya ejecutado.

La finalización exige auditoría ficha por ficha del temario, código, ejemplos, recursos,
pruebas, enlaces y renderizado. No marcar el objetivo completo basándose en este
inventario, en un build verde o en tener 175 ficheros.
