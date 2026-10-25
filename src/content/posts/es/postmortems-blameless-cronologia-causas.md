---
id: INC-POSTMORTEM
title: 'Postmortems sin culpables: reconstruir causas y decisiones sin reescribir el pasado'
published: 2026-10-25T08:04:00Z
locale: es
translationKey: incident-response-postmortem
slug: postmortems-blameless-cronologia-causas
draft: true
status: draft
level: intermedio
prerequisites: [INC-ONCALL]
description: 'Reconstruye un incidente con hechos, hipótesis y condiciones contribuyentes. Usa una cronología capturada y distingue el impacto observado de las conclusiones que todavía necesitan pruebas.'
author: 'Luis Ramírez Calle'
series: 'Responder a incidentes: de la señal a una mejora verificada'
tags: [postmortem, incidentes, fiabilidad, testing]
---

«Alguien cambió una configuración y se detuvo el servicio» identifica un momento de la historia, pero explica muy poco. No cuenta por qué se aceptó ese valor, qué parte dejó de avanzar o qué señales permitían reconocer el problema.

Un **postmortem** debe permitir entender esas relaciones y decidir qué mejorar. Para hacerlo necesita conservar lo que realmente se observó y reconocer las preguntas que siguen abiertas.

Después del [handoff y la coordinación](/posts/on-call-coordinacion-incidentes-handoff), reconstruiremos el incidente del lote cero. Es un caso sintético con HTTP y procesos locales reales. No es una caída de producción ni una transcripción de decisiones humanas.

## Qué debe explicar un postmortem

El documento necesita un alcance concreto: qué servicio se estudia, qué comportamiento se esperaba y qué impacto se pudo comprobar. Después relaciona la cronología con el mecanismo del fallo, las intervenciones y sus resultados.

En nuestro caso, la API acepta trabajos para generar un resultado `report:<id>`. Con un lote de dos, los dos primeros terminan. Tras aceptar cero como tamaño del lote, se admiten otros tres trabajos y ninguno progresa durante la observación, aunque la API responde y el worker sigue ejecutando ticks.

La contención rechaza una petición adicional con `503`. Restaurar el lote permite completar los cinco trabajos aceptados. Después se activa la validación y se completan otros dos.

Ese es el impacto que podemos describir: **tres trabajos aceptados retrasados durante el ejercicio y una petición rechazada por contención**. No conocemos pérdidas económicas, usuarios afectados o incumplimientos de un SLA. Añadirlos haría más dramático el relato y menos fiable el documento.

## Blameless significa investigar las condiciones de las decisiones

Un análisis **blameless**, sin búsqueda de culpables, intenta entender cómo pudo ocurrir el fallo con las herramientas, la información y los límites disponibles. Evita convertir «se introdujo cero» en «había que prestar más atención».

En el fixture conocemos el disparador porque lo aplica el propio script. En un incidente real habría que contrastar cambios, permisos y registros antes de atribuir una intervención. Tampoco conviene asumir que quien actuó disponía de la información que apareció después.

Eso no elimina la responsabilidad de corregir o revisar decisiones. La convierte en compromisos comprobables: qué se cambia, quién lo lleva y cómo se verificará. El seguimiento tendrá su [propio artículo](/posts/acciones-postmortem-regresion-evidencia-cierre).

## La cronología distingue observación e interpretación

El journal contiene once eventos. Cada uno registra un identificador, una fase, un orden, una fecha UTC y el tiempo transcurrido según el reloj monotónico del harness. El código que captura un evento está en `scripts/exercise.mjs`:

```javascript
async function record(id, phase, kind, facts) {
  events.push({ seq: events.length + 1, id, phase, kind, at: new Date().toISOString(), elapsedMs: performance.now() - start, facts })
  await saveCheckpoint(new URL('.artifacts/checkpoint.json', root), events)
}
```

`start` se obtiene con `performance.now()` al comenzar el ejercicio. `root` apunta al paquete y `saveCheckpoint` escribe el registro parcial. El script espera cada escritura antes de continuar; el archivo parcial se identifica como `checkpoint_not_final_report`.

La fecha UTC ayuda a situar la observación. `elapsedMs` sirve para comparar observaciones dentro de esta ejecución sin depender de ajustes del reloj de calendario. `seq` conserva su orden explícito.

Estos instantes corresponden al momento en que el harness registra respuestas. **No son el instante exacto de cada transición interna del worker**. Tampoco permiten calcular un tiempo de respuesta humano: el ejercicio toma decisiones automáticamente.

<img src="/assets/visuals/incident-response/INC-POSTMORTEM.svg" alt="El postmortem parte de hechos capturados, separa el mecanismo de sus condiciones contribuyentes y enlaza cada propuesta con una evidencia o una pregunta abierta." width="357" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/incident-response/INC-POSTMORTEM.svg).

