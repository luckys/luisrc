# Revisión de CI/CD y despliegues progresivos

## Recaptura previa al commit solicitado

El importador de AWS cambió el lockfile raíz; se repitió el exercise completo.
Captura 2026-10-25T11:38:47.394Z, proyecto luisrc-delivery-e00824f8: dieciocho
fases, veintiséis hashes y limpieza completada. Verify pasa; gráfica y exports
se actualizan. P062 también se recaptura, según su revisión. Las secciones
siguientes conservan la evidencia y los recuentos anteriores.

P063 se amplía en ocho drafts españoles de un concepto cada uno. Ver
[ruta](ruta-ci-cd-despliegues.md) y [manifiesto](progressive-delivery-series.json).
Autor Luis Ramírez Calle; catorce extractos ejecutables dentro de los posts,
fuentes completas solo en `luisrc-blog-examples/packages/progressive-delivery`.
OPS-DELIVERY conserva sus ejemplos y enlaza esta ampliación.

## Requisitos de la ficha y evidencia

| Requisito | Entrega / fuente | Observación y límite |
| --- | --- | --- |
| Build/test/security pipeline | P063; scripts/pipeline.mjs | Ocho etapas locales: siete tests, tipos, build, audit runtime, dos images y dos políticas. Sin CI remoto ni scan del SO |
| Artifact immutability | CD-ARTIFACTS; Dockerfile/variants/Compose | Release fijada dentro de image, IDs locales usados con pull_policy never, inspección efectiva por slot. Sin registry push o firma |
| Deploy/release y flags | CD-FLAGS; product/router/rollout | Flag off/on/off; misma image candidata al recuperar lecturas, revisión esperada por IPC, cabecera del cliente no impone decisión |
| Smoke tests | CD-SMOKE; gates.ts/smoke.mjs | Dos productos10000/99; flag on da100/1 pese a200. Validación de identidad/valor, no suite exhaustiva |
| Rolling | CD-ROLLING; exercise | Reemplazo a y luego b; HTTP demuestra v2/v1 y v2/v2 con flag off; images inspeccionadas. Sin prueba de continuidad bajo carga |
| Blue-green | CD-BLUEGREEN; router/exercise | Reinicia el experimento preparando blue v1; conserva ese grupo, conmuta a green v2 y vuelve. SQL compartido, grupos2/1, no stacks idénticos |
| Canary | CD-CANARY; rollout/exercise | 200peticiones HTTP reales, muestra sintética estratificada:20candidato/180control;20/0resultados malos, todos200; gate retira y smoke verifica |
| Revert y datos | CD-ROLLBACK; SQL/server/exercise | V1 lee fila de v2, cuatro filas conservadas y quinta escritura válida; esquema expandido permanece. Contract negativo42703 en transacción revertida |

El laboratorio despliega y revierte **containers locales reales**. El candidato
está construido como fixture defectuoso y no recibe una promoción real. La
activación completa tras retirar el canary queda marcada `negativeFixture` y
`bypassedSmokeGate`: prueba recuperación, no recomienda ignorar un gate.

## Captura final y controles reales

`evidence/delivery.json`, fecha `2026-10-25T10:58:04.348Z`, proyecto
`luisrc-delivery-16bc9095`: dieciocho fases observadas y veintiséis hashes de
source, scripts, tests, SQL, variants y entradas raíz de build. Router PID78054
creado/cerrado por el harness. Engine29.9.2, Compose5.6.1, Node24.19.0,
TypeScript5.9.2, pg8.23.1; PostgreSQL18 por digest ya probado en P062.

Las dos images comparten servidor y fijan release.json durante build. La diferencia
v1/v2 del fixture está en ese archivo, no en una supuesta revisión Git que no
existe. Cambiar la flag del router no modifica la image. Se compara el ID local
efectivo de cada slot, sin presentarlo como un manifest publicado de registry.

El pipeline prepara un artefacto pnpm deploy temporal y ejecuta audit --prod
--audit-level high --json. La respuesta archivada tiene advisories vacío y cero
hallazgos en todas sus categorías. No se ignoran errores de registry ni se usa
audit --fix. Se conserva el informe completo, sin convertir sus contadores de
resoluciones/optionalDependencies en una afirmación de paquetes instalados del SO.

La política de image comprueba user node/1000, la referencia base fijada que usa
este Dockerfile y high/critical cero. No es análisis general de Dockerfiles,
firma, attestation o escáner de sistema operativo. El fallo de una etapa detiene
el runner y registra el checkpoint fallido, sin marcarlo como paso exitoso.

El router tiene control privado IPC, destinos normalizados HTTP127.0.0.1 y
revisión esperada. Solo dirige GET; las escrituras de control del harness van a
los puertos loopback de API. Actualiza destinos tras recrear containers, porque
sus puertos aleatorios pueden cambiar. Rechaza revisiones atrasadas/destinos no
permitidos sin cambiar estado. No es un proxy o sistema de flags de producción.

## Datos, regresión y recuperación

Schema inicial: dos productos, name y price_cents. Expand añade display_name
nullable y hace backfill de esas dos filas; v1 escribe otra fila sin la columna
nueva y v2 la lee con fallback. No hay actualizaciones de productos que puedan
crear divergencia posterior entre ambas columnas.

