---
id: SLO-COHORTS
title: 'SLI asíncronos: esperar a que una operación pueda incumplir su plazo'
published: 2026-10-24T08:01:00Z
locale: es
translationKey: service-objectives-async-cohorts
slug: sli-asincronos-cohortes-deadline-resolucion
draft: true
status: draft
level: intermedio
prerequisites: [P060, DIST-QUEUES]
description: 'Mide resolución asíncrona por cohortes maduras. Evita contar pendientes recientes como fallos o seleccionar sus éxitos rápidos, y conserva el incumplimiento aunque termine más tarde.'
author: 'Luis Ramírez Calle'
series: 'Fiabilidad medible: de los SLI a las alertas de presupuesto'
tags: [sre, sli, asincronia, cohortes]
---

Una operación lleva diez segundos pendiente y el dashboard ya la cuenta como fallida. Su plazo era de cinco minutos. En otro panel ocurre lo contrario: solo entran las operaciones terminadas, de modo que las que nunca terminan no empeoran el porcentaje.

Los dos cálculos pueden usar datos correctos y responder mal a la misma pregunta. Para medir «se resolvió dentro del plazo», necesitamos decidir **cuándo una operación tiene edad suficiente para evaluarse**.

Después de [definir los eventos elegibles del endpoint](/posts/sli-disponibilidad-latencia-eventos-elegibles), cambiaremos la unidad observada. Ahora medimos una intención asíncrona, no una respuesta HTTP ni cada intento de un worker.

## Un 202 aceptado no demuestra resolución

Podemos tener un indicador de aceptación en la API y otro de resolución del trabajo. El primero pregunta si admitimos correctamente la solicitud. El segundo sigue la operación hasta un resultado acordado.

La distinción es importante incluso si ambos usan operation ID. Una operación puede tener varios intentos o recibir mensajes repetidos. Contar cada intento como una operación nueva alteraría el denominador y podría hacer que los retries exitosos ocultaran el incumplimiento inicial.

El fixture tiene una fila por operación, sin retries ni broker. Rechaza IDs duplicados para que esa restricción no pase desapercibida. No implementa una base de datos que mantenga la unicidad bajo concurrencia.

## El deadline define cuándo podemos evaluar el plazo

Asignamos a cada operación `deadline = createdAt + 5 minutos`. Al observar el sistema, distinguimos tres grupos: todavía no creada, creada pero inmadura y suficientemente antigua para evaluar.

La regla de maduración es la misma para quien terminó pronto y para quien sigue pendiente. Si incluyéramos únicamente los éxitos recientes, estaríamos dando a los fallos potenciales menos oportunidades de entrar en la cuenta.

Extracto de `src/cohorts.ts`:

```typescript
    const deadline = operation.createdAt + deadlineMinutes
    if (operation.createdAt > now) { future++; return { id: operation.id, deadline, classification: 'future' } }
    if (deadline > now) { immature++; return { id: operation.id, deadline, classification: 'immature' } }
    eligible++
```

En el instante exacto del deadline la cohorte ya es evaluable. Esa frontera es una decisión del contrato y está probada. Los valores son minutos de un reloj simulado, no timestamps capturados de servicios reales.

<img src="/assets/visuals/service-objectives/SLO-COHORTS.svg" alt="Una operación recibe un deadline cinco minutos después de crearse; solo al madurar se evalúa si alcanzó una resolución acordada en plazo, mientras las tardías, fallidas o pendientes cuentan como malas sin seleccionar éxitos recientes." width="315" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/service-objectives/SLO-COHORTS.svg).

## Resolver no siempre significa aprobar la solicitud

En un proceso de negocio puede ser correcto finalizar con un rechazo previsto. Por ejemplo, informar que una solicitud no cumple una condición acordada. Eso no convierte en buenos todos los estados llamados `rejected`: depende de lo que el usuario esperaba del servicio.

El contrato didáctico acepta `completed` y `rejected` como resoluciones válidas. `failed` no lo es. Además, exige que la finalización haya ocurrido antes o justo en el deadline.

El test comprueba una resolución en el límite, un rechazo acordado y una finalización tardía. Si cambiamos el significado de esos estados, hay que revisar tanto la definición del SLI como sus pruebas. Un nombre de enum no reemplaza esa decisión de producto.

