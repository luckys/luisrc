# Observabilidad: seguir una operación sin confundir señales

Seis drafts españoles amplían P059. Se conserva OPS-SIGNALS como introducción,
sin atribuirle instrumentación que no ejecutaba. Laboratorio completo en
`luisrc-blog-examples/packages/observability-lab`.

## Orden recomendado

1. [Logs e identidades](../../src/content/posts/es/logs-estructurados-identidades-correlacion.md): petición, intención y contexto.
2. [Spans](../../src/content/posts/es/opentelemetry-spans-contexto-ciclo-vida.md): fronteras, parent, eventos, status y cierre.
3. [React → API → worker](../../src/content/posts/es/propagacion-trazas-react-api-worker.md): HTTP, carrier W3C, IPC y otro proceso.
4. [Sampling](../../src/content/posts/es/sampling-trazas-parent-based-head-tail.md): ParentBased y límites de tail sampling.
5. [Métricas](../../src/content/posts/es/metricas-opentelemetry-histogramas-cardinalidad.md): unidades, atributos y agregación.
6. [Exemplars](../../src/content/posts/es/exemplars-openmetrics-histograma-traza.md): reservoir, OpenMetrics y enlace al span.

## Criterio de división

Identidad, delimitación, transporte, selección, agregación y correlación tienen
preguntas, pruebas y ejercicios propios. Exemplars tiene formato y límites de
soporte específicos: no queda escondido al final de un post extenso de métricas.
Extractos explicados dentro del artículo; código completo solo en GitHub.

## Evidencia y límites

SDK OTel3.0.0/API1.10.0, React19.2.0, Node24.19.0. Cinco clics de Chromium, dos PIDs.
Caso correcto5spans/1traza; carrier perdido5spans/2trazas sin relación; link2trazas
relacionadas; sin sampling0spans/2logs/1medición. Total4ok/1error,20spans,10logs.

Sin broker durable, OTLP, Collector o backend. El SDK JS de métricas no exporta
exemplars: reservoir/serializador propios, no función nativa atribuida al SDK.
OpenMetrics se valida por contrato, no ingestión Prometheus. Visor con datos
archivados, no telemetría de lectores. Ver observability-review.md.

## Continuación

P060: contrastar OPS-SLO/reliable-services; ampliar elegibilidad y madurez de cohortes,
ventanas, presupuesto y alertas multi-window con datos simulados identificados.
Después P061 incidentes/runbooks/postmortem y P062–P066. Mantener límites P026,
Stripe sandboxP045 y soak prolongadoP058. Español/draft; sin traducción, audio,
publicación, commit o push automáticos.
