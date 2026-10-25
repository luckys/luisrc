---
id: CD-CANARY
title: 'Canary releases: comparar el candidato con un control antes de ampliar'
published: 2026-10-25T13:06:00Z
locale: es
translationKey: progressive-delivery-canary
slug: canary-releases-candidato-control-muestras
draft: true
status: draft
level: intermedio
prerequisites: [CD-BLUEGREEN, P060]
description: 'Asigna cohortes estables y compara el resultado de negocio con un control. Doscientas respuestas HTTP reales muestran una regresión invisible al status 200 y los límites de una muestra sintética.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [canary, release, metricas, experimentacion]
---

El canary recibe una pequeña parte del tráfico y no devuelve ningún error HTTP. Aun así, todos sus precios son incorrectos. Si el criterio para ampliar era «no aparecen respuestas 500», el rollout avanzaría con una regresión de negocio.

Un **canary** expone un cambio de forma parcial y evalúa su resultado antes de ampliarlo. El porcentaje limita la exposición prevista; la decisión necesita señales que distingan al candidato de un **control** comparable.

Usaremos el grupo green preparado en [blue-green](/posts/blue-green-deployments-trafico-base-datos) y el contrato del [smoke](/posts/smoke-tests-release-correcta-http-200). Los [SLI y SLO](/posts/sli-disponibilidad-latencia-eventos-elegibles) ayudan a elegir qué resultado observar, aunque el fixture no despliega un sistema de métricas de producción.

## La cohorte decide quién recibe el cambio

Podemos asignar por petición, instancia, usuario o tenant. La elección afecta a la experiencia y a cómo interpretamos los datos. Alternar variantes en cada petición puede dar a una misma persona comportamientos diferentes en un flujo de varias operaciones.

El router del laboratorio calcula un bucket estable entre cero y noventa y nueve. `src/rollout.ts` utiliza un hash:

```typescript
export function bucket(key: string) {
  return createHash('sha256').update(key).digest().readUInt32BE(0) % 100
}
```

`createHash` se importa de `node:crypto` en el archivo completo. La misma clave mantiene su bucket; cambiar el porcentaje no obliga a reasignar toda la población. Para el diez por ciento se eligen los buckets inferiores a diez.

El fixture recibe claves sintéticas en una cabecera. No son identidades autenticadas. Un servicio real tendría que elegir una clave estable y una frontera de confianza apropiada, en lugar de permitir que cualquier cliente decidiera su propia asignación cuando eso fuera relevante.

## Un porcentaje de cohortes no garantiza el mismo porcentaje de carga

Si asignas por usuario, un usuario muy activo puede generar muchas más peticiones que otro. El diez por ciento de claves no tiene por qué representar el diez por ciento de RPS, CPU o coste.

Aquí construimos una muestra **sintética estratificada**: dos claves para cada uno de los cien buckets. Cada clave hace una lectura del mismo producto. Eso produce exactamente veinte peticiones al candidato y ciento ochenta al control.

La selección sirve para comprobar el routing y el gate de forma repetible. No es una muestra aleatoria de usuarios reales ni una estimación de cómo se repartiría una población de producción.

## El control ayuda a separar una regresión de un problema compartido

El control usa la image estable en `a/b`; green usa la candidata. Ambos consultan el mismo PostgreSQL y el mismo producto ficticio. La flag se activa en la ruta: la release estable conserva las unidades, mientras la candidata ejecuta el divisor incorrecto.

Comparar los grupos ayuda a distinguir el cambio de un fallo que afecte a ambos. Si el control también empeora, quizá exista una caída común o un problema del entorno. El candidato puede seguir siendo defectuoso, pero esa comparación ya no permite atribuirle toda la diferencia con la misma claridad.

En producción también revisarías región, tipo de cliente, tamaño de operación y franjas de tráfico. Un candidato que solo atiende peticiones fáciles puede parecer mejor por la selección de su cohorte.

## Las respuestas observadas separan HTTP y corrección

Las doscientas respuestas fueron `200`. El control devolvió `10000` céntimos en sus ciento ochenta lecturas. El candidato devolvió `100` en las veinte suyas.

La fracción de resultados incorrectos de un grupo es:

`bad_rate = resultados_incorrectos / peticiones_observadas`

