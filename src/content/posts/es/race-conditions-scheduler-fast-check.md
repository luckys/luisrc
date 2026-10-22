---
id: PBT-RACES
title: 'Race conditions con fast-check: controlar el orden en vez de añadir sleeps'
published: 2026-10-22T09:03:00Z
locale: es
translationKey: property-testing-races
slug: race-conditions-scheduler-fast-check
draft: true
status: draft
level: intermedio
prerequisites: [PBT-MODEL]
description: 'Reproduce una actualización perdida controlando promesas con el scheduler de fast-check. Guarda una traza determinista y entiende qué intercalados no estás probando.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, concurrency, race-conditions, fast-check]
---

Dos operaciones incrementan un contador que empieza en cero. Ambas terminan sin errores y el resultado vale uno. No falta una operación: las dos leyeron cero antes de escribir uno.

Podemos intentar reproducirlo añadiendo retrasos, pero entonces el test depende de la velocidad de la máquina. Es más útil controlar **en qué orden pueden continuar las operaciones** y exigir que el resultado conserve ambos incrementos.

Después de [probar secuencias de eventos](/posts/model-based-testing-secuencias-pagos), cambiaremos una dimensión: no variará solo la entrada, también el orden de las continuaciones asíncronas. El ejemplo es local y pequeño para que la carrera se pueda seguir completa.

## Una race condition no requiere dos hilos ejecutando a la vez

Una **race condition** aparece cuando un resultado depende de un orden que el código no controla adecuadamente. En Node.js puede haberla aunque las continuaciones de TypeScript se ejecuten en un único hilo: un `await` permite que otra operación avance entre una lectura y su escritura.

**Concurrencia** significa que las operaciones pueden estar en curso durante periodos solapados. **Paralelismo** significa ejecución simultánea. Esta carrera necesita concurrencia, no dos instrucciones ejecutándose en el mismo instante.

En una API, el hueco podría estar entre consultar una fila y actualizarla. Aquí lo representamos con promesas controladas y un número en memoria. No hace falta una base de datos para entender el intercalado, pero sí haría falta probarla para afirmar que un mecanismo SQL lo resuelve.

<img src="/assets/visuals/property-testing/PBT-RACES.svg" alt="Dos incrementos parten de cero; el scheduler libera ambas lecturas antes de las escrituras, cada operación escribe uno y el resultado pierde un incremento; el arreglo local elimina el await entre leer y escribir." width="323" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/PBT-RACES.svg).

## El scheduler controla continuaciones, no detiene el mundo

El **scheduler** de fast-check envuelve promesas y decide cuándo entregar su resolución al código que las espera. No controla automáticamente cada operación asíncrona del proceso.

Esto tiene una consecuencia importante: envolver una promesa no impide que su trabajo original se ejecute. Si llamas a una API real y después envuelves su promesa, la petición puede haber salido ya. En nuestro fixture los cambios del contador ocurren **después** de las promesas controladas; por eso sabemos qué orden estamos probando.

Archivo `src/concurrency.ts`, con el tipo `Scheduler` importado de `fast-check`:

```typescript
export async function runRace(scheduler: Scheduler, atomic: boolean) {
  let value = 0
  const pause = (label: string) => scheduler.schedule(Promise.resolve(), label)
  async function increment() {
    if (atomic) {
      await pause('increment')
      value++
      return
    }
    await pause('read')
    const snapshot = value
    await pause('write')
    value = snapshot + 1
  }
  const both = Promise.all([increment(), increment()])
  await scheduler.waitFor(both)
  return { value, report: scheduler.report() }
}
```

`pause` no duerme un número de milisegundos. Registra un punto que el scheduler puede liberar. Las dos llamadas a `increment()` quedan iniciadas antes de esperar su finalización conjunta.

`waitFor(both)` hace avanzar las promesas controladas que necesita esa tarea. Si simplemente esperásemos `both` sin hacer avanzar el scheduler, las continuaciones no tendrían por qué liberarse. Este detalle evita confundir una carrera con un test bloqueado por su propio fixture.

