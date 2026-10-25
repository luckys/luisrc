---
id: P060
title: 'Definir un SLI: qué cuenta como una respuesta buena y qué entra en el denominador'
published: 2026-10-24T08:00:00Z
locale: es
translationKey: service-objectives-sli-eligibility
slug: sli-disponibilidad-latencia-eventos-elegibles
draft: true
status: draft
level: intermedio
prerequisites: [P059, P058, OPS-SLO]
description: 'Define disponibilidad y latencia desde resultados elegibles del usuario. Distingue SLI, SLO y SLA, valida el denominador y evita confundir HTTP 200 con una respuesta correcta.'
author: 'Luis Ramírez Calle'
series: 'Fiabilidad medible: de los SLI a las alertas de presupuesto'
tags: [sre, sli, slo, fiabilidad]
---

El dashboard muestra pocas respuestas 500, pero los usuarios siguen sin poder abrir sus informes. Algunas peticiones terminan en timeout; otras devuelven un 200 con datos que la interfaz no puede utilizar.

Antes de discutir si necesitamos un 99.9 % o un 99.99 %, tenemos que acordar **qué resultado queremos medir y qué observaciones entran en la cuenta**. Cambiar ese denominador puede mejorar un porcentaje sin mejorar el servicio.

Esta serie amplía [la introducción a SLI y error budgets](/posts/sli-slo-error-budget-servicios). Usaremos una API ficticia de informes y un laboratorio determinista. Los números son ejemplos calculados, no tráfico de producción ni objetivos recomendados para cualquier producto.

## SLI, SLO y SLA: medida, objetivo y acuerdo

Un **SLI**, Service Level Indicator, mide una propiedad relevante del servicio. Por ejemplo, la proporción de solicitudes elegibles que obtuvieron un resultado correcto.

Un **SLO**, Service Level Objective, establece un objetivo para esa medida y un periodo de evaluación. «99.9 % de resultados correctos durante los últimos treinta días» tiene un significado más concreto que «alta disponibilidad», aunque todavía necesita definir qué consideramos correcto.

Un **SLA**, Service Level Agreement, es un acuerdo que puede incluir consecuencias si no se cumplen determinadas condiciones. No es otro nombre para la gráfica interna del SLO. Este laboratorio no establece un contrato comercial.

Podemos tener varios indicadores para el mismo recorrido: disponibilidad, latencia, resolución asíncrona o frescura de datos. No conviene mezclarlos en un único número sin explicar qué experiencia se pierde al hacerlo.

## Elegibilidad: decidir qué pertenece a esta pregunta

El ejemplo observa `GET /reports/{id}` desde el resultado del cliente simulado. Incluye peticiones de usuarios que cumplen las precondiciones de la operación. Cuenta por separado tráfico sintético, otras rutas y peticiones malformadas.

Esa exclusión es una decisión del contrato didáctico, no una regla que permita quitar del denominador cualquier fallo incómodo. Un timeout de una petición válida sí cuenta como malo. Un error de una dependencia no deja de afectar al usuario por estar fuera de nuestro equipo.

También hay que comprobar cómo obtenemos la evidencia. Si solo miramos los logs del servidor, quizá no veamos una petición que falló antes de llegar a él. Si solo miramos clientes que consiguieron cargar nuestro JavaScript, podemos perder a quienes no llegaron a ese punto.

El laboratorio recibe observaciones ya construidas. **No implementa esa recolección real**. Su función es hacer explícitas las reglas y comprobar que no cambian accidentalmente al calcular el indicador.

<img src="/assets/visuals/service-objectives/P060.svg" alt="Las observaciones simuladas pasan por elegibilidad de ruta, usuario y petición; después se separa resultado correcto de resultado correcto dentro de 300 milisegundos y se divide cada recuento entre los mismos eventos elegibles." width="364" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/service-objectives/P060.svg).

## Disponibilidad no significa simplemente recibir un 200

Para este endpoint, una respuesta buena de disponibilidad es un 200 con body válido o un 404 esperado con body válido. El segundo caso representa correctamente que el informe solicitado no existe.

Un 404 inesperado no cuenta como bueno. Tampoco un 200 con payload inválido. El fixture incorpora `expectedNotFound` y `bodyValid` como resultados de un oráculo de prueba; **no detecta por sí solo si la respuesta real es verdadera**. Integrarlo exigiría validar el contrato y la semántica correspondiente.

