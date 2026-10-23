---
id: PERF-BENCH
title: 'Microbenchmarks: comparar dos implementaciones sin cambiar el problema'
published: 2026-10-22T10:04:00Z
locale: es
translationKey: performance-microbenchmarks
slug: microbenchmarks-warmup-reproducibilidad-typescript
draft: true
status: draft
level: intermedio
prerequisites: [P058, P011]
description: 'Compara una búsqueda repetida con un índice Map usando el mismo resultado, dataset y protocolo. Conserva warm-up, orden alternado y muestras de procesos independientes.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, benchmarking, typescript, reproducibility]
---

Una función tarda menos después de cambiarla, pero también hemos movido fuera del cronómetro el trabajo que hacía antes. El número ha mejorado sin que sepamos cuánto ha mejorado la operación completa.

Un **microbenchmark** puede ayudarnos a comparar una parte pequeña del programa, siempre que fijemos qué trabajo entra en la medida. Si las dos variantes no hacen lo mismo, estamos comparando problemas distintos.

Después de [medir un servicio bajo carga](/posts/saturacion-stress-testing-admision-recuperacion), reduciremos el alcance a un cálculo local en **TypeScript**. No convertiremos sus milisegundos en requests por segundo de una API.

## El contrato se comprueba antes de comparar velocidad

El dataset tiene cinco mil filas de pagos ficticios y mil tasas identificadas como `C0`, `C1` y siguientes. Para cada fila buscamos su tasa y sumamos `minor × basisPoints`.

El resultado es un **checksum ponderado** que permite comparar trabajo. No estamos redondeando conversiones monetarias ni ejecutando un modelo contable o un cobro real.

La versión inicial recorre la lista de tasas por cada fila. La alternativa construye un **Map** y consulta el índice. Ambas deben producir el mismo resultado, conservar la primera tasa si hay un identificador repetido y lanzar un error cuando falta una tasa.

La suite incluye un oráculo explícito: dos filas con valores dos y tres y tasas 10000 y 12000 deben sumar 56000. Para el dataset grande, el generador determinista permite calcular el esperado con su regla conocida, sin llamar a la función que estamos verificando.

## Incluir la construcción del índice evita esconder su coste

Archivo `src/workload.ts`, con los tipos `PaymentRow` y `Rate` definidos en el mismo módulo:

```typescript
export function calculateIndexed(payments: readonly PaymentRow[], rates: readonly Rate[]): number {
  const index = new Map<string, Rate>()
  for (const rate of rates) if (!index.has(rate.currency)) index.set(rate.currency, rate)
  let sum = 0
  for (const payment of payments) {
    const rate = index.get(payment.currency)
    if (!rate) throw new Error('missing rate')
    sum += payment.minor * rate.basisPoints
  }
  return sum
}
```

Cada invocación crea el índice dentro de la función medida. La construcción del dataset, en cambio, queda fuera para las dos variantes: queremos comparar el procesamiento de una entrada ya disponible.

Si una aplicación pudiera reutilizar el índice entre muchas operaciones, ese sería otro contrato de caché, con su coste de invalidación y retención. Aquí no usamos esa ventaja adicional de manera silenciosa.

El cambio evita recorrer toda la lista una y otra vez. Esa explicación del trabajo eliminado es más útil que decir que `Map` es «rápido» sin aclarar para qué entrada o frente a qué alternativa.

<img src="/assets/visuals/performance/PERF-BENCH.svg" alt="Se fija el mismo checksum para cinco mil pagos y mil tasas; se compara búsqueda repetida con Map incluyendo el índice, con warm-up y siete mediciones alternadas en tres procesos nuevos, sin extrapolar a HTTP." width="342" height="756" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/PERF-BENCH.svg).

## Warm-up es una fase del protocolo, no una garantía mágica

Antes de guardar tiempos, ejecutamos tres llamadas por variante y comprobamos su resultado. Eso reduce la posibilidad de medir únicamente costes de primer uso, pero no demuestra que el runtime haya alcanzado un estado estable.

**JIT**, carga de código, cachés, asignaciones y **garbage collection** pueden afectar a las observaciones. Un número fijo de llamadas de warm-up es una decisión reproducible del experimento, no una receta válida para cualquier función.

