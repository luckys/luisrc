---
id: INC-MITIGATION
title: 'Mitigar un incidente: reducir el daño y comprobar la recuperación del usuario'
published: 2026-10-25T08:01:00Z
locale: es
translationKey: incident-response-mitigation-recovery
slug: mitigar-incidente-verificar-recuperacion
draft: true
status: draft
level: intermedio
prerequisites: [P061]
description: 'Separa contención, mitigación, recuperación y prevención. Un ejercicio local conserva los IDs pendientes, verifica sus resultados y comprueba trabajo nuevo antes de dar por restaurado el recorrido.'
author: 'Luis Ramírez Calle'
series: 'Responder a incidentes: de la señal a una mejora verificada'
tags: [incidentes, mitigacion, recuperacion, sre]
---

El comando para restaurar la configuración respondió correctamente. La cola, sin embargo, puede seguir atascada o haber perdido trabajo. Un ACK prueba que una operación de control fue aceptada, no que los usuarios hayan recuperado lo que necesitaban.

La recuperación exige volver a observar el resultado del servicio. En un proceso asíncrono eso incluye trabajo anterior y solicitudes nuevas, no solo que el endpoint responda.

Continuamos [el incidente del lote cero](/posts/incidentes-triage-sintomas-hipotesis-evidencia): tres informes aceptados siguen pendientes mientras la API y el worker permanecen vivos. Los datos son ficticios y la ejecución ocurre solo en procesos locales propios.

## Contener, mitigar y prevenir son decisiones diferentes

La **contención** limita el daño o la exposición mientras investigamos. La **mitigación** reduce el impacto del fallo. La **prevención** cambia alguna condición para disminuir la probabilidad o el alcance de una recurrencia.

En el ejercicio, pausar la admisión contiene el crecimiento de trabajo. Restaurar `batchSize = 2` permite que la cola vuelva a procesarse. Rechazar configuraciones cero mediante una ruta validada es un candidato preventivo.

No necesitamos esperar a desplegar ese candidato para recuperar los trabajos. Tampoco debemos confundir «volvió a procesar» con «ya no puede volver a ocurrir».

## Pausar entrada también tiene un coste visible

La API deja de aceptar trabajo nuevo y responde 503 a una petición de prueba. No borra los cinco IDs ya aceptados: dos completados antes del fallo y tres pendientes.

Eso mejora una dimensión y empeora otra. Limita la acumulación, pero una solicitud nueva no obtiene aceptación. El incidente no desaparece porque hayamos detenido la fuente de crecimiento.

En otro sistema habría que decidir cómo comunicar el rechazo y si el cliente puede reintentar sin repetir efectos. Aquí no hay retries, proveedor o contrato de idempotencia; no presentamos ese 503 como una solución general al comportamiento del cliente.

<img src="/assets/visuals/incident-response/INC-MITIGATION.svg" alt="Se pausa admisión con rechazo explícito, se restaura un lote positivo bajo revisión esperada, se drenan los mismos IDs comprobando resultados y después se reabre para probar trabajo nuevo sin confundir recuperación y prevención." width="359" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/incident-response/INC-MITIGATION.svg).

## Cambiar una cosa que podamos relacionar con el resultado

Restauramos el tamaño de lote, sin reiniciar procesos ni modificar a mano los estados de los jobs. El cambio lleva la revisión de configuración que acabamos de observar.

Si alguien hubiera cambiado esa revisión, el control lo rechazaría. Releer el estado es más seguro que forzar una escritura basada en información antigua. El mecanismo se explica con más detalle en [el runbook](/posts/runbooks-precondiciones-pasos-salida-segura).

Cambiar simultáneamente versión, recursos, configuración y datos podría recuperar el servicio, pero dificultaría saber qué intervención ayudó y qué riesgo nuevo introdujimos. En una emergencia puede ser necesario; precisamente por eso hay que registrar qué se hizo.

## Verificar el trabajo anterior antes de reabrir

El harness espera cinco completados y cero pendientes mientras la admisión sigue pausada. Además, compara la lista de IDs con la lista original aceptada.

