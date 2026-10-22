---
id: PBT-FAULTS
title: 'Fault injection: perder la respuesta sin duplicar el efecto'
published: 2026-10-22T09:05:00Z
locale: es
translationKey: property-testing-faults
slug: fault-injection-respuesta-perdida-propiedades
draft: true
status: draft
level: intermedio
prerequisites: [PBT-MODEL, OPS-FAULTS]
description: 'Genera fallos antes y después de un efecto idempotente. Comprueba efectos y confirmación, conserva un retry final sin fallo y distingue simulación lógica de crash real.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, fault-injection, idempotency, resilience]
---

El proveedor ejecutó la operación, pero nuestro servicio no llegó a registrar la confirmación. Si el siguiente intento usa una clave nueva, puede producir un segundo efecto. El problema no es que haya habido un error, sino qué ocurrió antes de observarlo.

La **fault injection** permite elegir esa frontera. Vamos a introducir fallos antes del efecto, después del efecto y después de la confirmación local. Después comprobaremos qué conserva un reintento.

Esta entrega amplía [la introducción a fault injection](/posts/fault-injection-pruebas-propiedades) y utiliza [propiedades sobre secuencias](/posts/model-based-testing-secuencias-pagos). No sustituye los laboratorios SQL de las series anteriores: aquí aislamos el significado de una respuesta perdida mediante un proveedor fake en memoria.

## Una excepción no dice si hubo efecto

La misma respuesta de error puede corresponder a dos situaciones: el proveedor no ejecutó nada o ejecutó la operación y perdimos la evidencia local. Elegir «falló, así que no pasó nada» sería una decisión sin información suficiente.

Nuestro proveedor fake tiene un `Set` de claves. `charge(key)` añade una clave; repetir la misma no aumenta el tamaño. Llamamos `effects` a ese tamaño. **El fake garantiza idempotencia por construcción**: el test no demuestra que cualquier proveedor externo tenga ese contrato.

El servicio conserva un journal con `confirmed` y un contador de intentos usado solo por la variante defectuosa. En cada paso construimos un objeto servicio nuevo, pero el journal y el fake siguen siendo los mismos objetos. Esa distinción será importante al hablar de límites.

<img src="/assets/visuals/property-testing/PBT-FAULTS.svg" alt="Un fallo antes del efecto no ejecuta charge; un fallo después deja una clave en el fake y el journal sin confirmar; un servicio nuevo reintenta con esa misma clave y confirma sin añadir otro efecto, solo en memoria." width="347" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/PBT-FAULTS.svg).

## Nombrar la frontera permite predecir el estado

No elegimos un porcentaje genérico de errores. Elegimos puntos concretos del flujo:

<div role="region" aria-label="Estado esperado en cada frontera de fallo" tabindex="0" style="overflow-x:auto">
<div style="min-width:48rem">

| Punto | Efecto al partir de cero | Journal | Qué debe hacer el siguiente intento |
| --- | --- | --- | --- |
| `before-effect` | No existe | Sin confirmar | Ejecutar con la clave original |
| `after-effect` | Existe | Sin confirmar | Repetir la misma clave sin otro efecto |
| `after-confirm` | Existe | Confirmado | No volver a ejecutar la operación |
| `none` | Existe al terminar | Confirmado | Un intento posterior no cambia nada |

</div>
</div>

La tabla describe una primera llamada sobre una operación nueva. Después de intentos anteriores, un fallo temprano no elimina un efecto ya producido. Por eso el oráculo revisa el historial, no aplica mecánicamente «before-effect significa cero» en cualquier momento.

## Inyectar el fallo sin capturar cualquier error

Este es el método `pay` de `PaymentService`, en `src/recovery.ts`. `Fault` es la unión de los cuatro nombres de la tabla y `InjectedFault` una clase de error exclusiva del fixture:

```typescript
  pay(id: string, fault: Fault): void {
    if (this.journal.confirmed) return
    const key = this.stableKey ? id : `${id}-${++this.journal.attempts}`
    if (fault === 'before-effect') throw new InjectedFault('before-effect')
    this.provider.charge(key)
    if (fault === 'after-effect') throw new InjectedFault('after-effect')
    this.journal.confirmed = true
    if (fault === 'after-confirm') throw new InjectedFault('after-confirm')
  }
```

