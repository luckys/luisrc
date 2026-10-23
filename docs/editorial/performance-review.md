# Revisión: carga, benchmarks y profiling

22 de octubre de 2026. Serie anterior confirmada: blog 74b3eef, ejemplos c778ec9,
sin push. Esta entrega nueva queda en draft y pendiente de commit en ambos repos.

## Criterio editorial

Siete artículos españoles, autor Luis Ramírez Calle, 1203–1359 palabras incluyendo
metadata/código. Cada uno separa pregunta, mecanismo y ejercicio. La guía de
escritura motivó dividir distribuciones, calendario de llegadas, admisión y duración;
benchmark, CPU y heap tienen artefactos y limitaciones propios. La guía flow motivó
contrastar cada afirmación con la frontera ejecutada, sin convertir un test verde
o un artículo existente en aceptación de toda la ficha.

OPS-LOAD y reliable-services se revisaron antes de ampliar. Se conserva su prueba
en un proceso, sus números y su ID. Nuevo enlace a P058, no reescritura histórica.
No relación comercial con Paysafe en los artículos. Sin inglés/audio/publicación.

## Herramientas y desarrollo

Laboratorio solo en luisrc-blog-examples/packages/performance-lab. Node24.19.0,
TS5.9.2 estricto en src; glue/tests MJS por ejecución. Un importador pnpm nuevo,
sin actualizar versiones npm o allowBuilds. Instalación frozen/ignore-scripts y
política de supply-chain pasan. pnpm en toda instalación.

k6 no estaba instalado ni en imágenes locales. pnpm tools:install descarga el
tar.gz oficial Linux x64 de GitHub, comprueba SHA-256 fijado y extrae solo el
miembro conocido a .tools/, ignorado. No paquete npm de terceros o instalación
global. CLI observado: k6v2.3.0, commit e088784614, linux/amd64. SHA del tar:
39c3117b6af817592dcd0ce4242105c0a7af10948c2a425306f0be8f7a8a8ab1.

Tests de estadísticas/workload/cache escritos antes de los módulos: rojo por
import ausente y cinco pasan tras implementar. No se atribuye un ciclo red-green
de negocio observado a cada comportamiento posterior. Ampliación final: diez.

Las campañas capturan hashes antes/después y fallan si cambian sus fuentes.
La campaña HTTP se repitió tras añadir esa instrumentación; solo la última
consta como evidencia final. No sumar ejecuciones repetidas como muestras nuevas.

## Mediciones HTTP finales

Servidor Node hijo en127.0.0.1 con puerto efímero; k6 en otro proceso. Misma máquina,
sin aislamiento CPU. Entorno mínimo de hijos, sin credenciales/proxy heredados,
usage report y auto-extension resolution desactivados. Solo fixture propio,
una petición/iteración, sin redirects, timeout2s; rate≤400, VUs≤100, fase≤60s.
Cierre explícito, timeout mata solo el hijo creado. Sin contenedores nuevos.

Diez solicitudes warm-up excluidas de muestras. Ocho operaciones admitidas,
espera sintética40ms, sin cola o pool SQL real. maxActiveObserved es acumulado.

- Closed4:492/492 éxitos; open100:500/500.
- Open350A:958/1751 éxitos,793 rechazos;B:953/1751,798 rechazos. Sin descartes.
  Trabajo útil190,21 y189,06/s; CPU equivalente a4,6 % y5,7 % de un núcleo.
- Recovery25:101/101, sin errores o descartes.
- Generador100/s con1VU:61 éxitos,240 dropped_iterations, sin errores HTTP.
- Sostenida25/s,60s:1501 éxitos, cero errores o descartes. No soak prolongado.

Throughput usa testRunDurationMs de k6; wallSeconds incluye arranque/cierre de su
proceso. Latencia es http_req_duration, no journey completo. Distribuciones propias
nearest-rank separadas de las métricas k6. Thresholds fallan con99 en stress y
falta de VUs; wrapper comprueba la causa observable, no acepta cualquier error.

