---
id: PERF-CPU
title: 'CPU profiling en Node.js: encontrar trabajo costoso sin confundir muestras con cronómetros'
published: 2026-10-22T10:05:00Z
locale: es
translationKey: performance-cpu-profiling
slug: cpu-profiling-nodejs-muestras-cuello-botella
draft: true
status: draft
level: intermedio
prerequisites: [PERF-BENCH]
description: 'Contrasta tiempo de pared, CPU y perfiles de muestras. Revisa una atribución anónima, separa el diagnóstico sin inlining del benchmark y valida la alternativa con el mismo resultado.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, profiling, nodejs, cpu]
---

Sabemos que una tarea tarda más de lo deseable. Todavía no sabemos si pasa ese tiempo calculando, esperando una dependencia o bloqueada por otra operación. El tiempo total no identifica por sí solo la causa.

Un **CPU profile** ayuda a observar dónde se estaba ejecutando el programa en una serie de muestras. Es una herramienta para contrastar hipótesis, no un cronómetro exacto colocado en cada función.

Usaremos el cálculo de [los microbenchmarks](/posts/microbenchmarks-warmup-reproducibilidad-typescript): búsqueda repetida de tasas frente a un índice. El resultado está comprobado y conocemos el trabajo que cambia entre ambas variantes.

## Tiempo de pared y CPU responden preguntas diferentes

El **wall time**, o tiempo de pared, transcurre mientras esperamos que termine la tarea. La CPU consumida cuenta tiempo de ejecución del proceso, medido aquí mediante `process.cpuUsage()`.

Una espera de red puede aumentar mucho el primero sin necesitar la misma cantidad de CPU. A la inversa, un proceso con trabajo en varios hilos puede acumular más tiempo de CPU que tiempo de pared. No debemos leer esa relación como un porcentaje de todos los núcleos del equipo sin definir el denominador.

El fixture de admisión de la serie esperaba con un timer. Este cálculo sí consume CPU. Son experimentos separados: el perfil del cálculo no diagnostica retroactivamente el timer del endpoint `/work`.

## El profiler toma muestras, no observa cada entrada y salida

Solicitamos un intervalo de muestreo de mil microsegundos. El profiler recoge pilas y metadatos que guarda en un archivo `.cpuprofile`. Las funciones muy breves pueden aparecer pocas veces o no aparecer.

Más muestras permiten observar mejor una carga que dura suficiente tiempo, pero no eliminan el efecto de la instrumentación ni convierten cada intervalo en tiempo exacto de una llamada.

En `scripts/cpu-child.mjs` conectamos una `Session` de `node:inspector/promises` al propio proceso. No abrimos un puerto de depuración accesible desde la red. Extracto de la región medida:

```javascript
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 1000 })
  await session.post('Profiler.start')
  const cpu = process.cpuUsage()
  const before = performance.now()
  let checksum = 0
  // Separate jobs by an event-loop turn, avoiding one top-level OSR loop that
  // attributed the entire initial profile to the module's anonymous frame.
  for (let i = 0; i < 100; i++) {
    checksum += calculate(data.payments, data.rates)
    await setImmediate()
  }
  const wallMs = performance.now() - before
  const used = process.cpuUsage(cpu)
  assert.equal(checksum, expected * 100)
  const { profile } = await session.post('Profiler.stop')
```

`setImmediate` se importa de `node:timers/promises`. Separamos cien trabajos por turnos del event loop para poder observarlos como carga diagnóstica. No es el mismo protocolo que cronometra una llamada individual en el benchmark.

El comentario documenta un intento de mejorar la atribución: un bucle inicial a nivel de módulo aparecía concentrado en su frame anónimo. Separar turnos no eliminó por completo esa limitación. No cambiamos el informe para que pareciera más claro de lo que era.

<img src="/assets/visuals/performance/PERF-CPU.svg" alt="Se contrastan tiempo de pared y CPU con muestras del profiler; el perfil normal atribuye trabajo a un frame anónimo, un diagnóstico separado sin inlining muestra findRateSlow y la alternativa se verifica con benchmark sin profiler." width="367" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/PERF-CPU.svg).

## Una ejecución más corta ofrece menos muestras

En el informe archivado, cien trabajos de la variante lenta ocupan unos **717,1 ms de pared** y **725,0 ms de CPU**. La variante indexada ocupa unos **16,8 ms de pared** y **17,5 ms de CPU**. Ambos acumulan el mismo checksum.

El perfil normal contiene 673 muestras en la primera variante y dieciséis en la segunda. No interpretamos la diferencia de detalle como ausencia de trabajo en la rápida. Su región es mucho más corta y el coste del propio profiler pesa proporcionalmente más.

