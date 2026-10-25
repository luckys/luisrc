# Revisión de respuesta a incidentes, 25 de octubre de 2026

## Alcance editorial

Seis drafts españoles amplían P061: triage, mitigación/verificación, runbooks,
on-call/handoff, postmortem y acciones. Entre 1106 y 1315 palabras contando metadata
y código. La guía editorial se aplica separando preguntas y decisiones, abriendo
por un problema y explicando mecanismos, alternativas y límites. Cada artículo
incluye diagrama, extractos reales, ejercicio y referencias primarias.

OPS-DELIVERY conserva URL, ejemplos y límites originales, con enlace a la nueva
serie. Los snippets permanecen en los posts. Código completo solo en el monorepo
`luisrc-blog-examples/packages/incident-response`, con README por artículo en GitHub.
Ver `ruta-incidentes.md` y `incident-response-series.json`.

## Requisitos de P061 contrastados

| Requisito | Evidencia y alcance |
| --- | --- |
| Triage, symptom/root cause | Tres IDs pendientes, API viva, ticks que avanzan e intentos estables; selector y contraejemplo legacy explican el mecanismo. Hipótesis y hechos separados. |
| Mitigation | Pausa con 503, restauración de lote bajo revisión, drenaje de mismos IDs, reapertura y comprobación de payloads. |
| Runbooks | Siete decisiones con scope, riesgo, precondición, salida y parada. Ruta ejecutada por script, no ensayo humano. |
| On-call | Roles, comunicación, escalación y handoff explicados. Documentos ficticios y tests de estructura; sin paging o comunicación humana ejecutados. |
| Postmortem/blameless | Once observaciones con UTC, orden y reloj monotónico. Análisis redactado distingue disparador, mecanismo y condiciones. Sin atribuir decisiones ficticias a personas. |
| Action items | Responsable, revisión, criterio y prueba. A01/A03 verificadas solo en fixture; A02/A04 abiertas. Validación documental no prueba despliegue. |
| Fallo simulado e informe | HTTP real, API y worker con PIDs distintos; defecto inyectado deliberadamente, cronología capturada y corrección contrastada. No diagnóstico ciego o incidente de producción. |

## Laboratorio y evidencia

Node24.19.0, pnpm12.8.1, TypeScript5.9.2, @types/node24.19.0. Sin dependencias runtime.
Nuevo importador del lockfile reutiliza esas versiones. Instalación frozen e
ignore-scripts pasa con las políticas del workspace. Treinta proyectos de workspace
incluyen la raíz: veintinueve laboratorios. No confundir ambos recuentos.

Nueve tests y typecheck pasan. Tests cubren legacy/cero, rango, candidato sin
mutación, scope/revisión, dos recorridos HTTP, acciones/handoff y checkpoint parcial.
El test de journal se observó rojo antes de añadir saveCheckpoint. Durante el
desarrollo, los tests HTTP detectaron pérdida del rpcId padre al combinar respuesta
del worker; corregido preservándolo después del spread. No se rebajó el timeout.

Última captura completa: `evidence/incident.json`, 2026-10-25T07:43:29.009Z,
API3694193/worker3694201, dieciséis hashes de src/scripts/tests/docs. `exercise` y
`verify` pasan. Los procesos terminaron; el replay no los necesita.

- Baseline: dos aceptados/completados. Lote cero aceptado por ruta legacy.
- Tres trabajos adicionales pendientes durante al menos tres ticks posteriores a
  la captura queued; intentos siguen en dos y /live responde200.
- Pausa admisión, un503, rechazo de scope ajeno. Restauración drena cinco IDs
  conservados, todavía con admisión cerrada.
- Ruta validada rechaza cero sin alterar lote/revisión. Reapertura: siete resultados
  report:<id>, cero pendientes, un intento por job en este recorrido.
- A01 y A03 verificadas en fixture; alertas y durabilidad siguen abiertas.

Cada captura se espera antes del siguiente paso y se guarda en un checkpoint
ignorado, marcado parcial. No promete fsync, escritura atómica o recuperación ante
corte durante esa escritura. El archivo final solo se genera tras completar aserciones.

## Integración y verificaciones

Doce snippets JS/TS coinciden con fuentes ejecutadas. Seis D2/SVG con alt y
dimensiones reales y una gráfica derivada de recuentos. Cuatro exports canónicos:
HTML, módulo, replay JSON y SVG. No se exportan servidor, comandos o laboratorio.
Visor usa textContent y una única lectura local de datos, sin canal de control.

Los 102 checks editoriales/estructurales del monorepo pasan. Índices:211artículos,
29laboratorios y66exports con hashes verificados. No significa ejecutar todas las
integraciones Docker/hardware históricas. Auditor regenerado:65exactos,
22relacionados/88sin artículo. Existencia no equivale a aceptación del roadmap.

Build:50rutas/65HTML incluidos visores; Pagefind indexa diez páginas publicadas y
4280palabras. Diecinueve tests del blog pasan. Los drafts no se filtran al sitemap,
Markdown público o índice de búsqueda. Sin traducción o generación de audio.

## Revisión visual e interacción

Informe final `/tmp/incident-response-layout.6AsZu3/report.json`:14vistas a1440/360,
once eventos y ocho filtros de fase por viewport, navegación por teclado, límites
de anterior/siguiente y dos botones que saltan a pruebas. Datos de cada captura
comparados con el archivo; campos ausentes muestran No capturado. Sin errores JS,
recursos locales correctos, noindex, iframe y ausencia de overflow global.

Se inspeccionaron capturas de los seis diagramas móviles, gráfica y tablas del
visor. Ajustadas etiquetas abreviadas y anchura mínima de criterios para no crear
filas muy altas. Tablas conservan scroll, foco y nombre accesible. Se volvió a
ejecutar el checker tras esos cambios. Los seis SVG también se renderizaron con Resvg.

La caché Chromium anterior estaba vacía. Restaurada con pnpm exec playwright
install chromium --only-shell en /tmp/incident-response-playwright, build1194.
Fallback Ubuntu24.04 por OS no oficialmente soportado; sin afirmar otros navegadores.
pnpm exec regeneró el lock del blog por poda de importadores históricos y acorn;
restaurado únicamente ese cambio propio, pues estaba limpio antes. Lock final
del blog sin cambios. No se desactivaron políticas de instalación.

Servidor temporal PID3697991 y procesos3694193/3694201 cerrados; puerto4322
confirmado libre. No se iniciaron contenedores o servicios externos para este lab.

## Fuentes, límites y siguiente bloque

Fuentes primarias enlazadas en los posts: Google SRE/Workbook sobre troubleshooting,
incidentes, on-call, emergency response y postmortems, y Node performance.now.
El caso, sus cifras y su implementación son propios del laboratorio.

Sin usuarios de producción, alertas instaladas, guardia/handoff humanos, tickets,
broker durable, crash recovery, retries, efectos externos o exactly-once probado.
Activación de ruta corregida en el mismo binario, no deployment de artefacto.
Timestamps son observaciones del harness, no instantes internos exactos o MTTR humano.

P059/P060/P061 siguen sin commit en ambos repositorios; últimos commits
bloga2ab1e7 y ejemplos319ed10. Sin push o publicación. Esta entrega no completa
el objetivo global. Siguiente P062: API, Redis y PostgreSQL en Compose, setup limpio,
layers/multi-stage/red/volúmenes/seguridad, valorando posts pequeños por decisión.
Conservar gapsP026, Stripe sandboxP045 y soakP058 y alcance de Serie02.