Extracto de `scripts/exercise.mjs`:

```javascript
  const drained = await waitUntil(origin, (s) => s.completed === 5 && s.queued === 0)
  assert.equal(drained.admissionOpen, false)
  assert.deepEqual(drained.jobs.map((j) => j.id), [...baselineJobs, ...stalledJobs].map((j) => j.id))
```

La cola vacía, por sí sola, no bastaría: también podría haberse vaciado borrando registros. Conservar las identidades distingue recuperación de pérdida silenciosa en este caso.

Después comprobamos el contenido esperado `report:<id>` y el contador de intentos de cada trabajo. No nos limitamos al HTTP 200 de una consulta de estado.

## Probar también trabajo nuevo

Una vez drenado lo anterior, reabrimos admisión y enviamos dos informes nuevos. El resultado final contiene siete completados, cero pendientes y una petición rechazada durante la contención.

La prueba final revisa cada payload:

```javascript
  for (const job of final.jobs) { assert.equal(job.result, `report:${job.id}`); assert.equal(job.attempts, 1) }
```

Eso no demuestra **exactly-once**. No se han probado redelivery, crashes o efectos externos. Solo demuestra que, en este recorrido local, los siete trabajos aceptados tienen el resultado y número de intentos esperados.

<img src="/assets/interactive/incident-response/recovery.svg" alt="Capturas del ejercicio real local muestran dos completados y tres pendientes durante el fallo, cinco completados al drenar y siete tras probar trabajo nuevo; son recuentos observados de un incidente sintético, no tiempos de respuesta humanos." width="380" height="380" loading="lazy" style="width:100%;height:auto" />

La gráfica representa capturas sucesivas y recuentos acumulados. No es un benchmark ni describe el tiempo que tardaría un equipo de guardia en resolver una incidencia.

## No cerrar el análisis al recuperar el servicio

La ruta legacy sigue admitiendo cero después de restaurar el valor positivo. Por eso el ejercicio activa también el camino de validación corregido e intenta introducir el mismo valor inválido.

La operación se rechaza y conserva la configuración vigente. Es una comprobación preventiva adicional. Su activación ocurre **en el mismo binario del fixture**; no hemos desplegado una versión corregida a un clúster.

Otras mejoras siguen abiertas: observación de progreso, alertas operativas y durabilidad. Recuperar estos trabajos no demuestra que sobrevivan a un reinicio.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/inc-mitigation/README.md) y [ejercicio completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/scripts/exercise.mjs):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/incident-response exercise
pnpm --filter @luisrc-examples/incident-response verify
```

`verify` comprueba los hashes de las fuentes y la evidencia archivada. No vuelve a introducir el incidente: para repetir el recorrido se ejecuta `exercise`.

## Garantías y límites

Se han observado contención, cambio de configuración, drenaje y trabajo nuevo por HTTP/IPC reales. Los jobs solo existen en memoria. No hay almacenamiento durable, rollback de esquema, usuario de producción o prueba de una intervención humana.

El criterio de salida debe corresponder al servicio. En otro caso incluiría efectos externos, datos o resultados inciertos que este fixture no representa. Ninguna lista de checks genérica sustituye esas condiciones.

## Ejercicio: una cola vacía que no significa recuperación

Construye una variante que elimine los pendientes y devuelva una cola vacía. La prueba debe rechazarla porque faltan IDs o resultados. Después explica qué verificación equivalente necesitarías si los efectos estuvieran en un sistema externo.

Seguimos con [runbooks y precondiciones de seguridad](/posts/runbooks-precondiciones-pasos-salida-segura).

## Referencias

- [Google SRE: triage y mitigación](https://sre.google/sre-book/effective-troubleshooting/).
- [Google SRE Workbook: resolver y gestionar incidentes](https://sre.google/workbook/incident-response/).
- [Google SRE: emergency response](https://sre.google/sre-book/emergency-response/).

Fuentes consultadas el 25 de octubre de 2026. Los resultados corresponden al fixture, no a una garantía de recuperación de producción.
