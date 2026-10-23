---
id: PERF-MEMORY
title: 'Memory profiling: seguir referencias antes de llamar fuga a una subida de RAM'
published: 2026-10-22T10:06:00Z
locale: es
translationKey: performance-memory-profiling
slug: memory-profiling-heap-snapshots-retencion-cache
draft: true
status: draft
level: intermedio
prerequisites: [PERF-CPU]
description: 'Compara una caché sin límite y otra acotada con heap snapshots reales. Sigue referencias, cuenta objetos tras GC y distingue shallow size, heap y RSS.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, memory, profiling, nodejs]
---

La memoria del proceso sube y no vuelve inmediatamente al valor inicial. Eso merece investigación, pero todavía no demuestra una fuga. El runtime puede conservar páginas, el programa puede tener una caché legítima o puede estar reteniendo objetos que ya no necesita.

Para distinguir esas situaciones necesitamos observar **qué sigue alcanzable y por qué**. Un número de RAM por sí solo no explica la referencia que impide liberar un objeto.

Después de [CPU profiling](/posts/cpu-profiling-nodejs-muestras-cuello-botella), compararemos dos cachés ficticias mediante **heap snapshots**. La captura se hace en procesos desechables y separados del blog; no tomaremos un snapshot de una aplicación real con datos de usuarios.

## RSS, heap y memoria externa no son intercambiables

**RSS** describe memoria residente del proceso. `heapUsed` se refiere al heap de objetos gestionado por el runtime; no abarca por sí solo todo lo que ocupa el proceso. También existen memoria externa, buffers, código y costes del propio runtime.

Después de que un objeto deje de ser necesario, su almacenamiento no tiene por qué devolverse inmediatamente al sistema operativo. Una subida o una meseta de RSS no identifica por sí misma una referencia retenida.

Además, las herramientas de diagnóstico asignan memoria. Leer y analizar un snapshot crea buffers, strings y estructuras adicionales. Si mezclamos sus efectos con el comportamiento que investigamos, podemos culpar al programa por el trabajo del observador.

## La diferencia que introducimos está en una referencia

Cada `RetainedEntry` contiene un ID y un array nuevo de 1024 números ficticios. La variante sin límite conserva todas las entradas. La acotada mantiene como máximo cien y retira las más antiguas.

Archivo `src/cache.ts`:

```typescript
export class LabCache {
  readonly items: RetainedEntry[] = []
  readonly limit: number
  constructor(limit: number) {
    if (!(limit === Infinity || (Number.isInteger(limit) && limit > 0))) throw new RangeError('limit')
    this.limit = limit
  }
  add(id: number): void {
    this.items.push(new RetainedEntry(id))
    if (this.items.length > this.limit) this.items.shift()
  }
}
```

Es una política **FIFO** didáctica, no una implementación de **LRU**, un caché distribuido o una recomendación para todos los volúmenes. `shift` mueve elementos y su coste podría importar con límites mayores. Aquí queremos aislar la retención, no comparar algoritmos de caché.

La instancia queda referenciada desde `globalThis.labCache` durante la prueba. Esa raíz explícita mantiene vivo el array `items` y, a través de él, sus entradas.

<img src="/assets/visuals/performance/PERF-MEMORY.svg" alt="Se investigan referencias con snapshots tras quinientas y mil quinientas inserciones; LabCache mantiene items y sus RetainedEntry; la variante ilimitada crece y la acotada conserva cien, y ambas quedan en cero al retirar la referencia." width="376" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/PERF-MEMORY.svg).

## Capturar tras pasos equivalentes facilita la comparación

Cada variante vive en un proceso nuevo. Insertamos quinientas entradas, capturamos, añadimos otras mil y capturamos otra vez. Al final retiramos la referencia global y hacemos una tercera captura.

Ejecutamos el proceso con `--expose-gc` para solicitar GC antes de cada observación. Es una decisión de diagnóstico: no demuestra cuándo recogería memoria una aplicación normal ni justifica llamar al recolector manualmente como solución de producción.

Extracto de `scripts/memory-child.mjs`:

```javascript
async function capture(stage, expected) {
  global.gc()
  const memory = process.memoryUsage()
  const file = `${folder}/${variant}-${stage}.heapsnapshot`
  writeHeapSnapshot(file)
  const raw = await readFile(file)
  const analysis = analyzeHeap(JSON.parse(raw.toString('utf8')))
  assert.equal(analysis.entries, expected)
  if (expected > 0) assert.ok(analysis.pathFromCache?.some((part) => part.includes('items')))
  samples.push({ stage, memory, ...analysis, snapshotSha256: createHash('sha256').update(raw).digest('hex') })
}
```