## Un resultado tardío puede ayudar al usuario y seguir incumpliendo el SLI

Una operación creada en el minuto uno vence en el seis. Si termina en el ocho, ha incumplido el objetivo de cinco minutos. Terminar después no hace que el incumplimiento anterior desaparezca.

Eso no significa que debamos abandonar la recuperación. Podemos medir también la proporción de operaciones finalmente resueltas o el tiempo de recuperación. Son indicadores distintos, útiles para otras preguntas.

Esta separación evita reescribir el pasado cada vez que llega un resultado tardío. También obliga a pensar cómo tratar datos atrasados: si descubrimos que una operación sí terminó a tiempo pero la telemetría llegó tarde, no es lo mismo que si el trabajo terminó realmente fuera de plazo.

## Una muestra que revela el sesgo

El fixture contiene siete operaciones. En el minuto diez, cuatro han madurado y solo una cumplió el criterio. Dos operaciones creadas en el minuto nueve permanecen fuera: una ya terminó y la otra sigue pendiente. La séptima aún no se ha creado.

Por eso el resultado es **1/4**, no dos éxitos sobre todos los terminados ni un fallo por cada pendiente reciente. En `tests/sli.test.mjs`:

```javascript
  const r = classifyCohorts(operations, 10, 5)
  assert.deepEqual([r.eligible, r.good, r.immature, r.future], [4, 1, 2, 1])
```

En el minuto cinco solo hay una operación madura. En el catorce hay seis y dos son buenas. El cambio no se debe a que el sistema «empeore» por arte de magia: cambia el conjunto que ya podemos evaluar.

Para comparar periodos necesitamos definir también cómo elegimos las cohortes. Podemos agrupar por creación o por deadline, pero no intercambiar esas fronteras sin avisar. El helper calcula un snapshot de madurez; no implementa un almacén histórico ni una consulta por todas las cohortes de un mes.

## El retraso de evaluación también tiene coste

Esperar cinco minutos elimina un sesgo, pero retrasa esa señal de incumplimiento. Un problema puede empezar ahora y no aparecer todavía en las cohortes maduras.

Por eso conviene acompañarlas de señales más tempranas: edad de pendientes, backlog o ritmo de finalización. No son sustitutos automáticos del SLI final. Ayudan a detectar que el sistema se está desviando antes de que todos los deadlines hayan pasado.

No hemos instrumentado esas señales en este laboratorio. [La serie de observabilidad](/posts/logs-estructurados-identidades-correlacion) explica cómo distinguir identidad y ejecución sin atribuir una garantía de negocio a un span.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/slo-cohorts/README.md) y [clasificador de cohortes](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/service-objectives/src/cohorts.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/service-objectives test
```

El visor del último artículo permite mover el reloj simulado y observar qué filas cambian de cohorte. No termina jobs ni consulta una cola real.

## Garantías y límites

El modelo comprueba edad, unicidad local, plazo y resultado sobre datos ficticios. No resuelve clock skew entre hosts, cambios retroactivos de deadline, cancelaciones, retries o persistencia. En producción, la elección del reloj y la semántica de finalización forman parte del diseño.

## Ejercicio: recibir tarde una prueba de finalización

Añade `observedAt`, distinto de `finishedAt`. Escribe dos casos: trabajo terminado tarde y trabajo terminado a tiempo cuya observación llega tarde. Decide cómo revisarías el informe histórico sin confundir ambos hechos ni borrar la evidencia original.

Seguimos con [ventanas rolling, calendario y cobertura](/posts/slo-ventanas-rolling-calendario-datos-ausentes).

## Referencias

- [Google SRE Workbook: SLO para diferentes tipos de servicios](https://sre.google/workbook/implementing-slos/).
- [Google SRE Workbook: documentar indicadores y objetivos](https://sre.google/workbook/slo-document/).
- [Google SRE: procesamiento de pipelines](https://sre.google/sre-book/data-processing-pipelines/).

Fuentes consultadas el 24 de octubre de 2026. La política concreta de maduración y los estados son decisiones explícitas del laboratorio.
