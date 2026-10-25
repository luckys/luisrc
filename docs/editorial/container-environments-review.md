# Revisión de Docker y entornos reproducibles

## Actualización al completar el bloque Kubernetes

Captura renovada2026-10-25T13:03:35.536Z, luisrc-containers-a044e370; build618485156bytes/runtime344518059bytes. Diez fases y quince hashes. Se regeneran gráfica/replay y cifras del post.

La política pnpm compartida deniega explícitamente Scarf y optimizaciones SSH
opcionales sin desactivar los controles de scripts. P062/P063 se recapturaron
porque esa política es entrada de sus builds; no se eliminó el control de hashes.
Las secciones siguientes conservan la revisión anterior.

## Recaptura previa al commit solicitado

Al incorporar el importador de AWS se repitió exercise completo por el nuevo
lockfile raíz. Captura 2026-10-25T11:39:04.758Z, proyecto
luisrc-containers-e88d1435: diez fases, quince hashes y limpieza completada.
Build618488773bytes/runtime344517995bytes (589,8/328,6MiB). Verify pasa;
gráfica, cifras del artículo y exports se actualizan para esta captura.
Las secciones siguientes describen las revisiones anteriores.

P062 se divide en seis drafts españoles para separar decisiones. Ver
[ruta de lectura](ruta-docker-entornos.md) y
[manifiesto](container-environments-series.json). Autor: Luis Ramírez Calle.
No hay publicación, traducción, audio, commit o push de este bloque.

## Contraste con la ficha del roadmap

| Requisito | Artículo / fuente | Evidencia y alcance |
| --- | --- | --- |
| Images y containers | P062; Dockerfile; exercise | Image ID igual y container ID diferente tras recrear API; lectura conserva nota |
| Layers, Dockerfile y contexto | DOCKER-LAYERS; Dockerfile.dockerignore | Build real; cambio de comentario en contexto temporal deja pnpm install CACHED |
| Multi-stage | DOCKER-STAGES; Dockerfile; tsconfig | tsc y pnpm deploy --prod; runtime ejecuta dist, no resuelve TypeScript |
| Network y Compose | DOCKER-COMPOSE; compose.yaml | API/Redis/PostgreSQL reales; DNS por servicio; datos sin puertos publicados; backend interna |
| Healthchecks y caídas | DOCKER-COMPOSE; server.ts | Redis detenido: lectura SQL y ready200; PostgreSQL detenido: live200, ready503, miss503 |
| Volumes e init | DOCKER-VOLUMES; SQL; exercise | down/up conserva una nota; down --volumes/up da cero filas y lectura404; creación posterior válida |
| Image security | DOCKER-SECURITY; Dockerfile/Compose | UID1000, escritura /app rechazada EROFS, restricciones de API inspeccionadas; scan/firma pendientes |
| Setup limpio | P062/DOCKER-VOLUMES; evidence/compose.json | Dos inicializaciones vacías de datos, no builder sin cache ni equivalencia byte por byte |
| Recursos visuales | Seis D2, image-sizes.svg y explorer | Recuentos/tamaños archivados; fases seleccionables, gráfico dinámico y teclado, sin canal de control |

## Laboratorio y procedencia

Fuentes solo en `luisrc-blog-examples/packages/container-environments`. Diez
extractos Dockerfile/YAML/TypeScript/JavaScript/SQL de los posts coinciden con las
fuentes probadas. Los comandos de instalación utilizan pnpm y un lockfile raíz.

Captura inicial `2026-10-25T10:07:49.317Z`, proyecto
`luisrc-containers-2f953b0d`, diez fases `observed` y quince hashes. Incluyen
Dockerfile, allowlist, Compose, SQL, source, tests, scripts y entradas raíz del
build. Engine29.9.2/Compose5.6.1, Node24.19.0, PostgreSQL18.4, Redis8.8.1,
Linux amd64. Clientes pg8.23.1 y @redis/client6.3.0, TypeScript5.9.2.

El harness verifica espacio de nombres vacío antes de marcar propiedad del
proyecto. La limpieza de finally solo actúa después de esa comprobación. No usa
prune, nombres globales de containers ni volúmenes externos. Tras la captura se
confirmó ausencia de containers, volúmenes y redes con la etiqueta del proyecto.
Conserva images locales de runtime y build, identificadas en la fase cleanup.

`checkpoint.json` y salidas de BuildKit quedan en `.artifacts/`, ignorado por Git.
El checkpoint no es una captura final ni promete fsync/escritura atómica. Si un
recorrido falla, no sobrescribe el archivo final anterior: hay que mirar su fecha
y el checkpoint. El script comprueba invariantes antes de guardar evidencia final.

`verify` compara fuentes y archivo; no inicia Docker. `exercise` repite la
integración real. La modificación de source del experimento de cache se hace en
una copia temporal con la misma allowlist, eliminada al terminar. No se alteró el
checkout para obtener el resultado.

## Tamaños y gráfica

