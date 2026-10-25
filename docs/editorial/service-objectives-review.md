# Revisión de SLI, SLO y presupuesto, 24 de octubre de 2026

## Alcance y estado

Seis drafts españoles amplían P060, de 1142 a 1266 palabras contando metadata y
código. Preguntas separadas siguiendo la guía editorial: clasificación del endpoint,
madurez asíncrona, ventanas/cobertura, presupuesto/política, burn rate y alertas.
Cada entrega tiene apertura por problema, decisiones, extractos, ejercicio y límites.
OPS-SLO conserva su ejemplo y laboratorio, con enlace a la ampliación.

Código completo solo en `luisrc-blog-examples/packages/service-objectives`.
Los snippets permanecen dentro del post y apuntan a README por artículo en GitHub.
No se cambió a propósito el contenido de la serie de observabilidad pendiente.
Ambas series siguen SIN COMMIT. Últimos commits: blog a2ab1e7, ejemplos319ed10.
Sin push, traducción, audio o publicación. Progreso verificable, no objetivo completo.

## Requisitos de P060 y evidencia

| Requisito | Evidencia y frontera |
| --- | --- |
| Availability y error rates | sli.ts/fixtures.ts: seis eventos elegibles, tres disponibles; incluye timeout,503,200inválido y404esperado. Oráculos de fixture, no recopilación real. |
| Latency | Resultado correcto Y duración≤300ms: dos de seis. Tests de300/301, no sustituye p95 o medición end-to-end. |
| SLI/SLO/SLA | Distinción en P060; spec/objectives.json fija ruta, frontera, elegibilidad, criterio, target y ventana. Formato propio, no OpenSLO o contrato comercial. |
| Error budget | budget.ts:1millón/99.9%→1000permitidos;1200malos→−200restantes/120%consumo. PPM, fracciones y ausencia de datos probadas. Política sin enforcement. |
| Burn rate | Fórmula probada,0eventos→null;1%/0.1%=10×. Thresholds14.4/13.44 para30/28d. Proyección de800eventos restantes a100malos/h→8h bajo supuestos. |
| Actionable alerts | Tres pares de ventanas, AND interno y prioridad page. Cobertura/volumen/ratio separados; owner y runbook ficticios. Sin notificación entregada o guardia real. |
| Laboratorio: SLO de endpoint y consumo simulado | Documento del endpoint ficticio y siete escenarios deterministas de treinta días. Fuentes, hashes, resultados y bundle browser verificables; no se atribuye tráfico real. |

## Laboratorio y resultados

Node24.19.0/pnpm12.8.1, TypeScript5.9.2 y esbuild0.25.10 ya disponibles. Instalación
offline con pnpm, sin paquetes nuevos descargados ni dependencias runtime.
Un solo lockfile; añade importador service-objectives sobre los cambios previos de
observabilidad, sin cambiar versiones de los otros paquetes en esta continuación.

Doce tests: endpoint, límites/duplicados, cohortes/deadline, presupuesto/fracciones,
burn/proyección, ventanas, cobertura, ponderación, alertas y contrato. Expectativas
iniciales escritas antes de las fuentes; fase roja por módulos aún inexistentes,
después implementación y regresiones concretas adicionales.

`evidence/simulation.json`:simulation=true, generado2026-10-24T08:35:29.173Z,
diecinueve hashes de src/scripts/tests/spec y resultados recalculados. No mezclar
ejecuciones previas de desarrollo como si fueran nuevos escenarios medidos.

- Endpoint:9observaciones,6elegibles/3disponibles/2correctas-rápidas,3exclusiones.
- Cohortes en t5/t10/t14:1/1,1/4y2/6buenas/elegibles. Deadline5min inclusivo;
  no seleccionar éxitos recientes ni borrar incumplimientos por finalización tardía.
- Cada escenario tiene43200min; seis tienen cobertura completa. Missing-data tiene
 43195mincubiertos y no recibe un cumplimiento favorable calculado sobre lo conocido.
- Baseline:43.2millones de eventos/0malos/43200permitidos.
- Fast/recovered:1500malos/43200permitidos/41700restantes. Mismo presupuesto;
  fast1h/5m=25×/150×, recovered25×/0×. Estados distintos, no datos ocultados.
- Slow:3600malos/restante39600. Par6h/30m=10×/10×, firing, no par rápido.
- Lowtraffic:1malo,restante42.2. Ratio alto con volumen insuficiente, no prueba de salud.
- No-traffic:SLI/cumplimiento null. Missing-data:budget null, estado missing_data.

