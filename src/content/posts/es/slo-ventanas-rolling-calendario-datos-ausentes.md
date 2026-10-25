---
id: SLO-WINDOWS
title: 'Ventanas de un SLO: qué cambia entre rolling, calendario y datos que faltan'
published: 2026-10-24T08:02:00Z
locale: es
translationKey: service-objectives-windows-coverage
slug: slo-ventanas-rolling-calendario-datos-ausentes
draft: true
status: draft
level: intermedio
prerequisites: [SLO-COHORTS]
description: 'Elige fronteras rolling o de calendario, agrega por eventos y conserva estados sin tráfico o con datos ausentes. No confundas una ventana parcial con un periodo completo.'
author: 'Luis Ramírez Calle'
series: 'Fiabilidad medible: de los SLI a las alertas de presupuesto'
tags: [sre, slo, ventanas, metricas]
---

Una incidencia termina el último día del mes y el panel vuelve a mostrar todo verde al cambiar de fecha. Los usuarios afectados no han olvidado lo ocurrido; ha cambiado la ventana del cálculo.

La ventana no es un detalle de presentación. Decide **qué eventos siguen contando, cuáles salen y qué periodo estamos dispuestos a evaluar con los datos disponibles**.

Después de [madurar las operaciones asíncronas](/posts/sli-asincronos-cohortes-deadline-resolucion), vamos a separar la edad de cada operación de la ventana que agrupa sus resultados. Son dos decisiones temporales diferentes.

## Rolling: mirar siempre el pasado más reciente

Una **rolling window** conserva un intervalo de duración fija que se desplaza con el instante de evaluación. Por ejemplo, los últimos treinta días.

Al avanzar, entran eventos nuevos y salen antiguos. Un incidente deja de afectar al indicador cuando abandona esa ventana, no porque lo hayamos corregido retrospectivamente. Por eso el presupuesto puede recuperarse aunque no cambie la clasificación original de aquellos eventos.

También cambia el denominador. Si el tráfico crece, los mismos fallos pueden representar una proporción menor; si disminuye, otra mayor. El porcentaje no debe interpretarse como un recuento fijo de personas o como evidencia automática de una mejora técnica.

## Calendario: alinear la evaluación con un periodo acordado

Una ventana de **calendario** empieza en una frontera acordada, como el comienzo del mes en una zona horaria determinada. Puede resultar útil para planificación o informes.

Durante el mes solo conocemos lo ocurrido hasta ahora. No sabemos cuántas peticiones llegarán después. Presentar el presupuesto permitido de esa parte observada como si fuera un crédito ya asegurado para todo el mes sería engañoso.

Además, «mes» no significa siempre treinta días. Hay que documentar zona horaria, duración y reglas del periodo. Nuestro contrato usa treinta días rolling; el modelo de ventanas acepta fronteras enteras ya calculadas. **No implementa un calendario civil, DST ni conversión de zonas horarias**.

<img src="/assets/visuals/service-objectives/SLO-WINDOWS.svg" alt="Se definen fronteras semiabiertas de una ventana rolling o de calendario, se comprueba cobertura, se suman eventos en vez de porcentajes y se conserva un estado incompleto cuando falta telemetría." width="346" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/service-objectives/SLO-WINDOWS.svg).

## Una comparación pequeña hace visible el cambio de denominador

El test usa seis minutos ficticios, cien eventos por minuto y diez malos en el minuto dos. Observamos hasta el comienzo del minuto cinco.

Una ventana rolling de cuatro minutos lee `[1, 5)`: cuatrocientos eventos, diez malos. Una ventana cuyo periodo empieza en el minuto cuatro lee `[4, 5)`: cien eventos, ninguno malo.

No estamos simulando que un mes dure cuatro minutos. Elegimos fronteras pequeñas para probar el mismo mecanismo de inclusión y exclusión. `tests/alerts.test.mjs`:

```javascript
  assert.equal(index.read(1, 5).bad, 10)
  assert.equal(index.read(4, 5).bad, 0)
  assert.equal(index.read(1, 5).total, 400)
  assert.equal(index.read(4, 5).total, 100)
```