El script importa `writeHeapSnapshot` de `node:v8`, lectura de archivos, aserciones, hashing y nuestro lector. La métrica del proceso se recoge antes de escribir cada snapshot. Aun así, en capturas posteriores puede pesar el trabajo diagnóstico anterior. Por eso no la tratamos como una serie de memoria libre de interferencias.

## El snapshot permite buscar un camino, no solo contar bytes

El lector utiliza los metadatos del formato V8 para localizar campos y tipos. Cuenta nodos de tipo objeto llamados `RetainedEntry`; no cuenta strings que contengan ese nombre ni el constructor de la clase.

También busca un camino de referencias fuertes, de propiedad o elemento, desde el objeto `LabCache` hasta una entrada. En los snapshots con entradas aparece:

```text
LabCache → items → Array → [0] → RetainedEntry
```

Ese camino explica una retención concreta. No estamos calculando un árbol completo de dominadores ni probando que ese sea el único camino del heap. La referencia global está definida en el fixture; el lector muestra el tramo que parte de la caché.

## Qué cambia al poner un límite

Los recuentos observados son:

<div role="region" aria-label="Objetos RetainedEntry encontrados en snapshots" tabindex="0" style="overflow-x:auto">
<div style="min-width:31rem">

| Variante | Tras 500 inserciones | Tras 1500 | Tras retirar referencia |
| --- | --- | --- | --- |
| Sin límite | 500 | 1500 | 0 |
| Límite de 100 | 100 | 100 | 0 |

</div>
</div>

<img src="/assets/interactive/performance-series/memory-results.svg" alt="Recuentos reales de RetainedEntry después de GC: la caché ilimitada mantiene quinientos y mil quinientos objetos, la acotada cien en ambos pasos y al retirar la referencia ambas tienen cero; no representa RSS ni bytes retenidos." width="360" height="430" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/interactive/performance-series/memory-results.svg).

No llamamos fuga a la variante ilimitada únicamente porque crezca. Sabemos qué referencia conserva y qué política le falta para este uso. Un programa que deba guardar todas las entradas tendría otra necesidad de negocio, almacenamiento y presupuesto.

En la variante acotada, el número de entradas deja de crecer con las inserciones. No significa que toda la memoria del proceso sea constante ni que cualquier objeto asociado a una entrada se libere en una aplicación más compleja.

## Shallow size no equivale a todo lo retenido

El informe suma `self_size` de los nodos `RetainedEntry`. Es su **shallow size**, tamaño superficial, no la suma de cada payload alcanzable desde ellos.

Los arrays que guardan los números son otros nodos. Decir que mil quinientas entradas solo ocupan la suma superficial ignoraría esos arrays y otras estructuras. El **retained size** plantea otra pregunta: cuánta memoria podría liberarse si un objeto dejara de retener aquello que domina.

Nuestro lector no calcula retained size. Conserva recuentos, tamaño superficial y un camino. Declarar esa limitación evita convertir un dato parcial en una estimación falsa del ahorro de memoria.

## Capturar un heap también tiene un coste y un riesgo

Un snapshot puede pausar el proceso y necesitar memoria adicional. Puede contener datos que no deberían salir de la máquina. No es un archivo inocuo que debamos subir automáticamente desde producción a un repositorio.

Aquí los hijos reciben un entorno mínimo y solo crean datos ficticios. Los heaps completos permanecen en `.artifacts/`, ignorados por Git; el informe conserva sus hashes y resúmenes. El comando permite regenerarlos localmente. Los perfiles de CPU, mucho más pequeños, sí se conservan en el paquete.

## Código completo y pruebas

[Índice de esta entrega](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/perf-memory/README.md) y [lector del snapshot](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/scripts/heap-reader.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab measure:profiles
pnpm --dir packages/performance-lab verify
```

## Garantías y límites

Snapshots reales y recuentos comprobados en un fixture acotado. Sin heap de producción, atribución completa de memoria nativa, retained size, investigación de todos los retainers o soak test del servicio HTTP. Forzar GC y analizar snapshots altera el experimento.

## Ejercicio: añadir una segunda referencia

Guarda una entrada fuera de `items`, retírala de la caché y captura de nuevo. Explica por qué limitar el array ya no basta para liberar ese objeto. Busca el nuevo camino en un visor de heap; no intentes deducirlo solo de RSS.

El siguiente bloque de la ruta editorial tratará observabilidad. Los perfiles ayudan a investigar; para saber cuándo investigar necesitamos señales que representen el comportamiento del servicio en funcionamiento.

## Referencias

- [Node.js: capturar heaps, costes y precauciones](https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot).
- [Node.js 24: process.memoryUsage](https://nodejs.org/docs/latest-v24.x/api/process.html#processmemoryusage).

Fuentes consultadas el 22 de octubre de 2026. Recuentos y hashes en evidence/profiles.json; heaps completos regenerables, no publicados.