La variante normal conserva `id` entre intentos. La defectuosa usa un sufijo nuevo: cambia identidad de operación por identidad de intento. Es el tipo de error que un test de éxito con una sola llamada no detecta.

El fallo `after-effect` se lanza justo después de `charge` y antes de actualizar el journal. Representa una interrupción lógica en esa frontera. No hay un socket ni un timeout de red real. El nombre del escenario no debe hacernos atribuirle una infraestructura que no se ejecutó.

## Safety y recuperación necesitan expectativas diferentes

La **safety property** exige no producir más de un efecto. También comprobamos que no haya confirmación sin un efecto. Pero una implementación que no hiciera nada podría conservar el máximo de uno indefinidamente.

Por eso añadimos una condición de recuperación: tras una secuencia finita de fallos, ejecutamos un último intento sin fallo y exigimos confirmación y exactamente un efecto. No prometemos terminar si el entorno falla para siempre; declaramos cuándo esperamos progreso.

Oráculo de `tests/recovery-fixture.mjs`:

```javascript
export function assertRecovery(faults, stableKey = true) {
  const provider = new FakeProvider()
  const journal = { confirmed: false, attempts: 0 }
  for (const fault of faults) {
    const service = new PaymentService(provider, journal, stableKey)
    try { service.pay('payment-1', fault) }
    catch (error) { assert.ok(error instanceof InjectedFault) }
    assert.ok(provider.effects <= 1, 'at most one external effect')
    if (journal.confirmed) assert.equal(provider.effects, 1)
  }
  new PaymentService(provider, journal, stableKey).pay('payment-1', 'none')
  assert.equal(journal.confirmed, true)
  assert.equal(provider.effects, 1)
}
```

No hay un `catch {}` que absorba cualquier excepción. Solo admitimos `InjectedFault`; un error de programación hace fallar la prueba. El proveedor y el journal se crean de nuevo para cada secuencia, pero se comparten entre sus intentos.

## Generar fallos y conservar el caso que duplica

La propiedad genera quinientas secuencias con seed `5706`, de hasta doce puntos de fallo. Incluye arrays vacíos: incluso sin fallos previos, el intento final debe ejecutar y confirmar una operación.

La variante estable pasa. Con la variante que cambia la clave, la búsqueda archivada con seed `5702` reduce el fallo a `['after-effect']`. El primer intento ya produjo un efecto; el intento final sin fallo usa otra clave y añade el segundo.

Hay una regresión explícita con dos respuestas perdidas y un intento normal. La implementación estable sigue dejando un solo efecto. No significa que solo se haya llamado una vez al fake: puede recibir varios `charge`, pero su conjunto conserva una sola clave. **Número de intentos y número de efectos no son la misma métrica**.

## Código completo y pruebas

[Índice de la entrega](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/pbt-faults/README.md) y [servicio y proveedor fake](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/src/recovery.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing verify
```

## Garantías y límites

Probamos interrupciones lógicas y reconstrucción de objetos, **no un crash real de proceso**. El journal y las claves viven en memoria y desaparecen si termina el proceso. No hay disco durable, base de datos, HTTP, reconciliación por consulta o proveedor comercial.

El fake tampoco caduca claves ni permite reutilizar una clave con otro importe. Una integración real debe conocer esas condiciones, su ventana de retención y la forma de consultar evidencia. Una clave estable es parte del diseño, no una garantía universal de exactly-once.

Este laboratorio local no necesita credenciales ni ejecutar caos en un sistema ajeno. Para probar fallos de infraestructura habría que elegir un entorno aislado, datos desechables, condiciones de parada y observaciones independientes.

## Ejercicio: introducir caducidad sin prometer de más

Diseña una variante del fake que olvide claves después de un tiempo explícito. Antes de implementarla, decide qué comportamiento puede garantizar el servicio si el retry llega después. Quizá necesite consultar una operación conocida o dejar el caso incierto, en lugar de volver a cobrar automáticamente.

Cerramos esta serie comprobando [si nuestras propiedades detectan errores deliberados](/posts/mutation-testing-evaluar-propiedades), no contando únicamente cuántas ejecuciones pasan.

## Referencias

- [AWS Builders' Library: retries seguros con APIs idempotentes](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/).
- [fast-check: propiedades asíncronas y síncronas](https://fast-check.dev/docs/core-blocks/properties/).

Fuentes consultadas el 22 de octubre de 2026. Los resultados describen el fake local, no un servicio de AWS.