El control tiene `0 / 180 = 0 %`; el candidato, `20 / 20 = 100 %`. El agregado tendría un diez por ciento de precios incorrectos, mientras que la tasa de errores HTTP seguiría siendo cero.

<img src="/assets/visuals/progressive-delivery/CD-CANARY.svg" alt="Doscientas peticiones sintéticas asignadas por buckets generan veinte respuestas incorrectas del candidato y ciento ochenta correctas del control. Todas tienen status 200; el contrato del precio exige retirar el canary." width="325" height="440" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-CANARY.svg).

<img src="/assets/interactive/progressive-delivery/canary-outcomes.svg" alt="Control y candidato tienen un cien por ciento de HTTP 200. El control conserva ciento ochenta precios correctos de ciento ochenta; el candidato, cero de veinte. Es una muestra sintética y no una medición de usuarios reales." width="380" height="440" loading="lazy" style="width:100%;height:auto" />

Mirar solo el agregado perdería qué revisión produjo cada resultado. Por eso la captura conserva slot, revisión, bucket, precio y status de cada petición.

## El gate incluye ausencia de evidencia y control enfermo

Esta función de `src/rollout.ts` implementa la política didáctica:

```typescript
export function rolloutDecision(candidate: Sample, control: Sample) {
  for (const sample of [candidate, control])
    if (!Number.isSafeInteger(sample.total) || !Number.isSafeInteger(sample.bad)
      || sample.bad < 0 || sample.total < sample.bad) throw Error('invalid_sample')
  if (candidate.total < 20 || control.total < 20) return 'insufficient'
  if (control.bad / control.total > 0.01) return 'control_unhealthy'
  return candidate.bad / candidate.total > 0.01 ? 'rollback' : 'eligible_for_review'
}
```

`Sample` contiene los contadores `total` y `bad`. Menos de veinte observaciones en cualquiera de los grupos no da un resultado verde. Un control con más de un uno por ciento de fallos tampoco permite aprobar el candidato con esta regla.

El mínimo de veinte y el umbral del uno por ciento son decisiones **del fixture**. No son una justificación estadística ni una recomendación universal. Para fallos raros haría falta más observación; para daños graves, quizá una sola violación confirmada bastaría para detener la exposición.

`eligible_for_review` tampoco significa «promover automáticamente». Resume la regla que se ha satisfecho. Un rollout real puede exigir otras señales, tiempo de observación y condiciones de negocio.

## Retirar el canary necesita comprobar la recuperación

El gate devuelve `rollback` y el harness vuelve a seleccionar `a/b` con la flag apagada. Después ejecuta el smoke sobre esa ruta y exige los precios correctos.

La retirada no borra las respuestas equivocadas que ya se observaron. En este caso no cambiaron filas ni produjeron efectos externos. Si el fallo hubiera escrito datos, habría que evaluar su reparación por separado.

## Explorar cohortes y respuestas de la captura

<iframe src="/assets/interactive/progressive-delivery/explorer.html" title="Explorador de las fases del rollout y los resultados de control y candidato" width="100%" height="960" loading="lazy" style="border:1px solid #475569;border-radius:12px"></iframe>

El filtro del visor cambia entre todas las respuestas, candidato y control. Los contadores y la gráfica proceden de las peticiones archivadas. No dirige tráfico ni modifica flags.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-canary/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

## Garantías y límites

Se asignaron doscientas lecturas HTTP a slots reales y se verificaron los veinte resultados incorrectos del candidato, el control y la recuperación posterior. No es una simulación de respuestas, aunque la población y el fallo sean sintéticos.

No hay experimento con usuarios, significancia estadística, observación prolongada, análisis de latencia o controlador automático de producción. El resultado enseña el mecanismo y el fallo que el gate distingue.

## Ejercicio: decidir cuándo todavía no puedes decidir

Mantén el candidato sin fallos, pero reduce su muestra a tres peticiones. Después introduce errores tanto en candidato como en control. Explica por qué ninguno de esos resultados debería convertirse sin más en «candidato aprobado» y qué evidencia adicional necesitarías.

## Referencias

- [Google SRE: canaries, control y evaluación de releases](https://sre.google/workbook/canarying-releases/).
- [Node.js: createHash](https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options).
- [Google SRE: implementación de SLO](https://sre.google/workbook/implementing-slos/).

Fuentes consultadas el 25 de octubre de 2026.