## Guardar el orden que demuestra la actualización perdida

La propiedad generada exige resultado dos y busca órdenes que la contradigan. En este laboratorio falla con seed `5703`, y el replay de su path también falla por aserción.

Además guardamos un caso determinista en `tests/search.test.mjs`:

```javascript
  const lost = await runRace(fc.schedulerFor([1, 2, 3, 4]), false)
  assert.equal(lost.value, 1)
  assert.deepEqual(lost.report.map((entry) => entry.label), ['read', 'read', 'write', 'write'])
  const fixed = await runRace(fc.schedulerFor([1, 2]), true)
  assert.equal(fixed.value, 2)
```

Los números de `schedulerFor` identifican las tareas registradas; no son tiempos. Primero liberamos las dos lecturas. Cada operación guarda un snapshot de cero. Después liberamos ambas escrituras y las dos asignan uno.

La aserción que espera uno documenta la variante insegura. **No dice que uno sea el resultado correcto del producto**. El contrato de dos incrementos sigue exigiendo dos, y la propiedad de búsqueda falla precisamente por esa discrepancia.

## Por qué funciona el arreglo local

Con `atomic: true`, cada operación espera un único punto de control y después ejecuta `value++` sin otro `await` entre lectura y escritura. En este proceso y sobre esta variable ordinaria, una continuación completa ese tramo antes de que la otra lo ejecute.

La variante corregida pasa cien schedulers generados con la misma seed. También pasa la regresión determinista de dos incrementos.

No extrapolemos el nombre `atomic` a otros entornos. Ese booleano solo elige la variante del ejercicio. No convierte un read-modify-write de PostgreSQL en atómico, no protege memoria compartida entre workers y no coordina dos réplicas de un servicio. Esas fronteras requieren operaciones atómicas, constraints, locks u otro mecanismo adecuado, además de pruebas en la dependencia real.

## Por qué los sleeps producen evidencia más débil

Un `sleep(10)` intenta hacer probable un intercalado. En una máquina cargada puede producir otro; en una rápida puede no exponer el fallo. Aumentarlo hace más lenta la suite sin convertir esa probabilidad en control.

Una **barrera** determinista o un scheduler permite señalar qué operación se detiene y cuándo continúa. Si lo que queremos verificar es una política de timeout real, el tiempo sí forma parte del contrato. Aquí no lo es: el defecto está en el orden de lectura y escritura.

La traza guardada en `evidence/verification.json` permite revisar ese orden sin interpretar marcas temporales de unos pocos milisegundos.

## Código completo y pruebas

[Índice y fuentes](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/pbt-races/README.md) y [fixture completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/src/concurrency.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing verify
```

## Garantías y límites

Probamos puntos explícitos de continuación de dos operaciones. No enumeramos todos los intercalados posibles, no usamos hilos, red ni SQL y no medimos latencia. Un scheduler de tests no es el scheduler del sistema operativo.

También quedan fuera fuentes no controladas, como callbacks externos o un `fetch` real que afecte al resultado antes de los puntos previstos. Para preservar replay hay que declarar esas fronteras y controlarlas o probarlas con otra estrategia.

## Ejercicio: añadir una tercera operación

Extiende el fixture a tres incrementos. Escribe primero el resultado esperado y dibuja un orden en el que los tres lean cero. Después comprueba que el arreglo local conserva tres. No reutilices los IDs de tareas del caso de dos operaciones sin revisar cuándo se registran.

La siguiente entrega cambia el orden por la forma de la entrada: [fuzzing de bytes y generadores estructurados](/posts/fuzzing-parser-bytes-generadores-estructurados).

## Referencias

- [fast-check: scheduler y race conditions](https://fast-check.dev/docs/advanced/race-conditions/).
- [Node.js: event loop y continuaciones asíncronas](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick).

Fuentes consultadas el 22 de octubre de 2026. Pruebas ejecutadas con fast-check 4.10.2.
