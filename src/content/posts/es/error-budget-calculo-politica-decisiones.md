---
id: SLO-BUDGET
title: 'Error budgets: calcular el margen de fallo y acordar qué hacer cuando se agota'
published: 2026-10-24T08:03:00Z
locale: es
translationKey: service-objectives-error-budget-policy
slug: error-budget-calculo-politica-decisiones
draft: true
status: draft
level: intermedio
prerequisites: [SLO-WINDOWS]
description: 'Calcula eventos malos permitidos, consumo y deuda con un denominador explícito. Distingue presupuesto por eventos y tiempo, y define una política de cambios sin automatismos engañosos.'
author: 'Luis Ramírez Calle'
series: 'Fiabilidad medible: de los SLI a las alertas de presupuesto'
tags: [sre, slo, error-budget, fiabilidad]
---

El servicio incumple su objetivo y el equipo discute si puede desplegar otra funcionalidad. Un porcentaje rojo no decide por sí solo qué riesgo asumir, quién aprueba una excepción o qué trabajo de fiabilidad tiene prioridad.

Un **error budget** convierte el objetivo en un margen de eventos malos. Para que sirva a una decisión, necesita acompañarse de una política acordada antes de la discusión.

Después de [elegir la ventana y comprobar su cobertura](/posts/slo-ventanas-rolling-calendario-datos-ausentes), ya podemos calcular ese margen sin cambiar silenciosamente qué observamos.

## El presupuesto sale del objetivo y del denominador

Para un SLO por eventos, con objetivo `S` y `N` observaciones elegibles:

```text
malos permitidos = N × (1 − S)
restante = malos permitidos − malos observados
fracción consumida = malos observados / malos permitidos
```

Con un millón de eventos y un objetivo del 99.9 %, permitimos mil eventos malos. Si observamos mil doscientos, el presupuesto restante es **−200** y hemos consumido el 120 %.

No recortamos ese restante a cero. Mostrar cero tanto cuando acabamos de agotar el margen como cuando lo superamos diez veces oculta información relevante para priorizar.

El presupuesto tampoco es una cuota para provocar errores deliberadamente. Resume el margen acordado para fallos inevitables y riesgo de cambios. No implica que todos los fallos tengan el mismo impacto humano aunque pesen igual en este indicador.

<img src="/assets/visuals/service-objectives/SLO-BUDGET.svg" alt="Un objetivo del 99.9 por ciento sobre un millón permite mil eventos malos; observar mil doscientos deja una deuda de doscientos que se conserva y se interpreta mediante una política con responsables y excepciones." width="318" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/service-objectives/SLO-BUDGET.svg).

## Evitar que la representación numérica cambie la frontera

El laboratorio representa el target en **parts per million**, PPM: `999000` representa 99.9 %. Así, la tolerancia es exactamente `1000 / 1000000` en el contrato de entrada.

No convierte todos los cálculos en aritmética decimal exacta. Sí evita depender de una resta como `1 - 0.999` para decidir el cumplimiento en el límite. La comprobación compara productos de enteros seguros.

Extracto de `src/budget.ts`:

```typescript
  const allowed = total * (SCALE - targetPpm) / SCALE
  return {
    total, bad, allowed, remaining: allowed - bad,
    sli: total === 0 ? null : (total - bad) / total,
    spentFraction: total === 0 ? null : bad / allowed,
    compliant: total === 0 ? null : bad * SCALE <= total * (SCALE - targetPpm),
  }
```

`SCALE` vale un millón. El archivo completo valida recuentos, target y límites para que esos productos no salgan del rango entero seguro de JavaScript. No acepta un objetivo del 100 %: en este modelo dejaría una tolerancia cero y el burn rate posterior necesitaría otro contrato.

Si no hay eventos elegibles, el SLI, el consumo relativo y el cumplimiento quedan en `null`. Un restante numérico de cero en ese caso no demuestra que el servicio haya agotado presupuesto por fallos.

## Una fracción de evento no necesita redondearse para parecer real

Cinco eventos y un objetivo del 99 % permiten aritméticamente 0.05 eventos malos. Eso no significa que pueda fallar «una vigésima parte de una petición». Significa que un solo fallo supera la proporción permitida para esa muestra.

