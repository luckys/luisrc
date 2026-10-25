---
id: INC-RUNBOOKS
title: 'Runbooks: convertir una receta de comandos en decisiones con límites'
published: 2026-10-25T08:02:00Z
locale: es
translationKey: incident-response-safe-runbooks
slug: runbooks-precondiciones-pasos-salida-segura
draft: true
status: draft
level: intermedio
prerequisites: [INC-MITIGATION, OPS-DELIVERY]
description: 'Diseña un runbook con alcance, precondiciones, riesgo, resultado esperado y criterios de parada. El fixture prueba identidad de instancia y revisión de configuración sin borrar trabajo.'
author: 'Luis Ramírez Calle'
series: 'Responder a incidentes: de la señal a una mejora verificada'
tags: [runbooks, operaciones, incidentes, seguridad]
---

«Reinicia el worker y comprueba que está bien» parece un procedimiento hasta que hay varios workers, una cola volátil y ninguna definición de «bien». El comando puede funcionar y el resultado ser el contrario de lo que necesitábamos.

Un **runbook** tiene que ayudar a decidir cuándo una acción es aplicable, sobre qué objetivo y con qué comprobación. Una lista de comandos sin esas fronteras deja el trabajo difícil a quien menos contexto puede tener en ese momento.

Después de [recuperar los informes sin borrarlos](/posts/mitigar-incidente-verificar-recuperacion), vamos a describir y probar ese procedimiento. Amplía la introducción a [operación y runbooks](/posts/docker-ci-despliegues-runbooks), sin convertir el fixture en una herramienta de administración de producción.

## Un paso necesita precondición, acción y salida esperada

El runbook del laboratorio, `docs/runbook.md`, separa siete decisiones. Empieza por confirmar la instancia y el estado; después delimita impacto, contiene entrada, contrasta la hipótesis, mitiga, verifica y conserva seguimiento.

No todos esos pasos son escrituras. Leer y guardar estado antes de modificarlo permite saber qué revisión vimos y comparar el resultado. También evita que un cambio aparentemente inofensivo destruya la evidencia necesaria para investigar.

Para cada intervención hay que poder responder: ¿qué espero observar si funcionó?, ¿qué dato me obliga a parar?, ¿qué trabajo puede perderse?, ¿quién puede autorizarla? Si las respuestas dependen del servicio, deben estar en su procedimiento, no suponerse universales.

## Scope: actuar en la instancia correcta

El harness crea una instancia con un identificador y procesos hijos propios. Los cambios deben referirse a ese identificador. La función de `src/config.ts` comprueba coincidencia exacta:

```typescript
export function requireScope(expected: string, actual: string) {
  if (!expected || expected !== actual) throw new Error('fixture scope mismatch')
}
```

El ejercicio intenta un cambio con otro identificador y comprueba que se rechaza. No interpreta «hay algún proceso parecido» como autorización para actuar sobre él.

Ese identificador **no es una credencial**. La función evita confusiones dentro del fixture, pero no autentica personas ni concede permisos. El control viaja por IPC privado desde el harness; no se ha implementado un plano administrativo seguro para la red.

El principio se mantiene en sistemas mayores: comprobar cuenta, región, namespace o recurso reduce errores de alcance, pero no sustituye el control de acceso.

<img src="/assets/visuals/incident-response/INC-RUNBOOKS.svg" alt="El procedimiento confirma una instancia propia y configuración observada, describe riesgo y resultado esperado, se detiene si cambia la revisión y verifica un criterio de salida sin forzar cambios o borrar la cola." width="362" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/incident-response/INC-RUNBOOKS.svg).

## Una lectura antigua no debe autorizar una escritura nueva

El runbook restaura el lote positivo usando `expectedRevision`, la versión que acaba de observar. Si otro cambio se adelantó, la revisión ya no coincide y la operación se rechaza.

Implementación de `src/config.ts`:

```typescript
export function applyConfig(current: Config, input: { batchSize?: number; guarded?: boolean; expectedRevision: number }): Config {
  if (input.expectedRevision !== current.revision) throw new Error('configuration changed; inspect again')
  const guarded = input.guarded ?? current.guarded
  const candidate = input.batchSize ?? current.batchSize
  const batchSize = guarded ? validatedBatchSize(candidate) : legacyBatchSize(candidate)
  return { batchSize, guarded, revision: current.revision + 1 }
}
```

