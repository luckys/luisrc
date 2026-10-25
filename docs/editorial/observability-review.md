# Revisión: observabilidad, 23 de octubre de 2026

## Alcance y estado

Confirmada la entrega de rendimiento solicitada por el usuario: blog `a2ab1e7`,
ejemplos `319ed10`, sin push. Se revalidaron diez tests rápidos y nueve checks
cruzados antes del commit. Ambos repositorios quedaron limpios en ese punto.

Después se continúa el objetivo editorial activo con P059. Seis drafts españoles,
entre1129y1339 palabras contando metadata/código, no una ficha diferente por cada
archivo. Se conserva OPS-SIGNALS y su laboratorio original, añadiendo enlace a la
ampliación. La guía editorial motivó separar identidad, spans, transporte, sampling,
agregación y exemplars, con apertura por problema, decisiones y límites propios.

Esta continuación es progreso verificable, no finalización del roadmap completo.
Nuevos artículos/laboratorio pendientes de commit. Sin push, publicación, traducción
o generación de audio. El inventario sigue sin probar aceptación por IDs.

## Cobertura de P059 y evidencia que la sostiene

| Requisito | Implementación y comprobación |
| --- | --- |
| Structured logs e identidades | logging.ts: allowlist, IDs de fixture y correlación explícita. Tests de campos, contexto ausente/no sampled y entradas HTTP sensibles no archivadas. |
| Spans y traces | tracing.ts: SDK real, recurso, parent, eventos, status y finally. Tests de árbol y error; campaña con veinte spans exportados. |
| Propagation | W3CTraceContextPropagator por HTTP y metadata IPC. Tests de header válido/inválido/ceros y parent remoto. React usa Context explícito en cada frontera. |
| OpenTelemetry | API1.10.0, SDK/core/resources/context-async-hooks3.0.0. Tipos instalados y comportamiento ejecutado; no mezcla de imports de otras generaciones. |
| Metrics | SDK MeterProvider/Histogram/view/reader: segundos, buckets, count/sum y atributo result. Tests deterministas y cinco jobs observados. |
| Exemplars | Reservoir propio acotado y exposición OpenMetrics1.0. Tests de reemplazo, sampled, counts acumulativos y labels; cada muestra final resuelve a un span archivado. No soporte nativo atribuido al SDK. |
| Request IDs | API genera request/operation IDs y los transmite al worker. Dos eventos por job, diferente span ID. No equivalencia general request/operación. |
| React → worker asíncrono | Chromium pulsa cinco botones; API/worker son procesos diferentes, HTTP real + IPC. Script verifica todo el árbol, headers y resultados. |

## Laboratorio y campaña

Código solo en `luisrc-blog-examples/packages/observability-lab`, nombres de carpetas
en inglés. Snippets explicados dentro de cada post y README por artículo en el
monorepo. Node24.19.0, pnpm12.8.1, React19.2.0, TS5.9.2 y Playwright1.56.1.

La campaña final `evidence/browser.json`, medida2026-10-23T10:38:41.444Z, conserva
PIDs3443784/3443792, catorce hashes de fuentes antes/después y estos resultados:

- ok/fail: cinco spans cada uno, una traza; el segundo tiene ERROR en el consumidor,
  pero HTTP202 en la aceptación.
- broken: cinco spans en dos trazas sin relación, por perder carrier al publicar.
- link: cinco spans en dos trazas, consumidor root con link al productor.
- unsampled: cero spans, dos logs y una observación del histograma.
- Acumulado: veinte spans, diez logs, cuatro jobs ok y uno error. Dos exemplars
  finales resolubles a spans archivados. No sumar campañas de desarrollo anteriores.

20ms es espera artificial del job, no latencia de una dependencia ni benchmark.
Los snapshots son acumulados. La tabla del visor muestra buckets no acumulativos
del SDK; el serializador OpenMetrics acumula sus cuentas correctamente.

## Fuentes y revisión técnica

Consultadas fuentes primarias de W3C Trace Context, OpenTelemetry sobre propagación,
logs, spans, sampling, métricas y messaging, OpenMetrics1.0 y OWASP Logging.
La API exacta se contrastó con los tipos/código instalados de los SDKs3.0.0.
Enlaces oficiales y fecha constan en cada artículo. Algunos accesos de la herramienta
web a GitHub3.0.0 devolvieron cache miss; la comprobación de tipos se realizó contra
los paquetes realmente instalados, no se interpretó el cache miss como un404.