## Una causa técnica necesita un mecanismo que podamos contrastar

La ruta legacy admite enteros desde cero. El worker selecciona trabajo con `pending.slice(0, batchSize)`. Si `batchSize` es cero, la selección está vacía aunque haya elementos pendientes.

La explicación conecta tres evidencias: el valor aceptado, el comportamiento del selector y la ausencia de intentos nuevos mientras aumentan los ticks. Restaurar un valor positivo drena la misma cola y aporta una comprobación adicional.

En cambio, que el proceso responda a `/live` solo demuestra liveness de la API. No demuestra que el trabajo aceptado termine. Esa diferencia ayuda a entender por qué una comprobación demasiado limitada puede ocultar el síntoma de negocio.

Conviene separar el **disparador** del **mecanismo** y de las **condiciones contribuyentes**. El disparador es aplicar cero; el mecanismo es seleccionar un lote vacío; entre las condiciones del fixture están la validación permisiva y la falta de una alerta instalada que detecte ausencia de progreso. Cambiar únicamente el texto del runbook no corrige todas ellas.

## El registro permite revisar la explicación

El visor reproduce los eventos archivados. Puedes filtrar fases, revisar los datos capturados y localizar las pruebas de recuperación. No envía comandos ni ejecuta otro incidente.

<iframe src="/assets/interactive/incident-response/explorer.html" title="Cronología del incidente sintético y evidencias de recuperación" width="100%" height="920" loading="lazy" style="border:1px solid #475569;border-radius:12px"></iframe>

[Abrir el visor de la cronología](/assets/interactive/incident-response/explorer.html).

Un campo ausente aparece como **No capturado**. Por ejemplo, un ACK de configuración no incluye necesariamente todos los contadores de la cola. Rellenarlo con el estado anterior mezclaría observaciones distintas y daría una precisión que no tenemos.

El verificador comprueba parte de la consistencia del archivo:

```javascript
for (const [i, e] of data.events.entries()) {
  assert.equal(e.seq, i + 1)
  assert.equal(e.kind, 'observed')
  if (i) assert.ok(e.elapsedMs >= data.events[i - 1].elapsedMs)
}
```

También compara hashes de las fuentes y contrasta los resultados esperados. Esto ayuda a detectar un archivo desactualizado o incoherente. No convierte el análisis redactado en una verdad demostrada automáticamente.

## Registrar lo que falta evita cerrar preguntas por cansancio

La cola vive en memoria. Ver siete resultados correctos no demuestra recuperación tras un crash, ausencia de pérdidas con reinicios o idempotencia de efectos externos. Ninguna de esas situaciones se ejecutó.

La ruta corregida ya está incluida en el mismo binario del fixture y se activa mediante configuración. Por tanto, el ejercicio tampoco prueba un deployment, un canary o un rollback de artefactos.

El postmortem generado conserva esas fronteras y deja abiertas las acciones sobre alertas y durabilidad. En un servicio real habría que añadir evidencia específica antes de declararlas resueltas.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/inc-postmortem/README.md), [ejercicio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/scripts/exercise.mjs) y [postmortem generado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/evidence/postmortem.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/incident-response test
pnpm --filter @luisrc-examples/incident-response exercise
pnpm --filter @luisrc-examples/incident-response verify
```

`exercise` genera una ejecución nueva. `verify` comprueba el archivo existente; no vuelve a contactar con la API. Los timestamps y PIDs cambian entre ejecuciones.

## Garantías y límites

Hay once observaciones obtenidas de HTTP y dos procesos distintos, con fuentes identificadas por hashes. El análisis causal está redactado a partir de ese caso. No hay usuarios reales, guardia humana, almacenamiento durable o medición de MTTR operativo. El checkpoint parcial no promete persistencia atómica frente a un corte durante la escritura.

## Ejercicio: encontrar una afirmación sin respaldo

Lee el postmortem generado y propón una afirmación que todavía no podamos sostener, como «un reinicio no perdería trabajos». Indica qué experimento y qué evidencia necesitarías para aceptarla. Mantén la pregunta abierta hasta ejecutar esa prueba.

Seguimos con [acciones y criterios de cierre](/posts/acciones-postmortem-regresion-evidencia-cierre).

## Referencias

- [Google SRE: finalidad y enfoque de los postmortems](https://sre.google/sre-book/postmortem-culture/).
- [Google SRE Workbook: prácticas de escritura y seguimiento](https://sre.google/workbook/postmortem-culture/).
- [Node.js: reloj de performance](https://nodejs.org/api/perf_hooks.html#performancenow).

Fuentes consultadas el 25 de octubre de 2026. El caso, sus cifras y el código pertenecen al laboratorio de esta serie.
