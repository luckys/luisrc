---
id: INC-ACTIONS
title: 'Acciones de un postmortem: cerrar una mejora con pruebas, no con una tarea marcada'
published: 2026-10-25T08:05:00Z
locale: es
translationKey: incident-response-actions
slug: acciones-postmortem-regresion-evidencia-cierre
draft: true
status: draft
level: intermedio
prerequisites: [INC-POSTMORTEM, P055]
description: 'Convierte las conclusiones de un incidente en acciones verificables. Separa prevención, detección y recuperación, prueba la regresión y conserva abiertas las garantías que el laboratorio todavía no demuestra.'
author: 'Luis Ramírez Calle'
series: 'Responder a incidentes: de la señal a una mejora verificada'
tags: [postmortem, regresion, testing, fiabilidad]
---

«Mejorar la validación» puede permanecer meses en una lista sin que nadie sepa cuándo darlo por terminado. Incluso con una tarea cerrada, el mismo valor inválido podría seguir deteniendo el worker.

Una acción útil describe el comportamiento que cambiará y la evidencia necesaria para aceptarlo. Así se puede revisar el resultado sin depender de la memoria de quien hizo la corrección.

Después del [postmortem del lote cero](/posts/postmortems-blameless-cronologia-causas), cerraremos dos acciones dentro del fixture y mantendremos otras dos abiertas. Todas pertenecen a un caso sintético; los responsables son etiquetas ficticias.

## Una acción necesita un resultado observable

La primera propuesta es rechazar cero como tamaño del lote. Podríamos escribir «añadir un `if`», pero eso describe una implementación y deja fuera preguntas importantes: ¿qué valores se aceptan?, ¿se conserva la configuración si el cambio falla?, ¿sigue funcionando el trabajo válido?

El criterio de **A01** exige rechazar cero, conservar el lote y la revisión anteriores y seguir completando nuevos trabajos. El comportamiento puede comprobarse aunque más adelante cambie la implementación.

Además del criterio, `docs/actions.json` incluye un identificador, una categoría, un responsable, una fecha de revisión, un estado y una referencia de evidencia. La fecha sirve para volver sobre la acción; no afirma que alguien haya acordado realmente ese compromiso.

Un responsable facilita el seguimiento y la coordinación. No convierte a esa persona en culpable del incidente ni obliga a que resuelva la mejora sin ayuda.

## Prevención, detección y recuperación responden a preguntas diferentes

El registro separa cuatro acciones. **A01** previene el valor inválido; **A02** propone detectar edad pendiente y ausencia de progreso; **A03** comprueba una recuperación que preserve trabajo; **A04** deja pendiente decidir durabilidad y probar un crash.

A01 y A03 tienen estado `verified_in_fixture`. A02 y A04 permanecen `open`. Rechazar cero no instala una alerta, y drenar una cola en memoria no demuestra que sobreviva a la caída del proceso.

Esta separación evita que una corrección pequeña parezca resolver toda la fiabilidad del servicio. También permite priorizar: una mejora de detección puede reducir el tiempo hasta intervenir aunque todavía no elimine el mecanismo del fallo.

<img src="/assets/visuals/incident-response/INC-ACTIONS.svg" alt="Cada acción relaciona responsable, criterio y prueba. La prevención del lote cero y la recuperación se verifican en el fixture; alertas y durabilidad permanecen abiertas." width="355" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/incident-response/INC-ACTIONS.svg).

## La regresión empieza demostrando el comportamiento incorrecto

La prueba legacy muestra que cero se acepta y que `slice(0, 0)` selecciona una lista vacía con trabajos pendientes. Ese contraejemplo explica por qué hace falta la corrección.

La nueva validación de `src/config.ts` restringe el tamaño a enteros entre uno y dieciséis:

```typescript
export function validatedBatchSize(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 16) throw new RangeError('batchSize must be integer 1..16')
  return value
}
```

El límite superior es una política didáctica del fixture. En otro servicio habría que justificarlo con capacidad y comportamiento reales. El mínimo de uno evita que una configuración aparentemente aceptada suspenda silenciosamente todo el trabajo.

Las pruebas incluyen cero, negativos, fracciones, `NaN`, infinito y un entero por encima del máximo. También conservan ejemplos válidos:

```javascript
  for (const size of [1, 2, 16]) assert.equal(validatedBatchSize(size), size)
  for (const size of [0, -1, 1.5, NaN, Infinity, 17]) assert.throws(() => validatedBatchSize(size))
```

Rechazar entradas incorrectas es solo una parte de la regresión. Si el arreglo rechazara todos los tamaños, estas pruebas de valores válidos fallarían. La prueba de `applyConfig` añade otra condición: un rechazo no debe modificar la configuración anterior.

