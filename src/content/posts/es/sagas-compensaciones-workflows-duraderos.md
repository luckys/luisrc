---
id: DIST-SAGAS
title: 'Sagas y compensaciones: recuperar un proceso sin fingir un rollback global'
published: 2026-10-17T03:06:00Z
locale: es
translationKey: reliable-sagas-compensation
slug: sagas-compensaciones-workflows-duraderos
draft: true
status: draft
level: intermedio
prerequisites: [DIST-OUTBOX, DESIGN-STATES]
description: 'Coordina pasos con estados persistidos y acciones compensatorias. Liberar una reserva no borra la historia ni deshace cualquier efecto externo.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [sagas, workflows, consistencia, arquitectura]
---

Reservamos inventario y después falla la confirmación de otro sistema. Podemos liberar la reserva, pero no retroceder el tiempo: durante unos segundos esas unidades no estuvieron disponibles para otros clientes.

Una **compensación** es una nueva acción de negocio que corrige una consecuencia bajo ciertas reglas. No equivale a un rollback distribuido. Con [Outbox e Inbox](/posts/transactional-outbox-inbox-eventos) ya sabemos transportar cambios locales recuperables; ahora coordinaremos varios pasos.

## Una saga conserva el progreso del proceso

Una **saga** divide un proceso en transacciones locales y define qué hacer cuando no puede continuar. Por ejemplo: reservar, solicitar operación externa, confirmar pedido. Si se abandona el proceso y la reserva sigue siendo reversible, se solicita su liberación.

Cada paso necesita identidad, estado y una estrategia ante repetición. Si el coordinador cae, debe saber si tiene que consultar, reintentar o esperar, no empezar siempre desde cero.

La [máquina de estados](/posts/maquinas-estados-reglas-negocio) expresa movimientos permitidos. La ejecución duradera añade persistencia y recuperación entre movimientos. No son lo mismo: una tabla de transiciones en memoria puede ser correcta y perder todo el progreso al reiniciar.

<img src="/assets/visuals/reliable-services/DIST-SAGAS.svg" alt="El proceso reserva inventario y solicita una operación externa; un rechazo confirmado puede llevar a liberar la reserva, mientras un resultado desconocido obliga a consultar antes de compensar." width="971" height="604" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-SAGAS.svg).

## No todas las acciones tienen inversa

Archivo: `reliable-services/src/workflow.ts` (extracto).

```typescript
export function compensate(state: 'reserved' | 'released' | 'delivered'): 'released' {
  if (state === 'delivered') throw new Error('manual_review_required')
  return 'released'
}
```

El ejemplo permite liberar una reserva y repetir esa liberación sin cambiar su resultado lógico. Un producto ya entregado no se «desentrega» asignando otro estado. Haría falta un proceso de devolución con condiciones distintas.

El test cubre ambas situaciones. No envía comandos a inventario ni mantiene un workflow persistente; comprueba una política de compensación pequeña. Esa frontera evita presentar una función de tres líneas como un motor de sagas.

Un correo enviado no puede retirarse de la memoria de su destinatario. Una devolución monetaria puede tener costes y tiempos propios. Diseñar una compensación exige describir qué restablece y qué consecuencias conserva.

## Un timeout no basta para compensar

Si la operación externa quedó `unknown`, liberar una reserva y permitir otra compra puede crear una incoherencia si después aparece una confirmación. Primero necesitamos una política: consultar estado, mantener reserva con un límite explícito o escalar a revisión.

No existe una elección universal. Retener indefinidamente puede bloquear inventario; liberar demasiado pronto puede dejar una operación confirmada sin producto. La solución debe explicitar el riesgo comercial y no traducir toda incertidumbre a «fallo».

## Orquestación y coreografía reparten la coordinación

Con **orquestación**, un componente mantiene el progreso y decide el siguiente paso. Facilita ver el proceso completo, a costa de concentrar esa coordinación. Con **coreografía**, los participantes reaccionan a eventos; reduce ciertos enlaces directos, pero puede dispersar el recorrido y complicar diagnóstico y ciclos.

Para una demo pequeña elegimos primero una coordinación visible. No hace falta una plataforma de workflows para cuatro pasos, aunque un motor como Temporal puede aportar timers, retries y recuperación bajo sus reglas. Su replay determinista tampoco vuelve reversibles los efectos externos: las actividades necesitan identidades y contratos apropiados.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-sagas/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

Una saga puede recuperar o compensar pasos bajo un protocolo definido. No ofrece aislamiento global: otros procesos pueden observar estados intermedios. Tampoco asegura que toda compensación funcione; una liberación puede fallar y necesitar su propio retry y reconciliación.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/workflow.ts). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="compensación" tests/core.test.mjs
```

## Ejercicio: una tabla de recuperación

Para reservar, confirmar y liberar, registra precondición, efecto, identidad, evidencia y acción si se pierde la respuesta. Añade una caída después de cada efecto. El criterio es poder decidir el siguiente paso sin inventar el resultado del anterior.

Cerramos la serie con [reconciliación de operaciones inciertas](/posts/reconciliacion-operaciones-inciertas).

## Referencias

- [AWS: patrón Saga Orchestration](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html).
- [Temporal: workflow execution](https://docs.temporal.io/workflow-execution).

Fuentes consultadas el 17 de octubre de 2026. No se ejecuta Temporal ni una saga distribuida completa en el laboratorio.
