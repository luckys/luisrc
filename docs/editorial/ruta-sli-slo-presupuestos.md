# Fiabilidad medible: de los SLI a las alertas de presupuesto

Seis drafts españoles amplían P060. OPS-SLO se conserva como introducción, con
su helper y límites originales. Laboratorio en el monorepo de ejemplos:
`packages/service-objectives`, sin servidores o dependencias runtime.

## Orden recomendado

1. [SLI del endpoint](../../src/content/posts/es/sli-disponibilidad-latencia-eventos-elegibles.md): disponibilidad, latencia, precondiciones y denominador.
2. [Cohortes asíncronas](../../src/content/posts/es/sli-asincronos-cohortes-deadline-resolucion.md): edad, deadline y resolución acordada.
3. [Ventanas](../../src/content/posts/es/slo-ventanas-rolling-calendario-datos-ausentes.md): rolling/calendario, pesos y cobertura.
4. [Presupuesto y política](../../src/content/posts/es/error-budget-calculo-politica-decisiones.md): margen, deuda, fracciones, decisiones y excepciones.
5. [Burn rate](../../src/content/posts/es/burn-rate-presupuesto-errores-trafico.md): ratio, thresholds y supuestos para proyectar tiempo.
6. [Alertas multi-window](../../src/content/posts/es/alertas-multi-window-burn-rate-accionables.md): actividad reciente, volumen, datos y acción.

## División y evidencia

Cada parte responde a una decisión distinta. El presupuesto se acompaña de su
política porque un número no toma decisiones; los pares de alertas tienen pruebas
y un runbook propios. Código explicado dentro del post y completo en GitHub.

Doce tests locales y verificación de evidencia. Endpoint ficticio:6elegibles,
3disponibles/2rápidas-correctas. Cohortes t10:4elegibles/1buena. Siete escenarios
de30d, segmentos deterministas expandidos por minuto, sin observar tráfico real.
1500malos en fast/recovered: mismo presupuesto, distinto estado de alerta. Fuente
TypeScript compartida con el bundle del visor. Seis D2, gráfica derivada y controles
de target, escenario, par, instante y cohortes. Revisión en service-objectives-review.md.

## Límites y continuación

Formato de contrato propio, no OpenSLO. Sin endpoint, alertas desplegadas,
Prometheus/Alertmanager, paging o enforcement de política. Calendario por fronteras
explícitas, sin conversión civil/DST. Umbrales didácticos, no selección estadística
ni targets aprobados. Coverage es una premisa del fixture, no garantía universal.

Siguiente P061: contrastar docker-ci-despliegues-runbooks y reliable-services.
Separar triage, mitigación/verificación, runbooks, coordinación/on-call y postmortem
con cronología reproducible y acciones verificables. Después P062–P066 según fichas.
Conservar gapsP026, Stripe sandboxP045 y soakP058. Español/draft, sin traducción,
audio, publicación, commit o push automáticos. No aceptar todo el roadmap por IDs.