## Una prueba de función y una recuperación por HTTP se complementan

El test unitario permite aislar el contrato del valor. El ejercicio añade procesos y cola reales: pausa admisión, conserva los cinco identificadores aceptados, restaura el lote y espera sus resultados antes de reabrir.

Después activa la ruta validada, intenta aplicar cero y comprueba que la revisión sigue intacta. Por último, admite otros dos trabajos y verifica los siete resultados `report:<id>`.

Esa secuencia aporta evidencia para A03. No basta con ver que `/live` responde o recibir un ACK al cambiar configuración. La recuperación se observa sobre trabajos aceptados y nuevos, con sus identificadores y resultados.

Los siete trabajos tienen un intento en esta ejecución. Eso describe lo observado; **no demuestra exactly-once**, entrega durable o ausencia de duplicados frente a fallos que no hemos provocado.

## El estado de cierre necesita apuntar a una prueba concreta

El helper de revisión exige una referencia a un resultado verdadero para aceptar `verified_in_fixture`. Un nombre de archivo o un campo `owner` no bastan. Las pruebas de `src/review.ts` lo contrastan:

```javascript
  const action = { id: 'A01', owner: 'fixture-owner', criterion: 'zero rejected', state: 'verified_in_fixture', proof: 'guard_rejects_zero' }
  assert.equal(actionHasEvidence(action, {}), false)
  assert.equal(actionHasEvidence(action, { guard_rejects_zero: false }), false)
  assert.equal(actionHasEvidence(action, { guard_rejects_zero: true }), true)
  assert.equal(actionHasEvidence({ ...action, owner: '' }, { guard_rejects_zero: true }), false)
```

Ese booleano procede de las aserciones del ejercicio. El verificador compara además las fuentes por hash y comprueba el archivo de eventos. El helper por sí solo no puede saber si una prueba fue honesta, suficiente o relevante para producción: alguien podría fabricar el objeto de entrada.

Por eso hay que revisar la evidencia enlazada y el alcance del criterio. Un check documental reduce errores de seguimiento, pero no sustituye una revisión técnica.

## Qué falta antes de cerrar alertas o durabilidad

A02 necesita definir la señal de falta de progreso, observarla y comprobar el recorrido de la notificación hasta una persona o sistema responsable. El fixture no ha instalado ese recorrido. Escribir un nombre de alerta en el postmortem no lo ejecuta.

A04 requiere decidir dónde conservar el trabajo y qué significa recuperarlo. Después habría que provocar una caída en un punto relevante, reiniciar y contrastar trabajos aceptados, resultados y posibles duplicados. Añadir una base de datos sin ese experimento tampoco demostraría la garantía.

En producción se suman otras fronteras: desplegar la corrección, comprobar versiones activas, observar el comportamiento y disponer de recuperación si el cambio falla. Aquí la ruta validada ya estaba incluida en el binario; solo se activó. **El cierre se limita al fixture**.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/inc-actions/README.md), [acciones y criterios](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/docs/actions.json) y [pruebas de configuración](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/incident-response/tests/config.test.mjs):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/incident-response test
pnpm --filter @luisrc-examples/incident-response typecheck
pnpm --filter @luisrc-examples/incident-response exercise
pnpm --filter @luisrc-examples/incident-response verify
```

El [visor de evidencias](/assets/interactive/incident-response/explorer.html) permite saltar de A01 y A03 a los eventos que respaldan su estado. Las otras dos acciones siguen visibles sin un botón que simule una prueba inexistente.

## Garantías y límites

El laboratorio verifica validación, conservación de configuración y una recuperación local con siete resultados. No despliega artefactos, instala alertas, crea tickets o contacta con responsables. Tampoco prueba persistencia, reinicios o efectos externos. Los nombres y fechas del seguimiento son ejemplos redactados.

## Ejercicio: un arreglo que falla de otra manera

Cambia temporalmente el validador para rechazar también uno. Ejecuta los tests y localiza la expectativa que detecta el defecto. Restaura el código y vuelve a generar la evidencia antes de compararla con los hashes archivados.

Para continuar, el siguiente bloque del roadmap es **P062**, sobre entornos reproducibles con Docker. Allí habrá que distinguir construir un artefacto, ejecutarlo y comprobar que el servicio está preparado para recibir trabajo.

## Referencias

- [Google SRE Workbook: revisión de acciones de un postmortem](https://sre.google/workbook/postmortem-culture/).
- [Google SRE: análisis y prevención de recurrencias](https://sre.google/sre-book/postmortem-culture/).

Fuentes consultadas el 25 de octubre de 2026. Los criterios y resultados concretos corresponden al laboratorio de esta serie.