Ventanas basadas en timestamps de finalización: cinco completas y última parcial.
No registro exacto de llegadas, buckets vacíos ni memoria del servidor por ventana.
No se presentan las ventanas como seis réplicas independientes o soak de horas.

## Benchmark y perfiles

Dataset determinista5000/1000; checksum ponderado, no conversión financiera real.
Map construido dentro de llamada, dataset fuera en ambas variantes. Tres warm-ups,
siete muestras/variante alternando orden, tres procesos nuevos.42 muestras medidas,
21 por variante. Medianas por proceso publicadas:5,639/0,119;4,551/0,078;
4,620/0,071ms. Sin intervalos de confianza, profiler o control de CPU en el benchmark.
Resultado y semántica de duplicados/tasa ausente comprobados con oráculos explícitos.

CPU profiler real Session local,1000μs,100 trabajos separados por setImmediate.
Normal lento717,1ms pared/725,0ms CPU,673 muestras; indexado16,8/17,5ms,16 muestras.
Atribución lenta principalmente anónima; no se inventa una línea culpable.
Diagnóstico separado no-turbo-inlining muestra findRateSlow. Cambia optimización;
no se mezclan sus timings con el benchmark o el perfil normal. Pesos por timeDeltas
aproximan self y no son CPU exacta; sesión y cronómetro tienen fronteras distintas.
Tres cpuprofile completos en Git con hashes. No puerto inspector de red.

Seis snapshots V8 reales en procesos ficticios con entorno mínimo/GC forzado.
Recuentos RetainedEntry:500/1500/0 sin límite,100/100/0 con límite. Camino fuerte
desde LabCache→items→Array→[0]→RetainedEntry. No dominadores/retained size; self_size
no suma payload. RSS/heap pueden reflejar también captura y análisis previos.
Heaps completos en .artifacts/ ignorados, regenerables; solo resúmenes/hashes en Git.
No capturas de producción, datos de personas o promesa de ausencia de fugas global.

## Verificación editorial y de sitio

Diez tests rápidos y verify pasan con datos finales. Verify no regenera timings:
recalcula distribuciones, ventanas, mediana, checksum, hashes y resúmenes.
87 checks cruzados/estructurales: cinco nuevos de metadatos/orden,14 extractos,
siete D2+dos SVG, datos/perfiles/cifras y visor canónico.193 índices,26 paquetes,
53 exports estáticos. Enlaces GitHub contrastados con checkout local, sin verificar
disponibilidad del remoto o publicar nada en él.

Build:50 rutas,62 HTML contando el visor nuevo,10 páginas indexadas,4280 palabras
Pagefind. Diecinueve tests del blog pasan después del build; drafts excluidos.
El test de assets falló inicialmente al incluir ?stage en el nombre del archivo;
se corrigió el reconocimiento del pathname manteniendo comprobación de existencia.
Un extracto de array terminaba en coma sin contexto; se retiró esa coma del snippet.

Chromium16 vistas: siete posts a1440/360 y visor a ambas anchuras.14 selecciones
de escenarios, checks de counts, dropped, última ventana parcial, teclado,
iframe cargado, recursos200, foco/tablas/código y sin overflow de documento.
Siete diagramas, dos gráficas, tres tablas móviles y visor inspeccionados:
/tmp/performance-layout.UWIYeG/report.json. No nueva descarga de navegador.

Servidor temporalPID3280870 cerrado;4322 sin listener. Se retira únicamente
pruning automático del lockfile del blog; monorepo conserva importador nuevo.
git diff --check pasa en ambos. Sin traducción, audio, commit, push o publicación.

## Continuidad y aceptación

Inventario62 IDs exactos/25 relacionados/88 sin artículo no certifica aceptación.
P058 tiene siete entregas específicas y medidas locales, pero no soak de horas,
profiling de una transacción HTTP/SQL completa o capacidad de producción.
P059/P060: contrastar OPS-SIGNALS/OPS-SLO y reliable-services antes de ampliar
OpenTelemetry, propagación real, agregación/exemplars y recorrido frontend/worker.
Mantener gaps P026 y Stripe sandbox P045. Nuevos artículos/lab sin commit.