`docker image inspect` informa build618.605.033 bytes y runtime344.513.944 bytes:
589,9MiB y328,6MiB. Comparación local con escala común; el stage build contiene el
comentario del experimento. No es tamaño comprimido de descarga, espacio exclusivo,
memoria del proceso o benchmark. `render-results.mjs` deriva la SVG de la captura.

`explorer.html/mjs` solo cargan replay.json y el SVG. No conectan al daemon,
ejecutan comandos o cambian servicios. Muestran diez fases y recuentos SQL sin
heredar valores ausentes: «No capturado». El segundo setup distingue cero filas
iniciales de una final. Tablas con regiones nombradas y scroll mediante teclado.

## Verificación ejecutada

- `pnpm install --frozen-lockfile --ignore-scripts`: pasa en31proyectos, treinta
  laboratorios más raíz. Lock compartido añade35líneas, sin upgrade de paquetes
  anteriores ni desactivación de políticas. No cambió el lockfile del blog.
- Cinco tests del laboratorio y typecheck pasan. Fase red inicial observada antes
  de crear notes.ts; el primer build detectó uso de API Redis antigua y se corrigió
  para withAbortSignal del cliente6.3, manteniendo límites y tipos strict.
- Build multi-stage real y exercise completo pasan con pnpm deploy actual, sin
  --legacy. La última repetición refuerza la propiedad de recursos antes de limpiar.
- Verify de hashes, diez eventos, HTTP, cache, filas y limpieza pasa.
- 107 comprobaciones editoriales/estructurales pasan, incluidas cinco nuevas de
  esta serie, snippets, fuentes canónicas, tamaños SVG, evidencia e índices.
- Build del blog pasa: 50 rutas y 66 HTML. Pagefind conserva 10 páginas publicadas,
  4280palabras y dos idiomas. Diecinueve tests del blog pasan, incluidos aislamiento
  de drafts, metadatos, enlaces y hashes de assets.
- 217 índices por post, 30 laboratorios y 70 exports estáticos canónicos. Sin servidores,
  clientes de DB o credenciales añadidos al directorio público del blog.
- Auditor66IDs con draft,21relacionados y88sin artículo identificado; es inventario,
  no aceptación global del roadmap.
- Chromium1194:14vistas, seis posts y visor en1440/360px; veinte selecciones de
  fase, estados exactos, prev/next/select/details con teclado, tablas, iframe,
  noindex, recursos y ausencia de overflow global. Informe final:
  `/tmp/container-environments-layout.qsNt8p/report.json`.
- Inspección visual: seis diagramas, gráfica, visor y tablas. Se corrigieron un
  enlace largo que sobresalía, labels de red superpuestas y tamaño excesivo del
  gráfico dinámico en escritorio. Scroll de tablas probado y restablecido antes
  de la captura final; sin errores JavaScript ni peticiones del visor fuera de
  sus assets estáticos.

Servidor de QA4024479 cerrado al terminar; puerto4322 comprobado sin listener.
No quedan servicios Docker del proyecto final. Ambos repositorios pasan
`git diff --check`; los cambios de P062 permanecen sin commit.

## Límites conservados y mantenimiento

Datos ficticios e inmutables, cache prescindible y TTL60s. No hay actualización de
notas/invalidation, capacidad probada sin Redis, TLS, autorización, credenciales
privadas o permisos SQL mínimos. El usuario lab de PostgreSQL es amplio; el
endurecimiento de la API no describe por inferencia el de PostgreSQL/Redis.

No scan, firma, SBOM auditada, backup restore, corte de energía, corrupción,
upgrade mayor, HA, multi-arch, benchmark aislado, build bit reproducible o registry
push. Memoria/CPU/PIDs están configurados; no se provocó OOM/throttling. Detener
dependencias no simula todos los fallos posibles de red.

La evidencia incluye los hashes del lockfile y configuración raíz que entraron
en el build. Si esos inputs cambian al añadir futuros laboratorios, **repetir el
exercise**; no borrar ese control para conservar un check verde. Después regenerar
SVG, sincronizar exports con BLOG_ROOT, contrastar medidas escritas y actualizar
captura/revisión. Cambiar contenido de los posts o CSS del visor no requiere por
sí mismo volver a ejecutar Docker; sí verificar la presentación y provenance.

Siguiente P063: pipeline, artefactos identificables, deploy/release, estrategias
progresivas, feature flags, smoke tests y rollback compatible con esquema. Leer
OPS-DELIVERY y DB-MIGRATIONS antes de diseñar su laboratorio. Mantener pendientes
P026, Stripe sandboxP045 y soak prolongadoP058. El objetivo editorial sigue activo.

## Actualización al incorporar P063

El nuevo importador cambió el lockfile raíz. Se repitió exercise completo y verify;
no se retiró el control de hashes. Captura actual `2026-10-25T10:46:32.297Z`, proyecto
`luisrc-containers-dc010859`, mismas diez fases y quince hashes. Runtime344.517.979bytes
y build618.488.184bytes (328,6MiB/589,8MiB).
Se regeneraron gráfica y replay, se actualizaron cifras en el post y se verificó
provenance. Los recuentos y el QA inicial de arriba son evidencia histórica;
la revisión de progressive-delivery recoge los checks y las vistas posteriores.