Tampoco publicamos esos tiempos como el benchmark definitivo. La mejora debe contrastarse con [las muestras sin profiler](/posts/microbenchmarks-warmup-reproducibilidad-typescript), donde no se introduce esta instrumentación ni la separación asíncrona entre trabajos.

## Qué hacer cuando el perfil no identifica bien una función

La mayor parte de las muestras de la variante lenta normal aparece en un frame anónimo del módulo. Eso no permite señalar, solo mirando ese nombre, una línea concreta como culpable.

Hicimos otra ejecución diagnóstica con `--no-turbo-inlining`, disponible en el Node.js fijado. En ese perfil aparece `findRateSlow`, la función que recorre las tasas. Es evidencia útil para contrastar la hipótesis de búsquedas repetidas.

Pero el flag cambia una decisión de optimización del runtime. **No mezclamos sus tiempos con la comparación normal ni recomendamos desactivar inlining en producción**. También quedan muestras anónimas. El diagnóstico ha mejorado la visibilidad, no ha convertido el perfil en una contabilidad perfecta de cada instrucción.

Los tres archivos, normal lento, normal indexado y diagnóstico, se conservan para revisar esas diferencias. Las opciones de V8 dependen de la versión; no son una API estable que este ejemplo prometa para cualquier runtime.

## Self time e inclusive time no son lo mismo

Una vista **self** atribuye observaciones al frame donde se encontraba la ejecución. Una vista **inclusive** añade el trabajo de sus descendientes. Un coordinador puede tener poco trabajo propio y aparecer grande en una vista inclusiva porque llama al cálculo costoso.

Nuestro resumen agrupa intervalos por el frame muestreado, sin sumar descendientes. Este extracto procesa el perfil:

```javascript
  const weights = new Map()
  const names = new Map(profile.nodes.map((node) => [node.id, node.callFrame.functionName || '(anonymous)']))
  for (let i = 0; i < profile.samples.length; i++) {
    const name = names.get(profile.samples[i])
    weights.set(name, (weights.get(name) ?? 0) + profile.timeDeltas[i])
  }
```

El campo llamado `selfMicroseconds` es esa aproximación basada en `timeDeltas`, no una medición exacta de CPU por función. Además, agrupar solo por nombre pierde distinción entre funciones homónimas. El `.cpuprofile` completo conserva la estructura para una revisión más detallada.

La sesión del profiler empieza antes del cronómetro de trabajo y termina después. Sus intervalos pueden incluir llamadas de instrumentación fuera de esa frontera. Por eso no exigimos que la suma del resumen sea igual a `wallMs` o a CPU consumida.

## Una hipótesis necesita volver al resultado y a la medida

La inspección sugiere evitar buscar la misma tasa recorriendo la lista para cada pago. El índice realiza esa transformación y las pruebas verifican resultado, tasa ausente y prioridad de duplicados.

Después comprobamos el efecto en la medida sin profiler. No basta con conseguir un perfil de aspecto más limpio: una alternativa que haga menos trabajo porque omite filas también parecería rápida.

## Código completo y pruebas

[Índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/perf-cpu/README.md) y [script de captura](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/scripts/cpu-child.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab measure:profiles
```

## Garantías y límites

Perfiles reales de procesos locales con datos ficticios. Sin producción, aislamiento de CPU, red, SQL o perfil de toda una petición de usuario. El diagnóstico cambia optimización y no sustituye el perfil normal.

No atribuimos cada espera al profiler de CPU. Si el tiempo se consume fuera del proceso o esperando I/O, necesitaríamos otras señales. Y un perfil breve puede no mostrar con estabilidad una función poco frecuente.

## Ejercicio: introducir una espera sin más cálculo

Añade una espera asíncrona antes de cada trabajo y compara pared, CPU y muestras. No concluyas que una función consume CPU solo porque su operación tarda más en terminar. Declara qué cambió en la frontera de la medición.

La siguiente entrega analiza [retención de memoria](/posts/memory-profiling-heap-snapshots-retencion-cache): asignar objetos y mantenerlos alcanzables también son preguntas distintas.

## Referencias

- [Node.js: profiling de aplicaciones](https://nodejs.org/en/learn/getting-started/profiling).
- [Node.js 24: Inspector y CPU profiler](https://nodejs.org/docs/latest-v24.x/api/inspector.html).

Fuentes consultadas el 22 de octubre de 2026. Versiones, flags y perfiles completos acompañan a los resultados.
