---
id: SLO-BURN
title: 'Burn rate: cuánto más rápido se consume el presupuesto y cuándo importa el tráfico'
published: 2026-10-24T08:04:00Z
locale: es
translationKey: service-objectives-burn-rate
slug: burn-rate-presupuesto-errores-trafico
draft: true
status: draft
level: intermedio
prerequisites: [SLO-BUDGET]
description: 'Calcula burn rate sin confundirlo con errores por segundo. Deriva thresholds para 30 y 28 días y separa una velocidad relativa de una predicción condicionada del tiempo restante.'
author: 'Luis Ramírez Calle'
series: 'Fiabilidad medible: de los SLI a las alertas de presupuesto'
tags: [sre, burn-rate, error-budget, alertas]
---

Dos servicios muestran un 1 % de errores. Para uno, el objetivo permite ese porcentaje; para el otro, es diez veces su tolerancia. El error rate aislado no expresa la distancia respecto al compromiso elegido.

El **burn rate** relaciona la proporción reciente de eventos malos con la tolerada por el SLO. Es útil para reconocer consumo peligroso, siempre que no lo confundamos con una predicción automática de cuánto tiempo queda.

Después de [calcular el presupuesto](/posts/error-budget-calculo-politica-decisiones), añadiremos esa perspectiva temporal mediante escenarios explícitamente simulados.

## Un ratio sin unidades, no una cuenta de errores por segundo

Para un SLO de proporción objetivo `S` y una fracción de eventos malos `e` en la ventana elegida:

```text
burn rate = e / (1 − S)
```

Con un objetivo del 99.9 %, toleramos 0.1 % de eventos malos. Si el error rate de la ventana es 1 %, el burn rate es **10×**. La proporción de fallos es diez veces la tolerancia del objetivo.

Un burn rate de uno no significa ausencia de fallos: significa que la proporción coincide con la tolerancia. Cero significa que en las observaciones conocidas no hubo eventos malos. Con cero eventos totales no hay ratio que calcular.

Implementación de `src/budget.ts`:

```typescript
export function burnRate(total: number, bad: number, targetPpm: number): number | null {
  validateCounts(total, bad, targetPpm)
  if (total === 0) return null
  return (bad / total) / ((SCALE - targetPpm) / SCALE)
}
```

La unidad del ratio importa: dos servicios pueden tener el mismo burn rate con cantidades de tráfico muy diferentes. El número no indica por sí solo cuántos usuarios están afectados ni cuántos fallos ocurren por segundo.

<img src="/assets/visuals/service-objectives/SLO-BURN.svg" alt="Una proporción del uno por ciento de fallos se divide entre la tolerancia del 0.1 por ciento de un SLO del 99.9 y produce burn rate diez; proyectar horas requiere además presupuesto restante y una cantidad supuesta de fallos por hora." width="317" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/service-objectives/SLO-BURN.svg).

## De dónde salen thresholds como 14.4

Podemos elegir un consumo significativo del presupuesto y una ventana para detectarlo. Bajo el supuesto de tráfico uniforme respecto al periodo de referencia:

```text
threshold = fracción de presupuesto × duración del periodo / duración de la ventana
```

Treinta días son 720 horas. Para detectar un consumo equivalente al 2 % del presupuesto en una hora, obtenemos `0.02 × 720 / 1 = 14.4`.

Con veintiocho días son 672 horas y el mismo cálculo da **13.44**, no 14.4. No conviene copiar el número sin comprobar el periodo al que pertenece. Los tests lo hacen explícito:

```javascript
  assert.equal(thresholdFor(0.02, 720, 1), 14.4)
  assert.equal(thresholdFor(0.02, 672, 1), 13.44)
```

Esta equivalencia temporal depende del supuesto de volumen. En un SLO por eventos, una hora con mucho más tráfico que la media puede consumir una fracción mayor del presupuesto total que otra hora con el mismo error rate.

