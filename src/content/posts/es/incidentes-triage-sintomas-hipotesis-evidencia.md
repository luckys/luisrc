---
id: P061
title: 'Triage de incidentes: separar el síntoma, la hipótesis y lo que sabemos'
published: 2026-10-25T08:00:00Z
locale: es
translationKey: incident-response-triage-evidence
slug: incidentes-triage-sintomas-hipotesis-evidencia
draft: true
status: draft
level: intermedio
prerequisites: [P059, P060]
description: 'Delimita impacto, distingue liveness y progreso y contrasta hipótesis con evidencia. Un fixture HTTP con worker separado reproduce trabajos bloqueados por una configuración aceptada incorrectamente.'
author: 'Luis Ramírez Calle'
series: 'Responder a incidentes: de la señal a una mejora verificada'
tags: [incidentes, sre, troubleshooting, observabilidad]
---

La API responde al healthcheck y acepta trabajos con 202, pero los informes no aparecen. Reiniciar todos los procesos puede parecer una respuesta rápida. Si la cola solo vive en memoria, también puede borrar el trabajo que necesitamos recuperar.

El **triage** empieza por entender qué está afectado y qué decisión necesita prioridad. No exige resolver toda la causa antes de actuar, pero sí evitar que una suposición se convierta en un cambio peligroso.

Después de [definir condiciones de alerta](/posts/alertas-multi-window-burn-rate-accionables), esta serie aborda la respuesta. Usaremos un incidente **sintético**, ejecutado con HTTP real y un worker local en otro proceso. No hubo usuarios de producción ni una guardia humana avisada.

## Un síntoma no es todavía una explicación

El síntoma observable es «hay trabajos aceptados que no terminan». «El worker se ha muerto» es una hipótesis. «Hay que reiniciarlo» es una acción propuesta. Son tres afirmaciones distintas y necesitan evidencia diferente.

Conviene registrarlas por separado. Si escribimos «worker muerto» como primer hecho, podemos interpretar todas las observaciones posteriores para encajarlas en esa explicación. Un proceso puede seguir vivo y no realizar trabajo útil.

Tampoco el número de alertas equivale al impacto. Cinco avisos pueden describir una misma degradación; una única señal puede representar miles de operaciones afectadas. En el fixture contamos identidades aceptadas y pendientes, no notificaciones.

## Triage: alcance, urgencia y riesgo de la siguiente acción

Las primeras preguntas son concretas: qué operación falla, desde cuándo se observa, qué solicitudes siguen funcionando y si el problema continúa creciendo.

Después necesitamos saber qué podemos cambiar con seguridad. Pausar entradas puede limitar la cola, pero hará que nuevas solicitudes fallen explícitamente. Reiniciar puede recuperar un proceso, pero también perder estado volátil o repetir efectos. No todas las mitigaciones tienen el mismo coste.

La severidad depende de la política y el contexto del servicio. No asignamos una categoría de producción a tres trabajos ficticios. Sí registramos su alcance: tres aceptados sin progreso durante la observación y, más adelante, una petición rechazada para contener entrada.

## El laboratorio tiene tres componentes con responsabilidades distintas

El **harness** crea y controla únicamente sus procesos hijos. La **API** recibe HTTP en loopback y transmite trabajos por IPC. El **worker** mantiene una cola en memoria y selecciona un lote en cada tick.

El control de configuración también viaja por canales privados del fixture. No hay un endpoint de administración publicado que permita cambiar cualquier servicio.

<img src="/assets/visuals/incident-response/P061.svg" alt="El harness crea una API hija y observa HTTP y control IPC; la API se comunica por IPC con su worker hijo, cuyo lote cero deja tres trabajos pendientes aunque la API acepte peticiones y el bucle siga vivo." width="339" height="602" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/incident-response/P061.svg).

El ejercicio comienza con dos informes completados. Después aplica `batchSize = 0` mediante el validador legacy, que acepta enteros entre cero y dieciséis. La API acepta tres trabajos más, pero el selector no toma ninguno.

Extracto de `src/config.ts`:

```typescript
export function selectBatch<T>(pending: readonly T[], batchSize: number): T[] {
  return pending.slice(0, batchSize)
}
```