Revisados conceptos que podían inducir a error: trace ID no autoriza ni reemplaza
identidad de negocio; duración no es CPU; sumar spans anidados no da latencia total;
parent puede terminar antes de consumidor; link no es parent; UNSET no significa
span sin cerrar; sampling no es pérdida de toda identidad; tail no recupera spans
descartados; count no es rate; cardinalidad depende de valores/combinaciones;
exemplar no es p99 ni máximo; sampled no garantiza retención durable.

## Verificación ejecutada

- Nueve tests del laboratorio y typecheck estricto pasan. Diseño test-first: tests
  de contexto/spans antes de tracing/logging, tests de métricas antes del instrumento
  y tests HTTP antes del servidor. Primer fallo por instalación ausente se distinguió
  del fallo posterior por implementación todavía inexistente.
- Campaña Chromium real de cinco clics pasa; mismo origen y solo loopback.
- Once snippets JS/TS coinciden con fuentes ejecutadas; seis SVG de D2 y una gráfica
  derivada tienen dimensiones y alt verificados. Cuatro exports estáticos canónicos.
- Noventa y dos checks editoriales/estructurales del monorepo pasan, incluidos todos
  los anteriores. No se repitieron las integraciones Docker históricas.
- Build normal:50rutas,63HTML incluyendo el visor. Pagefind sigue indexando diez
  páginas publicadas/4280palabras. Diecinueve tests del blog pasan después del build,
  incluidos drafts fuera de HTML de artículos/Markdown/llms/sitemap de producción.
- pnpm install frozen/ignore-scripts pasa. Único lockfile del monorepo añade SDKs
  oficiales; Vitest conserva versión y resuelve su peer opcional nuevo de OTel.
  El pruning automático del lock del blog se revirtió con patch, sin otras ediciones.

## Revisión visual y accesibilidad

Chromium recorre seis posts a1440/360 y visor a1440/360:14vistas, selección de cinco
escenarios por viewport y apertura por teclado de los exemplars. Comprueba noindex,
recursos/enlaces, ausencia de overflow global, iframes, carga de diagramas y bloques
de código enfocables. Tablas y timeline tienen región horizontal con foco; el visor
usa texto, no solo color, y no abre conexiones al servicio representado.

Se inspeccionaron los seis diagramas móviles, gráfica, UI React y regiones del visor.
Se corrigieron singular/plural y orden de spans con timestamp igual. Se añadió tabla
de buckets para mostrar la distribución y no solo count. Informe visual final:
`/tmp/observability-layout.YiWBev/report.json`. Se inspeccionaron también la tabla
móvil final y el visor de escritorio. Servidor temporal PID3453303 cerrado;
sin procesos de API/worker del laboratorio al terminar.

## Límites que no se convierten en garantías

Sin broker durable, Outbox, DB, crash recovery, TLS/auth, cross-origin, ingestión
Prometheus, OTLP, Collector, Jaeger/Grafana, tail sampling o backend de consultas.
Datos en memoria e IDs secuenciales solo de fixture. Máximo100jobs/500spans browser;
receptor y /state solo loopback, no publicar ese servidor. Logs sin pipeline de
producción, timestamps/niveles/retención. No auditoría universal de datos sensibles.

El SDK metrics JS3.0.0 no exporta exemplars: reservoir y serializador explícitos,
máximo diez muestras, último sampled por bucket/resultado, sin selección uniforme,
TTL o conocimiento de retención. Pruebas del formato, no ingestión con Prometheus.
Frontend instrumentado manualmente para una acción, no telemetría general de React.
Misma máquina, sin prueba de relojes entre hosts, capacidad o experiencia real.

## Próximo bloque

P060: ampliar OPS-SLO/reliable-services con posts específicos sobre elegibilidad,
cohortes maduras, ventanas, presupuesto, burn rate y alertas multi-window. Distinguir
simulación de datos reales y ejecución de un sistema de alertas. Después P061 y
P062–P066 según fichas completas. Conservar gaps P026, Stripe sandboxP045 y soakP058.
