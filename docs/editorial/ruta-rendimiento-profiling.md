# Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas

Siete drafts españoles que amplían P058. Código solo en
luisrc-blog-examples/packages/performance-lab, snippets dentro de cada post.
Se conserva OPS-LOAD como introducción con su medición original; el nuevo fixture
separa procesos y añade k6, microbenchmarks y perfiles reales.

## Orden recomendado

1. [Latencia, percentiles e histogramas](../../src/content/posts/es/latencia-percentiles-histogramas-errores.md): frontera, resultado, muestra y agregación.
2. [Open-loop y closed-loop](../../src/content/posts/es/k6-modelos-carga-open-closed-loop.md): VUs, tasa y dropped iterations.
3. [Saturación y recuperación](../../src/content/posts/es/saturacion-stress-testing-admision-recuperacion.md): admisión, trabajo útil, stress y thresholds.
4. [Carga sostenida y soak](../../src/content/posts/es/soak-testing-carga-sostenida-ventanas.md): ventanas, muestras parciales y límites de 60 segundos.
5. [Microbenchmarks](../../src/content/posts/es/microbenchmarks-warmup-reproducibilidad-typescript.md): mismo contrato, dataset, warm-up, orden y repeticiones.
6. [CPU profiling](../../src/content/posts/es/cpu-profiling-nodejs-muestras-cuello-botella.md): pared/CPU, muestreo y diagnóstico de atribución opaca.
7. [Memory profiling](../../src/content/posts/es/memory-profiling-heap-snapshots-retencion-cache.md): referencias, snapshots, recuentos y límites de shallow size.

## Criterio de división

Distribución, calendario de llegadas, límite de admisión y evolución temporal
responden preguntas distintas. Warm-up se explica con el protocolo del benchmark;
CPU y memoria tienen artefactos y riesgos propios. Siete artículos de unas
1200–1360 palabras con código/metadata, no siete fichas nuevas del roadmap.

## Evidencia y fronteras

Node24.19.0/TS5.9.2, k6 2.3.0 oficial instalado mediante comando pnpm con SHA-256.
Siete fases HTTP, incluido un generador insuficiente y una fase de 60 segundos.
Tres procesos de microbenchmark, tres CPU profiles y seis heap snapshots reales.
Diez tests rápidos y verificación de fuentes/resultados sin regenerar timings.
Dos gráficas y un visor usan los resultados archivados, no generan tráfico.

Una máquina compartida, sin cloud/SQL/TLS o capacidad de producción certificada.
No soak de horas. No retained size o árbol de dominadores. Perfil CPU diagnóstico
sin inlining separado del normal y del benchmark. Heaps completos locales e
ignorados por Git; datos ficticios. Ver performance-review.md para verificación.

## Continuación

P059/P060: contrastar observabilidad-logs-metricas-trazas-workers,
sli-slo-error-budget-servicios y reliable-services antes de crear duplicados.
Revisar especialmente OpenTelemetry/propagación real, métricas agregables,
exemplars y recorrido frontend/worker, en lugar de atribuirlos a logs manuales.
Después operaciones/CI/CD según fichas reales. Conservar gaps P026, Stripe sandbox
P045 y soak prolongado P058. Español/draft; sin traducción, audio, publicación,
commit o push automáticos.
