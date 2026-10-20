# Continuación del objetivo editorial completo

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