El canary crea dos claves por bucket, cien buckets. Las200lecturas HTTP son
observadas; la selección de claves es sintética/estratificada, no población real.
Los20del candidato devuelven100en vez de10000; los180del control conservan10000.
Todos los status son200. Se guardan clave, bucket, slot, revisión, valor y fallo,
y se recalcula el gate desde esos datos.

El umbral1% y mínimo20son didácticos, sin justificación de significancia
estadística. Estado insuficiente y control enfermo son distintos de promoción.
Tras retirar el canary el smoke pasa contra blue. La prueba negativa forzada
demuestra fallo en ambos productos; apagar flag recupera valores con la misma image.

V2 escribe una cuarta fila con ambas columnas; después v1 vuelve y lee ese dato.
El ensayo de retirar name ocurre dentro de una transacción: consulta antigua
falla con42703 y se revierte. No se confunde rollback SQL de esa transacción con
deshacer una migración previamente confirmada. Se conservan cuatro filas iguales
y se admite una quinta de v1, con smoke correcto al final.

No se ha corrompido ni reparado precio persistido: la regresión afecta a la
respuesta. No hay efectos externos, backups restaurados, upgrades mayores,
backfill masivo o contract confirmado. Ambos grupos comparten SQL; blue-green
no duplica sus datos.

## Verificación y revisión editorial

- Red inicial de tests observada antes de implementar. Siete tests finales pasan:
  seis de contratos y uno con router/HTTP/IPC reales; typecheck strict pasa.
- Pipeline y exercise completo pasan. Se corrigió el nombre de script: pnpm12
  tiene un comando pipeline propio; el ejemplo usa `run ci:local`, sin cambiar
  la configuración del workspace para sortearlo.
- La primera secuencia encadenaba rolling y blue-green dejando ambos grupos en
  v2. Se corrigió antes de aceptar evidencia: blue se prepara en v1 y la captura
  demuestra v1 antes/v2 después. No se rebajó la comprobación a un cambio de ruta
  entre grupos con el mismo artefacto.
- Verify de dieciocho fases, fuentes, doscientos resultados, datos y limpieza pasa.
- Install frozen32proyectos,31laboratorios. Lock compartido+51líneas respecto a
  HEAD:35de P062 y16del importador P063, sin upgrades de dependencias existentes.
  Lock del blog sin cambios.
- 113 checks editoriales/estructurales, seis nuevos de esta serie. Verifican los
  catorce extractos, metadatos, dependencias, nueve SVG/dimensiones, hashes,
  evidencia, salidas canónicas e índices.
- Build50rutas/67HTML; Pagefind10páginas publicadas/4280palabras/dos idiomas.
  Diecinueve tests del blog pasan, con drafts fuera de índices públicos,
  metadatos, enlaces y assets verificables sin checkout hermano.
- 225 índices por post, 31 laboratorios y 74 exports estáticos canónicos. Inventario
  67IDs con draft/20relacionados/88sin artículo: no aceptación del objetivo completo.
- Chromium1194:18vistas nuevas en1440/360px. Dieciocho selecciones de fase por
  viewport; tres filtros y34páginas por viewport recorren las200respuestas sin
  inventar otra campaña de tráfico. Teclado prev/next/select/details/paginación,
  tres tablas con scroll, iframe, noindex, recursos y sin overflow global.
  Informe `/tmp/progressive-delivery-layout.Bnffvk/report.json`.
- Inspección visual de ocho diagramas y gráfica en móvil; tablas y visor en ambas anchuras.
  La etiqueta final aclara que eliminar name rompe v1; el estado distingue ruta
  principal y porcentaje hacia green. El visor solo pide assets de su carpeta,
  sin canal de control; sin errores JavaScript.

Los tiempos elapsedMs son observaciones del harness, no benchmarks de despliegue,
MTTR humano o garantía de continuidad. No hubo tráfico concurrente sostenido,
Kubernetes, load balancer distribuido, IAM, producción o CI remoto.

Se confirmó ausencia de router PID78054 y recursos Docker de los proyectos finales.
Servidor de QA140189 cerrado; puerto4322 sin listener. Ambos repositorios pasan
git diff --check. No se crearon commits de P062/P063 ni se ejecutó push.

## Actualización conservada de P062

El nuevo importador cambió un input del build de Docker. Se repitió su exercise,
sin eliminar la aserción del hash del lockfile. Captura
`2026-10-25T10:46:32.297Z`, `luisrc-containers-dc010859`, diez fases/quince hashes.
Runtime344.517.979bytes y build618.488.184bytes:328,6/589,8MiB. Gráfica y cifras
del artículo actualizadas; provenance sincronizada. Verify y checks pasan.

QA P062 posterior:14vistas1440/360, informe
`/tmp/container-environments-layout.79l0Ka/report.json`. Se inspeccionó de nuevo
la gráfica y su correspondencia con las cifras. Su revisión inicial queda como
evidencia histórica, con una sección explícita de actualización.

## Continuación

P062 y P063 permanecen sin commit en ambos repositorios. No se publican,
traducen o generan audios. Próximo P064: fundamentos cloud/AWS con conceptos
separados y comparación declarada de diseños Lambda/ECS. Leer ficha completa y
material existente antes de fijar la división. Después P065/P066, Deep Learning
y series11–16. Conservar gapsP026, Stripe sandboxP045, soak prolongadoP058 y alcance
de Serie02 solo estructuras/algoritmos. El objetivo completo sigue activo.