El test conserva la fracción:

```javascript
  assert.equal(summarizeBudget(5, 1, 990000).allowed, 0.05)
```

Redondear a un evento permitido cambiaría el objetivo: con un fallo sobre cinco aceptaríamos un 80 %. La muestra pequeña puede hacer que el indicador sea poco estable, pero eso se analiza como un problema de volumen y decisión, no alterando la aritmética a conveniencia.

## Presupuesto por eventos no equivale automáticamente a minutos de caída

En un indicador temporal podemos expresar disponibilidad como proporción de tiempo. Pero en un SLO por solicitudes, una caída de cinco minutos en hora punta puede afectar a más eventos que otra mucho más larga de madrugada.

No conviertas el 0.1 % de un mes en minutos y lo presentes como traducción exacta de cualquier SLO del 99.9 %. Antes hay que comprobar la unidad del indicador y su ponderación.

La simulación usa contadores por minuto, pero **el peso lo tienen los eventos**, no los minutos. Dos intervalos con volúmenes distintos no aportan el mismo denominador.

## Una política útil nombra decisiones, excepciones y responsables

`spec/budget-policy.json` propone una política didáctica. Cuando el servicio está dentro del objetivo, los cambios siguen la revisión y el rollout normales. Si agota el margen, se pausan releases discrecionales y se prioriza investigar y mejorar fiabilidad.

No bloquea una mitigación necesaria ni un arreglo urgente de seguridad. La excepción exige un responsable, una razón y un plan de recuperación. «No desplegar nada» puede impedir precisamente corregir el problema.

La política también contempla datos incompletos: investigar la falta de telemetría, no declararla éxito. Define una revisión para volver al flujo normal, en lugar de depender del criterio improvisado de quien esté de guardia.

Es un documento de ejemplo, no una política ejecutada por CI. Su aplicación real requiere acuerdo con producto, ingeniería y operación. La configuración incluye `automatedEnforcement: false` para que ese límite no quede implícito.

## Recuperar margen no es borrar el incidente

En una ventana rolling, los fallos antiguos pueden salir y el presupuesto restante aumentar. En una ventana de calendario, empieza otro periodo. Ninguno de esos mecanismos demuestra que hayamos eliminado la causa.

También puede aumentar el margen permitido si llegan más eventos correctos. Eso cambia la proporción observada; no deshace el impacto sufrido. Una revisión de fiabilidad debe conservar el incidente y sus acciones aunque el panel vuelva a cumplir.

Por eso el presupuesto ayuda a priorizar, pero no sustituye un análisis de severidad, seguridad, integridad de datos o impacto concentrado en un grupo pequeño de usuarios.

## Código completo y pruebas

[Archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/slo-budget/README.md), [cálculos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/service-objectives/src/budget.ts) y política de ejemplo:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/service-objectives test
```

Se comprueban deuda, fracciones, ausencia de datos y entradas inválidas. La simulación posterior consume el mismo presupuesto con patrones temporales diferentes para estudiar cuándo una alerta aporta información adicional.

## Garantías y límites

Los números prueban fórmulas y fronteras del modelo. No prueban que el target elegido sea adecuado, que el equipo haya aprobado la política ni que un pipeline impida desplegar. Los objetivos de seguridad o integridad pueden exigir decisiones aunque sobre presupuesto de disponibilidad.

## Ejercicio: justificar una excepción sin cambiar el SLO

El presupuesto se ha agotado y hay un parche que mitiga la causa. Redacta una excepción con riesgo, responsable, comprobación posterior y rollback. Después explica por qué relajar el objetivo para disponer de más margen no equivaldría a arreglar el problema.

Seguimos con [burn rate y supuestos de tráfico](/posts/burn-rate-presupuesto-errores-trafico).

## Referencias

- [Google SRE Workbook: ejemplo de política de presupuesto](https://sre.google/workbook/error-budget-policy/).
- [Google SRE: equilibrio entre riesgo y fiabilidad](https://sre.google/sre-book/embracing-risk/).
- [Google Cloud: trayectoria de los error budgets](https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring#trajectory_of_error_budgets).

Fuentes consultadas el 24 de octubre de 2026. La política propuesta es ficticia y no se aplica automáticamente a ningún repositorio.