El burn rate sigue describiendo el ratio elegido. Lo que deja de ser exacto es traducirlo directamente en «este porcentaje del presupuesto mensual» usando solo la duración de la ventana.

## Una proyección necesita saber cuánto margen queda

«Con burn rate diez se agota en tres días» presupone un periodo de treinta días, presupuesto completo y un ritmo comparable. Si ya hemos consumido parte, o cambia el tráfico, el resultado será distinto.

Una proyección explícita puede usar:

```text
horas restantes ≈ eventos malos aún permitidos / eventos malos esperados por hora
eventos malos esperados por hora = solicitudes por hora × fracción de errores supuesta
```

Si quedan ochocientos eventos malos permitidos y esperamos diez mil solicitudes por hora con 1 % de fallos, el ritmo sería cien malos por hora: quedarían ocho horas bajo esos supuestos.

El helper del laboratorio devuelve `null` si no hay un ritmo positivo con el que proyectar. No muestra infinito como si fuera una garantía de fiabilidad futura. Devuelve cero cuando ya no queda margen.

La proyección no es un pronóstico estadístico. No modela estacionalidad, cambios de comportamiento ni recuperación. Sirve para hacer visibles las hipótesis de una cuenta sencilla.

## El mismo presupuesto consumido puede esconder estados operativos distintos

La simulación usa treinta días de mil solicitudes por minuto. En `fast-burn`, los diez minutos finales tienen 15 % de errores: mil quinientos eventos malos.

En `recovered`, esos mismos diez minutos ocurrieron antes y después hubo quince minutos sin errores. Ambos escenarios han consumido **1500 de 43200 eventos malos permitidos**, alrededor del 3.472 % del presupuesto del periodo.

Sin embargo, solo el primero sigue fallando al terminar el escenario. Mirar únicamente el presupuesto restante no permite distinguirlos. La ventana reciente añade información que necesitamos para decidir si hay que actuar ahora.

<img src="/assets/interactive/service-objectives/burn-rate.svg" alt="Gráfica calculada de una simulación con mil solicitudes por minuto: al fallar el quince por ciento durante los diez minutos finales, el burn rate de una hora aumenta y supera el threshold 14.4 sin representar tráfico real." width="380" height="335" loading="lazy" style="width:100%;height:auto" />

La gráfica conserva seis horas de contexto. La subida solo ocupa los diez minutos finales porque ese es el incidente simulado. No se ha medido una degradación de un servicio real ni una distribución aleatoria de tráfico.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/slo-burn/README.md), [fórmulas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/service-objectives/src/budget.ts) y escenarios:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/service-objectives test
pnpm --filter @luisrc-examples/service-objectives verify
```

La evidencia archivada incluye entradas, hashes y resultados recalculables. `simulate` la regenera de manera determinista, salvo la fecha de generación; no lanza peticiones ni introduce fallos en una aplicación.

## Garantías y límites

El cálculo usa un SLO por eventos y datos completos del escenario, salvo el caso diseñado con telemetría ausente. La proyección temporal es condicional. No hemos estimado tráfico futuro ni validado un target con usuarios reales.

## Ejercicio: romper el supuesto de volumen uniforme

Construye dos horas con el mismo error rate, una con cien peticiones y otra con un millón. Compara sus burn rates y sus eventos malos. Explica por qué una traducción basada solo en horas no expresa la misma fracción de un presupuesto mensual por eventos.

Seguimos con [alertas multi-window y acciones concretas](/posts/alertas-multi-window-burn-rate-accionables).

## Referencias

- [Google SRE Workbook: alertar por consumo de presupuesto](https://sre.google/workbook/alerting-on-slos/).
- [AWS CloudWatch: derivar thresholds de burn rate](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html).
- [Google Cloud: conceptos de presupuesto por eventos](https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring).

Fuentes consultadas el 24 de octubre de 2026. Los thresholds y objetivos son ejemplos que requieren adaptación al servicio.
