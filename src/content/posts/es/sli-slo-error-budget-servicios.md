---
id: OPS-SLO
title: 'SLI, SLO y error budgets: medir lo que el usuario necesita'
published: 2026-10-17T04:03:00Z
locale: es
translationKey: reliable-service-objectives
slug: sli-slo-error-budget-servicios
draft: true
status: draft
level: intermedio
prerequisites: [OPS-LOAD]
description: 'Define eventos buenos y elegibles, ventanas y presupuesto de error. Distingue aceptación HTTP de finalización de negocio y evita porcentajes sin denominador.'
author: 'Luis Ramírez Calle'
series: 'Probar y operar servicios fiables'
tags: [sre, slo, observabilidad, fiabilidad]
---

El servicio tiene un 99.99 % de respuestas HTTP exitosas, pero muchas operaciones nunca salen de `processing`. Si el usuario esperaba que su reserva se resolviera, estamos midiendo una parte del recorrido y llamándola fiabilidad completa.

Después de [interpretar las pruebas de carga](/posts/pruebas-carga-percentiles-saturacion), necesitamos definir qué resultado es bueno y para quién. Un porcentaje sin ventana, denominador y criterio de éxito no permite tomar decisiones.

## SLI mide y SLO fija un objetivo

Un **SLI**, Service Level Indicator, mide una propiedad del servicio: por ejemplo, proporción de solicitudes elegibles que reciben respuesta válida dentro del umbral. Un **SLO**, Service Level Objective, fija una meta para ese indicador durante una ventana.

Un **SLA** es un acuerdo con consecuencias contractuales; no es simplemente un SLO escrito en una presentación. No necesitamos inventar penalizaciones para aprender a medir una demo.

En una operación asíncrona podríamos separar dos indicadores: aceptación correcta de solicitudes y resolución dentro de un plazo. El primero observa la API; el segundo exige seguir el estado de la intención hasta una conclusión definida.

<img src="/assets/visuals/reliable-services/OPS-SLO.svg" alt="Los eventos elegibles se clasifican como buenos o malos según el resultado del usuario; el SLI se compara con un objetivo y una ventana para calcular consumo del presupuesto." width="542" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/OPS-SLO.svg).

## El denominador también es una decisión

¿Cuentan peticiones malformadas? ¿Los rechazos válidos de negocio? ¿Las operaciones que todavía no han tenido tiempo de resolverse? Hay que fijarlo antes de mirar si el resultado sale bien.

Excluir todos los errores etiquetados «externos» podría esconder precisamente la experiencia que queremos mejorar. Un proveedor puede estar fuera de nuestro control y dentro del recorrido del usuario. Podemos mantener indicadores por componente, pero no sustituir sin explicarlo el de extremo a extremo.

Para medir resolución a cinco minutos, no clasifiques como fallida una operación creada hace diez segundos. Necesitas cohortes suficientemente maduras o una formulación temporal que evite ese sesgo.

## Un presupuesto convierte el objetivo en una cantidad

Con un objetivo hipotético del 99 % sobre 100 000 eventos elegibles, el presupuesto permite 1000 eventos malos en esa ventana. Con objetivo del 99.9 %, permitiría 100. Es aritmética de ejemplo, no una recomendación universal de objetivos.

El laboratorio calcula el mismo principio como `n × (1 - target)`. Con muestras pequeñas puede devolver una fracción: 0.05 eventos permitidos no significa que exista «medio fallo», sino que un solo evento malo ya superaría la proporción elegida.

Archivo: `reliable-services/tests/core.test.mjs` (extracto).

```javascript
const stats = summarize([10, 20, 30, 40, 100], 1, 0.99)
assert.equal(stats.p95, 100)
assert.equal(stats.allowedErrors, 0.05)
assert.equal(stats.availability, 0.8)
```

`availability` representa aquí la proporción de observaciones sin error que pasamos al helper; no es una medición general de disponibilidad del negocio. El nombre no reemplaza la definición del indicador.

## Burn rate indica la velocidad de consumo

El **burn rate** compara la proporción actual de eventos malos con la tolerada por el objetivo. Para un SLO del 99.9 %, una tasa de error del 1 % consume presupuesto a una velocidad diez veces mayor que la de referencia.

El cálculo solo es útil si las ventanas y los datos son comparables. Con muy poco tráfico, un fallo puede disparar ratios ruidosos. Las alertas deben combinar sensibilidad y duración, y pedir una acción concreta, no simplemente notificar cada fluctuación.

Una política de presupuesto puede orientar cuándo reducir riesgo de cambios y priorizar fiabilidad. No es una orden automática de dejar de desarrollar: requiere contexto y responsables.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/ops-slo/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

Un SLO describe un objetivo, no una promesa de ausencia de fallos. Elegir un número muy alto sin evidencia puede aumentar coste sin mejorar la experiencia relevante. El laboratorio prueba fórmulas con muestras pequeñas; no instala un sistema de alertas ni evalúa un mes de tráfico.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/tests/core.test.mjs). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="denominador" tests/core.test.mjs
```

## Ejercicio: medir la resolución, no solo la entrada

Define un SLI para operaciones creadas que deban resolverse antes de cinco minutos. Especifica cuándo entran al denominador, qué estados cuentan como resolución y cómo tratar una incertidumbre que requiere revisión. Añade ejemplos que tu cálculo no deba contar todavía.

Cerramos con [entorno, despliegue y recuperación operativa](/posts/docker-ci-despliegues-runbooks).

## Referencias

- [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/).
- [Google SRE Workbook: alerting sobre SLO](https://sre.google/workbook/alerting-on-slos/).

Fuentes consultadas el 17 de octubre de 2026. Todos los objetivos numéricos del artículo son hipotéticos.