Primero comprobamos la revisión y validamos la candidata. Solo después construimos el nuevo valor. Si la validación falla, el objeto vigente no se modifica parcialmente.

En este worker, las operaciones de configuración se atienden en un proceso. No estamos demostrando un compare-and-swap distribuido ni un lock global. La precondición tiene un alcance concreto y probado.

## La condición de parada también forma parte del procedimiento

Un rechazo por revisión antigua no se resuelve quitando la comprobación. El siguiente paso es releer y decidir si la restauración sigue siendo apropiada.

Si la cola no drena después del cambio, el harness falla por timeout. Las capturas anteriores quedan en `.artifacts/checkpoint.json`, marcado como registro parcial. La escritura no promete persistencia atómica frente a un corte durante ese paso. Ese timeout limita el ejercicio; no define un SLO ni demuestra que un sistema de producción esté irrecuperable.

En un runbook operativo, otros motivos de parada pueden ser falta de permisos, datos contradictorios, efectos externos inciertos o una dependencia fuera del alcance del equipo. Explicar cómo escalar es más útil que incluir un `--force` como respuesta por defecto.

## Un rollback puede ser otro cambio con riesgos

Aquí restaurar el valor dos es acotado porque conocemos la configuración previa y no hemos cambiado el formato de los datos. No generalizamos esa facilidad a cualquier rollback.

Una versión anterior puede ser incompatible con un esquema nuevo. Un proceso reiniciado puede perder memoria. Un job repetido puede volver a producir un efecto externo. Por eso el procedimiento no manda «volver atrás» sin identificar qué estado se ha modificado.

El fixture decide no reiniciar para conservar su cola volátil. En otro sistema, reiniciar puede ser la mitigación correcta, pero exigiría otras garantías y verificaciones. Un runbook no debe convertir la decisión de un caso en una prohibición universal.

## Ensayar el procedimiento permite encontrar huecos

El test HTTP comprueba que la admisión pausada rechaza una solicitud, que los trabajos anteriores permanecen y que la restauración vuelve a completar resultados. Los tests de configuración prueban scope incorrecto, revisión atrasada y una candidata inválida que no cambia el estado vigente.

Eso aporta más evidencia que revisar únicamente si los comandos tienen sintaxis válida. Sin embargo, la automatización tampoco prueba que otra persona pueda entender y ejecutar el procedimiento bajo presión.

Una revisión con alguien que no lo escribió puede descubrir supuestos ocultos: dónde obtener la revisión, cómo reconocer el recurso o qué resultado considerar anómalo. Este laboratorio no ha ejecutado ese ensayo humano; lo deja como trabajo distinto de los tests.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/inc-runbooks/README.md) y [runbook completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/docs/runbook.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/incident-response test
pnpm --filter @luisrc-examples/incident-response exercise
```

Los comandos parten del monorepo y operan únicamente sobre el fixture creado por el propio script. No hay que copiar una URL, un PID ajeno o un nombre de una base de datos real.

## Garantías y límites

El runbook se ha ejercitado automáticamente con HTTP/IPC y datos ficticios. No tiene aprobación de una organización ni se ha validado con un equipo de guardia. No contiene operaciones SQL, restauración durable o administración remota autenticada.

## Ejercicio: probar una precondición equivocada

Haz que otro control cambie la revisión entre la lectura y la restauración. El procedimiento debe detenerse sin forzar la escritura. Describe qué información necesitaría quien recibe la escalación para continuar sin repetir la investigación.

Seguimos con [on-call, coordinación y handoff](/posts/on-call-coordinacion-incidentes-handoff).

## Referencias

- [Google SRE: gestionar incidentes y conservar estado](https://sre.google/sre-book/managing-incidents/).
- [Google SRE Workbook: práctica de respuesta a incidentes](https://sre.google/workbook/incident-response/).
- [Google SRE: preparación de la respuesta de emergencia](https://sre.google/sre-book/emergency-response/).

Fuentes consultadas el 25 de octubre de 2026. Las precondiciones técnicas descritas están implementadas para esta instancia local.
