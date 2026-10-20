---
id: DESIGN-STATES
title: 'Máquinas de estados: impedir transiciones que el negocio no permite'
published: 2026-10-17T02:02:00Z
locale: es
translationKey: reliable-state-machines
slug: maquinas-estados-reglas-negocio
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-MODULES, API-MONEY]
description: 'Modela estados y acciones explícitas. Evita que una confirmación duplicada o un aviso atrasado reviertan una operación ya resuelta.'
author: 'Luis Ramírez Calle'
series: 'Diseñar servicios que se puedan cambiar'
tags: [typescript, state-machine, diseno, backend]
---

Una operación está confirmada. Llega con retraso un aviso de intento fallido y un handler ejecuta `status = "failed"`. El valor existe en el enum, pero el cambio no tenía sentido para esa operación.

Un listado de estados válidos no define qué movimientos están permitidos. Después del [diseño modular](/posts/monolito-modular-solid-sin-sobreingenieria), utilizaremos una **state machine** para expresar esas reglas y probarlas sin infraestructura.

## Estado, acción y evidencia no son lo mismo

El **estado** resume lo que sabemos de una operación. La **acción** solicita o comunica un cambio. La **evidencia** justifica aceptarlo. Un mensaje con texto `succeeded` no es evidencia suficiente si no sabemos quién lo envió ni a qué operación pertenece.

Nuestro modelo didáctico tiene `created`, `processing`, `unknown`, `succeeded` y `failed`. `unknown` no significa fracaso: falta un resultado concluyente. Más adelante estudiaremos cómo puede ocurrir tras un timeout.

`succeeded` y `failed` son terminales dentro del alcance. Una devolución futura sería otra operación con sus propias reglas, no una excusa para cambiar arbitrariamente un éxito pasado a fallo.

<img src="/assets/visuals/reliable-services/DESIGN-STATES.svg" alt="Created pasa a Processing al enviar; Processing puede confirmar, fallar o quedar Unknown; Unknown requiere evidencia para llegar a un terminal, que no retrocede por eventos atrasados." width="786" height="1043" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DESIGN-STATES.svg).

## La tabla es parte de la especificación

Archivo: `reliable-services/src/workflow.ts` (extracto).

```typescript
const transitions: Record<State, Partial<Record<Action, State>>> = {
  created: { submit: 'processing' },
  processing: { confirm: 'succeeded', decline: 'failed', uncertain: 'unknown' },
  unknown: { confirm: 'succeeded', decline: 'failed', uncertain: 'unknown' },
  succeeded: { confirm: 'succeeded' },
  failed: { decline: 'failed' },
}

export function transition(state: State, action: Action): State {
  const next = transitions[state][action]
  if (next === undefined) throw new Error(`invalid_transition:${state}:${action}`)
  return next
}
```

`Partial` permite que una acción no esté definida en un estado. La ausencia es deliberada: `confirm` desde `created` se rechaza porque el contrato exige registrar primero el envío. No es una máquina universal para todos los proveedores.

Aceptar `confirm` sobre `succeeded` como una transición a sí mismo permite reconocer el mismo hecho de nuevo. Eso no autoriza repetir sus efectos secundarios. Si cada llamada al handler envía un email, la máquina por sí sola no lo deduplica.

La versión ingenua, asignar el estado recibido, no distingue una transición válida de una tardía. Los tests incluyen `succeeded → decline`, que debe rechazarse, y `succeeded → confirm`, que conserva el estado.

## Una operación puede tener varios intentos

La operación representa la intención que importa al usuario. Un intento representa una interacción concreta con un proveedor. Un intento puede perder su respuesta y otro consultar el resultado de la misma intención sin que eso implique dos operaciones comerciales.

Conviene conservar identificadores separados para operación, intento y referencia externa. Mezclarlos impide explicar qué se repitió y qué evidencia estamos usando. Un intento fallido no convierte automáticamente toda la operación en fallida si otro ya fue confirmado.

## Una función pura no resuelve dos escritores

Dos workers pueden leer `processing`, calcular transiciones válidas por separado y escribir resultados incompatibles. La máquina protege la decisión local, no la escritura concurrente.

Al persistir, utiliza una transacción con el control adecuado, por ejemplo una condición sobre estado y versión. Si la escritura no afecta la fila esperada, vuelve a leer y decide de nuevo. Esa coordinación corresponde a [optimistic locking y bloqueos](/posts/concurrencia-bloqueos-postgresql).

No conviene convertir todos los errores de transición en un retry. Un aviso incoherente puede necesitar auditoría o reconciliación, no un bucle que siga intentando sobrescribir un terminal.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-states/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

La tabla garantiza que la función solo devuelve transiciones definidas para sus entradas tipadas. No verifica firmas, referencia externa, pertenencia al tenant ni permisos del actor. Tampoco implementa persistencia de versión. Los tests no prueban reglas comerciales ajenas a esta demo.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/workflow.ts). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="máquina:" tests/core.test.mjs
```

## Ejercicio: añadir cancelación sin abrir un atajo

Define en qué estados admitirías `cancel`. Distingue «solicitar cancelación» de «cancelación confirmada por el proveedor». Añade tests para un aviso de éxito recibido después de solicitarla. Si no puedes resolverlo con evidencia, conserva un estado pendiente explícito.

Seguimos con [TDD y niveles de prueba](/posts/tdd-pruebas-unitarias-integracion-contrato), usando estas reglas como primer contrato.

## Referencias

- [W3C SCXML: modelo de máquinas de estados](https://www.w3.org/TR/scxml/).
- [PostgreSQL 18: aislamiento y actualización concurrente](https://www.postgresql.org/docs/18/transaction-iso.html).
- [TypeScript: uniones y narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html).

Fuentes consultadas el 17 de octubre de 2026. Los estados y transiciones son decisiones explícitas del ejemplo.
