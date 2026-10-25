---
id: SLO-ALERTS
title: 'Alertas multi-window: detectar consumo peligroso sin seguir avisando de un fallo recuperado'
published: 2026-10-24T08:05:00Z
locale: es
translationKey: service-objectives-multiwindow-alerts
slug: alertas-multi-window-burn-rate-accionables
draft: true
status: draft
level: intermedio
prerequisites: [SLO-BURN, OBS-EXEMPLARS]
description: 'Combina ventanas larga y corta con cobertura y volumen explícitos. Simula condiciones de page y ticket, distingue recuperación y datos ausentes y documenta acciones antes de notificar.'
author: 'Luis Ramírez Calle'
series: 'Fiabilidad medible: de los SLI a las alertas de presupuesto'
tags: [sre, alertas, burn-rate, runbooks]
---

El fallo terminó hace quince minutos, pero la alerta sigue pidiendo una mitigación urgente. La ventana de una hora aún contiene el incidente. El dato histórico es correcto; la petición de acción ya no describe necesariamente el estado actual.

Una alerta **multi-window** combina impacto acumulado con una comprobación reciente. No pretende borrar el pasado: intenta distinguir un problema que sigue consumiendo presupuesto de otro que ya se ha recuperado.

Después de [entender el burn rate y sus supuestos](/posts/burn-rate-presupuesto-errores-trafico), añadiremos también cobertura, volumen y una acción. El laboratorio evalúa condiciones; no envía notificaciones ni despliega un sistema de guardias.

## Dos ventanas responden dos preguntas

La ventana larga reconoce un impacto sostenido o suficientemente intenso. La corta comprueba si el consumo sigue presente cerca del instante de evaluación.

En cada par exigimos que **ambos burn rates superen el mismo threshold**. No hacemos un OR entre larga y corta, porque volveríamos a disparar solo por los datos antiguos de la larga.

Para demostrar distintas velocidades de consumo, `src/alerts.ts` define tres pares:

```typescript
export const rules: Rule[] = [
  { id: 'fast', longMinutes: 60, shortMinutes: 5, threshold: 14.4, severity: 'page', minLong: 1000, minShort: 50 },
  { id: 'slow', longMinutes: 360, shortMinutes: 30, threshold: 6, severity: 'page', minLong: 1000, minShort: 50 },
  { id: 'ticket', longMinutes: 4320, shortMinutes: 360, threshold: 1, severity: 'ticket', minLong: 1000, minShort: 50 },
]
```

Son parámetros ilustrativos para el periodo de treinta días explicado antes. Los mínimos de volumen son una decisión del fixture, no una recomendación universal ni un cálculo de confianza estadística.

Un **page** representa una condición para atención inmediata; un **ticket**, trabajo que puede organizarse con otra urgencia. Clasificar no demuestra que exista alguien disponible ni que la notificación haya llegado.

<img src="/assets/visuals/service-objectives/SLO-ALERTS.svg" alt="Primero se verifica cobertura y volumen, después el burn rate de una hora y el de cinco minutos deben superar14.4; solo la combinación produce una condición candidata a page, acompañada de owner, evidencia y runbook." width="360" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/service-objectives/SLO-ALERTS.svg).

## Recuperación: la ventana corta reduce la persistencia del aviso

En el escenario rápido, los diez minutos finales tienen 15 % de errores. Al final, el burn rate de una hora es 25× y el de cinco minutos, 150× para un SLO del 99.9 %. Ambos superan 14.4.

En `recovered` hay exactamente los mismos mil quinientos fallos, pero terminaron quince minutos antes. El ratio largo sigue en 25×; el corto ha vuelto a cero. Ese par ya no está firing.

No significa que la reparación esté demostrada para siempre. Significa que la condición elegida dejó de cumplirse con esas observaciones. El SLO del periodo y la investigación del incidente conservan su información.

La recuperación tampoco es instantánea: una ventana corta conserva historia hasta que los eventos antiguos salen. Añadir una cláusula de duración o un retardo de notificación puede cambiar aún más los tiempos; nuestro modelo no los implementa.

## Calidad de datos antes de interpretar el ratio

Si falta una parte de cualquiera de las ventanas, el par devuelve `missing_data`. Si ambas están cubiertas pero no hay eventos, devuelve `no_traffic`. Si hay eventos pero no alcanzan los mínimos elegidos, devuelve `insufficient_volume`.

Solo después se evalúa el threshold. La comparación es estricta: exactamente seis no supera un threshold de seis.

Extracto de `src/alerts.ts`:

```typescript
    const state = !long.complete || !short.complete ? 'missing_data'
      : long.total === 0 || short.total === 0 ? 'no_traffic'
        : long.total < rule.minLong || short.total < rule.minShort ? 'insufficient_volume'
          : longBurn! > rule.threshold && shortBurn! > rule.threshold ? 'firing' : 'ok'
```

Con poco tráfico, un único fallo puede producir un ratio alto y afectar a un usuario real. El estado insuficiente no permite ignorarlo: obliga a decidir otra forma de observar ese servicio, quizá con revisión de fallos individuales o probes separados.

Del mismo modo, la ausencia de firing no demuestra salud si faltan datos. Un sistema operativo necesita vigilar también su telemetría. El visor conserva esos estados en vez de colorearlos todos como éxito.

## Siete escenarios que puedes comparar

El visor permite elegir objetivo, par y momento de evaluación. Usa el mismo modelo compilado que verificamos en Node. La gráfica muestra seis horas finales de cada escenario; el presupuesto permanece referido a sus treinta días completos.

<iframe src="/assets/interactive/service-objectives/explorer.html" title="Simular SLO, ventanas de burn rate, cobertura y maduración de cohortes" width="100%" height="1250" loading="lazy" style="border:1px solid #475569;border-radius:12px"></iframe>

[Abrir el visor completo](/assets/interactive/service-objectives/explorer.html).

Compara primero `fast-burn` y `recovered`. Después prueba `slow-burn`: un 1 % sostenido durante seis horas no supera el par rápido, pero sí el de seis horas y treinta minutos.

`low-traffic`, `no-traffic` y `missing-data` muestran tres situaciones distintas que no deberían fundirse en un único valor cero. El control de cohortes es independiente: explica cuándo una operación asíncrona entra en su denominador.

Los datos son inventados y deterministas. No hay tráfico real del blog, distribución de usuarios estimada ni conexión a un dashboard externo.

## Una alerta accionable necesita algo más que el número

`spec/alert-runbook.md` incluye un owner ficticio y una secuencia de investigación: confirmar cobertura, distinguir errores y lentitud, revisar si el problema continúa y buscar cambios recientes antes de elegir una mitigación autorizada.

Una notificación útil debe indicar servicio, indicador, ventana, criterio incumplido y dónde empezar. «CPU alta» sin efecto conocido ni acción acordada puede convertirse en ruido, aunque la métrica sea correcta.

Las señales de [observabilidad](/posts/exemplars-openmetrics-histograma-traza) ayudan a investigar después. Una traza puede aportar un ejemplo del fallo, pero su ausencia por sampling no invalida los eventos agregados del SLI.

El modelo da prioridad de severidad a page si coinciden varios pares. No implementa grouping, inhibition, deduplicación, acknowledgements o repetición de avisos. Evitar tres notificaciones por un mismo incidente requiere esa capa adicional, no solo el cálculo del ratio.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/slo-alerts/README.md), [evaluador](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/service-objectives/src/alerts.ts) y runbook ficticio:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/service-objectives test
pnpm --filter @luisrc-examples/service-objectives verify
```

Los tests cubren degradación, recuperación, igualdad con el threshold, volumen y cobertura. La verificación recalcula la evidencia y compara el bundle del navegador. No valida reglas PromQL o integración con Alertmanager.

## Garantías y límites

Simulamos contadores por minuto y estados de condiciones, sin deploy, monitorización real ni respuesta humana ejecutada. Los thresholds, owners y políticas necesitan revisión antes de aplicarse a un servicio. No deben sustituir alertas específicas de seguridad, integridad o pérdida de datos.

## Ejercicio: comprobar la acción y no solo el disparo

Elige un escenario y redacta una notificación con evidencia, owner y primera comprobación. Después introduce un hueco de telemetría. La prueba debe impedir que ese hueco se anuncie como recuperación demostrada o que una condición firing se confunda con una notificación entregada.

El siguiente bloque profundizará en incidentes, runbooks y postmortems. La pregunta dejará de ser «¿se cumple una condición?» para pasar a «¿cómo restauramos el servicio y comprobamos que el usuario se ha recuperado?».

## Referencias

- [Google SRE Workbook: alertas multi-window y multi-burn-rate](https://sre.google/workbook/alerting-on-slos/).
- [Prometheus: estados y duración de reglas de alerta](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/).
- [Google SRE: practical alerting](https://sre.google/sre-book/practical-alerting/).

Fuentes consultadas el 24 de octubre de 2026. La implementación es un modelo local, no un sistema de paging desplegado.