`slice(0, 0)` devuelve un array vacío aunque la entrada contenga elementos. El fallo no es que TypeScript permita escribir esa sintaxis: es que el contrato de configuración admite un valor incompatible con el progreso esperado.

## Contrastar hipótesis sin inventar componentes

La investigación del fixture combina cuatro observaciones:

<div role="region" aria-label="Hipótesis y observaciones del incidente" tabindex="0" style="overflow-x:auto">

| Hipótesis | Observación | Qué permite concluir aquí |
| --- | --- | --- |
| No llegó trabajo | Tres IDs están aceptados y pendientes | Hay trabajo disponible en esta instancia |
| El bucle no se ejecuta | Los ticks avanzan en capturas posteriores | El bucle sigue ejecutándose |
| Los jobs fallan al procesarse | Los intentos no aumentan | No se están iniciando esos trabajos |
| El lote cero evita seleccionar | Configuración cero y selector vacío | Hay un mecanismo reproducible para la falta de progreso |

</div>

Los ticks no prueban por sí solos que todo el proceso esté sano. Los intentos estables tampoco descartan cualquier bloqueo imaginable. La conclusión gana fuerza al combinar señales con el código y comprobar que restaurar un lote positivo drena los mismos trabajos.

No atribuimos el problema a una base de datos lenta: este fixture no tiene base de datos. Conocer los componentes evita buscar una causa en una dependencia que ni siquiera participa.

## Una observación acotada no demuestra ausencia de progreso para siempre

El harness captura la cola y espera a que transcurran al menos tres ticks adicionales del worker. Comprueba que siguen pendientes los mismos trabajos y que el contador de intentos no aumenta.

Eso demuestra el comportamiento durante esa observación, no una ley inferida de un timeout arbitrario. El mecanismo del selector explica por qué seguirá ocurriendo mientras se conserve esa configuración.

La diferencia importa fuera del laboratorio: «no lo vi terminar en diez segundos» puede significar bloqueo, trabajo lento, señal atrasada o una expectativa incorrecta. Antes de declarar una causa, conviene saber qué evidencia distinguiría esas alternativas.

## No esperar una certeza perfecta para contener daño

Investigar y mitigar pueden avanzar en paralelo, con responsables y cambios coordinados. Si la cola sigue creciendo, limitar entrada puede ser razonable antes de tener una explicación completa.

Pero el cambio necesita alcance, riesgo conocido y una comprobación posterior. No basta con «hacer algo». El siguiente artículo recorrerá esa mitigación sin borrar trabajos ni dar por recuperado el servicio al recibir un ACK.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p061/README.md) y [selector y validadores](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/src/config.ts):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/incident-response test
pnpm --filter @luisrc-examples/incident-response exercise
```

`exercise` crea la instancia, reproduce el fallo, aplica cambios acotados, guarda evidencia y cierra sus procesos. No acepta una URL de producción como argumento. La cronología queda en `evidence/incident.json` y su informe en `evidence/postmortem.md`.

## Garantías y límites

El incidente es artificial, pero HTTP, los procesos y las respuestas observadas son reales. No probamos carga, persistencia, una dependencia externa o una caída de producción. El healthcheck solo responde por la API; no constituye un SLI de resolución.

## Ejercicio: una hipótesis que puedas refutar

Añade al registro una hipótesis alternativa sobre la falta de progreso. Especifica qué observarías si fuese cierta y qué dato la refutaría. Si necesitas introducir una dependencia nueva para probarla, deja claro que cambiaste el sistema del experimento.

Seguimos con [contención y verificación de la recuperación](/posts/mitigar-incidente-verificar-recuperacion).

## Referencias

- [Google SRE: effective troubleshooting](https://sre.google/sre-book/effective-troubleshooting/).
- [Google SRE Workbook: incident response](https://sre.google/workbook/incident-response/).
- [Google SRE: gestión de incidentes](https://sre.google/sre-book/managing-incidents/).

Fuentes consultadas el 25 de octubre de 2026. La explicación del lote cero está respaldada por este fixture, no por una incidencia de una empresa real.
