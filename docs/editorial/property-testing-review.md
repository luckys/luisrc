# Revisión: pruebas basadas en propiedades

22 de octubre de 2026. Serie anterior confirmada: blog c0a1b48, ejemplos d7c9f26,
sin push. Se reutiliza evidencia P056 ya validada; no se repite su Docker/Pact.
La nueva serie está en draft y pendiente de commit en ambos repositorios.

## División y criterio editorial

Siete preguntas específicas, 1139–1267 palabras por archivo incluyendo código y
metadatos. Autor Luis Ramírez Calle, solo español. Propiedades/generadores,
shrinking/replay, modelo, carreras, fuzzing, fallos y mutaciones. Cada post tiene
ejercicio, snippets, diagrama, decisiones, límites y referencias primarias.

La guía de escritura motivó abrir con problemas concretos y separar conceptos
con ejercicios propios; shrinking/replay se mantienen juntos para conservar el
recorrido desde fallo hasta regresión. La guía flow motivó contrastar afirmaciones
con el fixture observado y declarar fronteras que no se han ejecutado.

Se contrastaron OPS-FAULTS y el generador LCG de reliable-services, y el resumen
de mutation testing en TEST-COVERAGE. No se atribuye shrinking al LCG anterior.
OPS-FAULTS conserva código/ID y añade un enlace a esta serie. La nueva entrega
de mutaciones evalúa propiedades, no recrea una introducción de coverage.

## Código y desarrollo observado

Laboratorio solo en luisrc-blog-examples/packages/property-testing, carpetas en
inglés e índices por post. Node24.19.0, TS5.9.2 estricto en src; tests/glue MJS
validados por ejecución. fast-check4.10.2 fijado, pure-rand8.4.2 en lockfile.
pnpm en instalaciones, ignore-scripts y reinstalación frozen-lockfile pasan;
política de supply-chain activa. Solo dos paquetes nuevos, sin actualizar los
anteriores ni cambiar allowBuilds.

Los tests iniciales de propiedades se escribieron antes de money/Payment. Primer
rojo fue dependencia ausente; tras instalar, rojo por módulo money ausente, no
fallo de negocio. Los cinco pasan tras implementar. No se presenta ese ciclo
como un red-green individual observado para cada escenario posterior.

En la ampliación apareció un error real del oráculo: deepStrictEqual comparaba
prototipo del record generado con el objeto devuelto al leer JSON. Seed5705 lo
redujo a payment-0/amount1 con prototipo nulo. Se comparan campos explícitos,
porque JSON no transporta prototipos; no se debilita validación del parser.

Fuentes primarias consultadas: fast-check arbitraries/properties/parameters,
modelos/replay, scheduler y fuzzing; Node event loop/TextDecoder/assert; Stryker
estados/métricas; AWS Builders' Library sobre intentos idempotentes. APIs y tipos
contrastados con paquete instalado y ejecución. No benchmarks universales.

## Evidencia reproducible

Quince tests, repetidos con fuentes finales y archivados con hashes en
packages/property-testing/evidence/verification.json. No sumar repeticiones.

- Reparto: 500 casos seed5701, conservación, longitud, enteros y equilibrio;
  ejemplo5/2 y entradas inválidas explícitas.
- Máquina corregida: 500 secuencias seed5702, hasta40 eventos. Modelo con tabla
  independiente; estado y capturas después de cada evento. No fc.commands.
- Variante late-decline: falla en sexta ejecución, cuatro reducciones,
  seed5702/path5:3:6:7:6; submit/confirm/decline. Replay repite entrada y regresión
  escrita a mano pasa en fix/falla en variante.
- Duplicate-capture: submit/confirm/confirm. Terminal estable deja sobrevivir
  esta variante; comparación del contador la detecta. Caso explícito llega a2.
- Scheduler: búsqueda seed5703 y replay fallan por aserción; regresión fija
  read/read/write/write da1, fix local da2. Cien schedulers pasan contra el fix.
- Parser: 1000 arrays de hasta300 bytes,300 objetos válidos y casos explícitos
  UTF-8 inválido, JSON/formas/importe y límite257. Parser máximo256 bytes.
- Recovery:500 secuencias de hasta12 fallos, nuevo objeto servicio por intento,
  mismo journal/fake. Intento final sin fallo exige confirmación y un efecto.
- Clave inestable: seed5702 reduce a after-effect antes del intento final.
  Tres variantes elegidas a mano detectadas por AssertionError, sin motor automático.

## Garantías que no se atribuyen

Una operación en memoria, sin autorizaciones parciales, divisas múltiples,
refunds o ledger. Contador de máquina y Set del proveedor son modelos separados.
El fake garantiza idempotencia por su Set, sin caducidad o parámetros diferentes.
Reinstanciar servicio no es reiniciar proceso: no hay SIGKILL, SQL, disco durable,
HTTP, proveedor externo, consulta de reconciliación, paralelismo o exactly-once.

Fuzzing finito no guiado por cobertura, sin campaña indefinida/DoS. Buffer ya
recibido al comprobar tamaño; JSON.parse conserva última clave duplicada.
Scheduler controla solo promesas envueltas. Arreglo local no es atomicidad SQL.
Tres mutaciones seleccionadas no son campaña Stryker o score global. Una seed
fija no explora entradas nuevas; replay depende de versión/generador/predicado.

## Verificación editorial y renderizado

82 checks cruzados/estructurales pasan. Cuatro nuevos: drafts/orden/prerrequisitos,
catorce extractos en fuentes ejecutadas, siete diagramas D2/SVG con dimensiones
reales/alt, evidencia/hashes y resultados acotados. 186 índices,25 paquetes,
48 exports estáticos conservados. Enlaces GitHub comprobados contra checkout
local, no disponibilidad del repositorio remoto todavía pendiente de creación/push.

Build final pasa:50 rutas,61 HTML,10 páginas publicadas,4280 palabras Pagefind.
Diecinueve tests del blog pasan después del build; drafts excluidos de HTML,
Markdown/llms/sitemap. Inventario61 exactos/26 relacionados/88 sin artículo:
no aceptación de las175 fichas ni de toda Serie06.

Chromium: siete posts a1440/360,14 vistas. H1/noindex, recursos cargados, enlaces
locales200, sin overflow de página, foco/código y scroll de tabla con teclado.
Siete diagramas móviles inspeccionados, legibles. Primera tabla partía etiquetas
en demasiadas líneas; se añadió mínimo48rem dentro del scroller, sin ensanchar
la página. Recorrido repetido e imagen de tabla final revisada:
/tmp/property-testing-layout.FD5dfr/report.json. No nueva descarga de navegador.

Servidor temporalPID3178077 cerrado y4322 sin listener. Se retira únicamente
pruning automático del lockfile del blog; monorepo mantiene dependencias nuevas.
git diff --check pasa en ambos repositorios. No publicación, audio, traducción,
push, servicios persistentes o contenedores nuevos.

## Continuidad

P058: contrastar pruebas-carga-percentiles-saturacion y reliable-services antes de
ampliar carga/profile. Preferir posts por pregunta con medición real y límites,
no presentar un modelo de cola como benchmark. Después P059/P060 observabilidad.
Gaps P026 y Stripe sandbox P045 se conservan. Nuevos artículos/lab sin commit.