También distinguimos un benchmark de proceso caliente de un arranque en frío. Si nos importara una función que solo se ejecuta una vez al iniciar un comando, excluir ese primer uso respondería a una pregunta distinta.

## Alternar el orden reduce una fuente de sesgo

Después del calentamiento guardamos siete mediciones por variante. Extracto de `scripts/benchmark-child.mjs`:

```javascript
for (let round = 0; round < 7; round++) {
  const order = round % 2 === 0 ? ['slow', 'indexed'] : ['indexed', 'slow']
  for (const variant of order) {
    const before = performance.now()
    const checksum = functions[variant](data.payments, data.rates)
    const ms = performance.now() - before
    assert.equal(checksum, expected)
    samples.push({ round, variant, ms, checksum })
  }
}
```

`functions` contiene las dos implementaciones y `performance` se importa de `node:perf_hooks`. Comprobamos el resultado fuera del intervalo medido, pero siempre lo consumimos y verificamos. Una función que devuelve el valor incorrecto no gana el experimento.

Alternar evita ejecutar siempre una variante después de la otra. No elimina todos los efectos de orden ni aísla la máquina. Conservamos el orden de cada muestra precisamente para poder revisarlo.

## Tres procesos muestran variación, no un único tiempo verdadero

El runner crea tres procesos Node.js nuevos y repite el mismo protocolo. Sus medianas locales, redondeadas, son:

<div role="region" aria-label="Medianas del microbenchmark en tres procesos" tabindex="0" style="overflow-x:auto">

| Proceso | Búsqueda repetida | Índice incluido |
| --- | --- | --- |
| 1 | 5,639 ms | 0,119 ms |
| 2 | 4,551 ms | 0,078 ms |
| 3 | 4,620 ms | 0,071 ms |

</div>

No elegimos únicamente el mejor tiempo. El informe conserva las cuarenta y dos muestras medidas, veintiuna por variante, además del protocolo y el entorno. La diferencia tiene una explicación concreta para este dataset: evitamos búsquedas repetidas.

No hemos calculado intervalos de confianza ni aislado CPU o frecuencia. Los tres procesos tampoco son tres máquinas independientes. La variación del primer proceso ya recuerda por qué no conviene publicar un decimal como si fuera una constante del lenguaje.

## Una mejora local no multiplica toda la aplicación

Si el programa pasa casi todo su tiempo esperando una dependencia, reducir este cálculo puede cambiar poco el tiempo total. Si el cálculo domina una operación, la mejora puede ser importante. Hay que medir cuánto pesa en el recorrido real.

Nuestro endpoint sintético `/work` espera cuarenta milisegundos y no ejecuta este cálculo. No aplicamos el ratio del microbenchmark a sus resultados de carga. Son experimentos separados.

Tampoco concluimos que TypeScript sea más rápido o lento que otro lenguaje. Las dos variantes se ejecutan en el mismo runtime y cambian la estructura de acceso a datos.

## Código completo y pruebas

[Índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/perf-bench/README.md) y [protocolo completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/scripts/benchmark-child.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab measure:profiles
pnpm --dir packages/performance-lab verify
```

## Garantías y límites

Dataset fijo, resultado comprobado, warm-up declarado y repeticiones sin profiler en procesos nuevos. No hay HTTP, SQL, costes de arranque medidos, datasets representativos de producción o control estadístico completo.

Cambiar el tamaño, la distribución de identificadores o cuántas veces reutilizamos las tasas puede cambiar la comparación. El benchmark no exime de revisar consumo de memoria y mantenibilidad.

## Ejercicio: cambiar la entrada sin cambiar la pregunta

Repite el protocolo con cinco filas y después con cincuenta mil, manteniendo el coste del índice dentro de la medida. Guarda todos los resultados. Explica si el trabajo de construcción pesa igual en ambos casos, sin exigir que la alternativa gane siempre.

Seguimos con [CPU profiling](/posts/cpu-profiling-nodejs-muestras-cuello-botella): un tiempo total nos dice que hay una diferencia; un perfil puede ayudar a localizar dónde se consume el trabajo.

## Referencias

- [Node.js: profiling y análisis del trabajo de CPU](https://nodejs.org/en/learn/getting-started/profiling).
- [Node.js 24: performance measurement APIs](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html).

Fuentes consultadas el 22 de octubre de 2026. Valores observados en evidence/profiles.json, no benchmarks universales de TypeScript.
