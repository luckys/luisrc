---
id: DIST-RECONCILIATION
title: 'Reconciliación: resolver operaciones inciertas sin inventar su resultado'
published: 2026-10-17T03:07:00Z
locale: es
translationKey: reliable-reconciliation
slug: reconciliacion-operaciones-inciertas
draft: true
status: draft
level: intermedio
prerequisites: [DIST-SAGAS]
description: 'Diseña un proceso que consulta evidencia externa, conserva el audit trail y escala los casos que no puede resolver con seguridad.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [reconciliacion, resiliencia, backend, workers]
---

Una operación lleva una hora pendiente. No llegó el webhook y el cliente perdió la respuesta original. Crear otra operación no aclara qué pasó con la primera; puede añadir un segundo problema.

**Reconciliation**, o reconciliación, compara nuestro estado con evidencia de otros sistemas y decide cómo resolver discrepancias. Después de [las sagas](/posts/sagas-compensaciones-workflows-duraderos), es la pieza que impide abandonar indefinidamente los resultados inciertos.

## Retry, compensación y reconciliación no son sinónimos

Un **retry** vuelve a intentar una acción. Una **compensación** ejecuta otra acción para corregir una consecuencia. Reconciliar empieza por averiguar y contrastar: quizás no haga falta repetir ni compensar nada.

En nuestro caso, una operación `unknown` conserva su referencia externa. El reconciliador consulta esa referencia y obtiene éxito, rechazo, pendiente o ausencia. Cada resultado tiene un significado según el contrato del proveedor, no según la intuición del worker.

`not_found` puede significar que no existe, pero también que la consulta todavía no refleja una escritura, que preguntamos en otro ámbito o que la referencia está mal. Solo un contrato suficientemente fuerte permite interpretarlo como ausencia definitiva. La demo conserva `unknown`.

<img src="/assets/visuals/reliable-services/DIST-RECONCILIATION.svg" alt="Un scanner elige operaciones inciertas, consulta una referencia externa y aplica evidencia concluyente; pendiente o ausencia no concluyente vuelven a espera o revisión manual." width="934" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-RECONCILIATION.svg).

## Una decisión pequeña que se puede probar

Archivo: `reliable-services/src/workflow.ts` (extracto).

```typescript
export function reconcile(
  local: State,
  remote: 'succeeded' | 'failed' | 'pending' | 'not_found',
): State {
  if (local !== 'unknown') return local
  if (remote === 'succeeded') return transition(local, 'confirm')
  if (remote === 'failed') return transition(local, 'decline')
  return local
}
```

La función asume evidencia ya autenticada y correctamente asociada a la operación. Solo resuelve el estado incierto; no sobrescribe un terminal porque una consulta contradictoria devuelva otra cosa. Esa discrepancia requiere registrarse y revisarse fuera de esta función.

El test comprueba éxito confirmado, ausencia no concluyente y conservación de un terminal. El fake de la primera entrega permite recuperar la evidencia tras una respuesta perdida. Ambas piezas enseñan el protocolo sin simular una certeza inexistente.

## El scanner no debe consultar todo a la vez

Define elegibilidad: estado, antigüedad, próximo intento y proveedor. Evita seleccionar repetidamente operaciones demasiado recientes si el proveedor necesita tiempo para reflejarlas. Coordina varios workers para que no disparen la misma consulta sin necesidad.

Respeta límites de tasa y concurrencia, aplica backoff y conserva el próximo momento de consulta. El [presupuesto de retries](/posts/retries-deadlines-backoff-backpressure) también aplica aquí. Una caída del proveedor no debería producir una tormenta de reconciliación.

Al persistir una resolución, vuelve a comprobar versión y estado. Un webhook válido podría haber confirmado la operación mientras el scanner esperaba. Si perdió la carrera, debe leer el resultado actual, no imponer su copia antigua.

## Mantén la historia además del estado final

Registra motivo de selección, intento, referencia consultada, observación, decisión y momento. Minimiza payloads sensibles: conservar «todo por si acaso» aumenta exposición y dificulta retención.

Un **audit trail** permite explicar por qué se cambió un estado. No basta con un log que diga «actualizado». También debe poderse distinguir observación externa de una intervención manual, con identidad y razón de quien intervino.

Define un límite de automatización. Una operación sin evidencia concluyente tras varios intentos puede pasar a revisión. Eso es un resultado operativo explícito, no un fallo que deba ocultarse asignando `failed`.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-reconciliation/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

Reconciliar no crea información que el proveedor no ofrece. Puede reducir pendientes y detectar discrepancias, pero no garantiza resolución automática de todos los casos. Las consultas pueden estar limitadas, ser eventualmente consistentes o resultar contradictorias.

El laboratorio prueba la política de decisión, no un scanner persistente ni intervención humana. No declara tiempos de recuperación medidos. El proyecto integrador deberá añadir esos componentes y probar sus carreras con webhooks.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/workflow.ts). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="compensación|timeout tras efecto" tests/core.test.mjs
```

## Ejercicio: una matriz de evidencia

Para éxito, rechazo, pendiente, ausencia y error de consulta, define estado local resultante y próxima acción. Añade un webhook concurrente que resuelve antes de guardar. El criterio es conservar su evidencia y evitar otra ejecución comercial.

La siguiente serie empieza por [inyectar fallos y generar secuencias de pruebas](/posts/fault-injection-pruebas-propiedades), antes de medir y operar el conjunto.

## Referencias

- [AWS: hacer seguras APIs mediante idempotencia](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/).
- [Stripe: entrega de webhooks y eventos duplicados](https://docs.stripe.com/webhooks).
- [PostgreSQL 18: concurrencia y aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html).

Fuentes consultadas el 17 de octubre de 2026. La política conservadora de `not_found` pertenece al contrato de este ejemplo.