La notación **`[inicio, fin)`** incluye el inicio y excluye el final. Ayuda a que dos periodos consecutivos no cuenten dos veces el mismo intervalo. Exige que la fuente y el agregador compartan esa convención.

## Agregar por eventos, no promediar porcentajes

Imagina un minuto con diez peticiones y un fallo, seguido de otro con mil peticiones y ningún fallo. Promediar 10 % y 0 % daría 5 % de error. El cálculo por eventos es **1/1010**, aproximadamente 0.099 %.

Ambos promedios responden a ponderaciones diferentes. Para el SLI por solicitudes que hemos definido, cada evento pesa igual. No cada minuto.

El laboratorio conserva total y malos por intervalo. `WindowIndex` construye sumas acumuladas y obtiene una ventana restando los prefijos de sus extremos. Eso evita recorrer los treinta días cada vez que movemos un control del visor.

No es una base de series temporales. Usa una rejilla en memoria, minutos consecutivos y contadores ya clasificados. Rechaza índices fuera de rango y entradas que rompen esa rejilla.

## Sin tráfico no significa sin datos

Un intervalo puede tener `total = 0` porque sabemos que no hubo peticiones. También puede faltar la observación del intervalo. Si rellenamos ambas situaciones con ceros, podemos declarar un éxito que no hemos medido.

El modelo conserva `present`. Un minuto conocido sin tráfico es `present: true`. Un hueco es `present: false` y no lleva recuentos. La ventana informa cuántos minutos están cubiertos y si está completa.

Con cero eventos conocidos, el SLI por eventos queda **no definido**, no en 100 %. Con cobertura incompleta, el informe no declara cumplimiento. Podemos calcular estadísticas sobre lo conocido para investigar, pero no presentarlas como un periodo completo.

Un sistema real también debe vigilar la calidad de su pipeline de métricas. Tener un punto por minuto no demuestra que cada petición se haya observado. La señal `present` es una premisa del fixture, no una prueba universal de cobertura.

## Ventana del SLO y ventana de alerta no son intercambiables

Evaluar un SLO sobre treinta días no obliga a esperar treinta días para detectar un problema. Una alerta puede mirar una hora y cinco minutos para reconocer una degradación activa.

Lo contrario también importa: un buen resultado en cinco minutos no borra un SLO incumplido durante el mes. Son preguntas distintas, con periodos distintos.

En el visor, el presupuesto corresponde a los treinta días completos del escenario simulado. Al mover el instante de evaluación cambian las ventanas de alerta, no se convierte un prefijo corto de datos en una nueva ventana rolling de treinta días.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/slo-windows/README.md) e [índice de ventanas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/service-objectives/src/windows.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/service-objectives test
```

Los tests distinguen ausencia de tráfico y ausencia de observación, fronteras semiabiertas y ponderación por eventos. El ejemplo de calendario usa límites explícitos; no afirma haber probado cambios de mes reales.

## Garantías y límites

El modelo exige minutos completos y contadores enteros. No trata scrapes irregulares, extrapolación de `rate`, reseteos de counters o llegada tardía de métricas. Una integración de producción tendría que resolver esas condiciones sin ocultarlas en un porcentaje final.

## Ejercicio: comparar un mes corto con treinta días

Calcula fuera del índice las fronteras UTC de febrero y las de una ventana de treinta días terminada el mismo día. Introduce un incidente que solo pertenezca a una de ellas. Comprueba los eventos incluidos antes de comparar sus porcentajes.

Seguimos con [presupuesto de error y política de decisiones](/posts/error-budget-calculo-politica-decisiones).

## Referencias

- [Google SRE Workbook: elegir una ventana](https://sre.google/workbook/implementing-slos/#choosing-an-appropriate-time-window).
- [Google Cloud: conceptos de periodos y presupuesto](https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring).
- [Prometheus: funciones sobre series y contadores](https://prometheus.io/docs/prometheus/latest/querying/functions/).

Fuentes consultadas el 24 de octubre de 2026. El laboratorio verifica agregación sobre una rejilla simulada, no consultas PromQL.