Estas seis observaciones son elegibles:

<div role="region" aria-label="Clasificación de respuestas del endpoint" tabindex="0" style="overflow-x:auto">

| Caso | Resultado | Duración | Disponible | Correcto en ≤ 300 ms |
| --- | --- | --- | --- | --- |
| http-01 | 200 válido | 100 ms | Sí | Sí |
| http-02 | 200 válido | 900 ms | Sí | No |
| http-03 | 503 | 10 ms | No | No |
| http-04 | Timeout | No disponible | No | No |
| http-05 | 404 esperado y válido | 80 ms | Sí | Sí |
| http-06 | 200 con body inválido | 100 ms | No | No |

</div>

La disponibilidad de esta muestra es **3/6**. El indicador de resultado correcto y rápido es **2/6**. No calculamos la latencia solo sobre quienes tuvieron éxito y después usamos ese porcentaje como si representara a todos.

## El SLI de latencia también necesita una definición de éxito

Una petición fallida puede ser muy rápida. Por eso el objetivo de latencia del ejemplo exige dos condiciones: resultado correcto **y** duración dentro del umbral. No basta con cronometrar la respuesta.

Extracto de `src/sli.ts`, después de decidir la elegibilidad:

```typescript
    const correct = (event.status === 200 && event.bodyValid) || (event.status === 404 && event.expectedNotFound && event.bodyValid)
    const fast = correct && event.durationMs !== null && event.durationMs <= thresholdMs
    if (correct) available++
    if (fast) fastAndAvailable++
```

El límite de 300 ms es inclusivo: exactamente 300 entra; 301 no. El test comprueba ambas fronteras. No afirmamos que 300 ms sea adecuado para cualquier producto. Elegirlo necesita conocer la interacción, el tráfico y el coste de mejorarlo.

Un indicador basado en «buenos dentro del umbral / elegibles» tampoco es lo mismo que un p95. [Los percentiles](/posts/latencia-percentiles-histogramas-errores) describen otra parte de la distribución. Podemos usar ambos sin confundir lo que demuestra cada uno.

## Documentar la medida antes de automatizar decisiones

`spec/objectives.json` describe servicio ficticio, ruta, frontera, exclusiones, criterio de disponibilidad, criterio de latencia, target y ventana. Usa un formato propio del laboratorio, **no OpenSLO** ni una configuración que pueda enviarse directamente a un proveedor.

El target ilustrativo es 99.9 % sobre una ventana rolling de treinta días. Las seis observaciones sirven para probar clasificación; no para estimar si el producto puede cumplir ese objetivo. Más adelante simularemos una serie temporal completa y conservaremos sus supuestos.

La revisión del documento también importa: cambiar qué cuenta como petición válida modifica la medida. Conviene versionar esa decisión y explicar desde cuándo se aplica, en lugar de corregir el pasado hasta que salga verde.

## Código completo y pruebas

[Archivos y pruebas del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p060/README.md) y [clasificador completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/service-objectives/src/sli.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/service-objectives test
```

Los tests comprueban los recuentos, las exclusiones, el umbral y las observaciones duplicadas. Rechazar un duplicado en el fixture no implementa deduplicación distribuida ni garantiza que una fuente de datos real esté completa.

## Garantías y límites

Probamos una definición ejecutable de SLI sobre datos ficticios. No hay endpoint desplegado, monitor sintético, recopilación de clientes o contrato comercial. Tampoco inferimos disponibilidad global a partir de la salud de una instancia.

## Ejercicio: decidir qué significa un rechazo correcto

Añade un caso de informe sin permisos. Decide si pertenece a este SLI, qué respuesta sería correcta y cómo impedir que un fallo de autorización cuente como éxito por devolver un status esperado. Escribe la expectativa antes de cambiar el clasificador.

Seguimos con [operaciones asíncronas y cohortes maduras](/posts/sli-asincronos-cohortes-deadline-resolucion).

## Referencias

- [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/).
- [Google SRE Workbook: implementar SLO](https://sre.google/workbook/implementing-slos/).
- [Google SRE Workbook: ejemplo de documento de SLO](https://sre.google/workbook/slo-document/).

Fuentes consultadas el 24 de octubre de 2026. Los valores son ilustrativos y la medida está definida para este fixture.