El generador deriva scenarios.json, model.mjs y burn-rate.svg. El modelo del visor
se compila desde las mismas fuentes TypeScript; verify lo compara con Node.
No se guardan43200filas por escenario en el blog: segmentos de entrada comprimidos,
expandidos en memoria, y código estático permitido. Cinco exports canónicos.

## Correcciones de interpretación revisadas

Un200no prueba corrección; un503rápido no es éxito de latencia; elegibilidad se
decide antes del resultado. Instante de madurez y ventana de agregación son distintos.
Rolling/calendario cambian fronteras, no reparan incidentes. Se suman eventos,
no porcentajes de intervalos. Un cero de tráfico conocido no representa un hueco.

No redondear0.05eventos permitidos a uno; no recortar deuda a cero. Un SLO por
eventos no se convierte automáticamente en minutos de caída. Burn rate no es
errores/s ni tiempo restante. La equivalencia temporal de thresholds supone tráfico
uniforme respecto al periodo; la proyección necesita margen y tráfico supuestos.

No confundir condición firing, notificación entregada y acción ejecutada. Min1000/50
es política ilustrativa, no significación estadística. Missing/no traffic/insufficient
no equivalen a ok. El presupuesto final del visor sigue referido a30d al cambiar
el instante de las alertas; no se extrapola un prefijo corto a un periodo completo.

## Fuentes

Fuentes primarias consultadas: Google SRE/Workbook sobre SLO, ventanas, presupuesto,
riesgo, pipelines y alertas; docs oficiales Prometheus sobre funciones/alerting rules,
Google Cloud sobre conceptos SLO y AWS CloudWatch sobre thresholds. Fecha y enlaces
en los posts. Las clasificaciones y cálculos concretos son decisiones del laboratorio,
no una transcripción de configuración de ningún proveedor.

## Verificación ejecutada

- Doce tests, typecheck estricto, simulate y verify pasan.
- Diez snippets JS/TS coinciden con las fuentes; seis D2/SVG y una gráfica tienen
  alt y dimensiones verificados. Enlaces internos y referencias a archivos existen.
- Noventa y siete checks editoriales/estructurales del monorepo pasan. No repetir
  esa cifra como si fueran todas las integraciones Docker/hardware de series previas.
- pnpm frozen/offline/ignore-scripts pasa y verifica466entradas de supply chain.
- Build final correcto:50rutas,64HTML incluidos visores. Pagefind indexa diez páginas
  publicadas/4280palabras. Diecinueve tests del blog pasan después del build.
- Se detectó inventario P060desactualizado: corregido regenerando auditoría real,
  no cambiando la expectativa del test. Estado64exactos/23relacionados/88sin artículo,
  no aceptación por existencia de archivos.

## Verificación visual

Informe final `/tmp/service-objectives-layout.c1DyHM/report.json`:14vistas a1440/360,
56combinaciones escenario/target, tres pares, instantes de alerta y cinco snapshots
de cohortes por viewport mediante teclado. Comprueba noindex, recursos, ausencia
de overflow global, código enfocable, iframe, tablas desplazables y viewBox responsive.

Los seis SVG se renderizaron también con Resvg. Un fallo inicial de decode en móvil
era una espera prematura del lazy loading; se esperó complete/naturalWidth antes
de decode, conservando la aserción. No se retiró la validación de las imágenes.

Se inspeccionaron seis diagramas móviles, tabla del endpoint, gráfica derivada y
regiones del visor. Se corrigió el diagrama de cohortes para no dibujar buena/mala
como estados consecutivos. La gráfica móvil pasó de scroll horizontal a viewBox380,
para mostrar el pico completo con etiquetas legibles. Resize sin recarga probado
en360/900/400/1440. Tablas conservan scroll con foco y nombres accesibles.

Servidor temporal PID3547279 cerrado; puerto4322 sin listener. Sin otros servicios,
contenedores o procesos de laboratorio arrancados para esta simulación.

## Límites y siguiente bloque

No hay endpoint o worker ejecutados en este paquete, telemetría real, scraping,
Prometheus/Alertmanager, paging, for/pending duration, grouping/inhibition/ack o CI
aplicando la política. Contrato y owners ficticios. Sin calendario civil, DST,
counter resets, datos tardíos o relojes distribuidos. Cobertura es premisa de entrada.
Modelos en memoria y PPM acotados; no extrapolación estadística ni targets aprobados.

P061: leer completo OPS-DELIVERY/docker-ci-despliegues-runbooks y reliable-services,
contrastar con la ficha antes de escribir. Separar triage, mitigación/verificación,
runbook, coordinación/on-call y postmortem con cronología y acciones verificables.
Después P062–P066. Mantener gapsP026, Stripe sandboxP045 y soakP058. Objetivo activo.
