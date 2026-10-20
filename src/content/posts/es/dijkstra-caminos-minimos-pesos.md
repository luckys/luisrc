---
id: DSA-20
title: 'Dijkstra: el camino más barato no siempre tiene menos pasos'
published: 2026-10-18T03:19:00Z
locale: es
translationKey: dsa-dijkstra
slug: dijkstra-caminos-minimos-pesos
draft: true
status: draft
level: intermedio
prerequisites: [DSA-15, DSA-18]
description: 'Relajación, min-heap, distancias tentativas y entradas obsoletas: implementa Dijkstra con pesos no negativos y límites numéricos explícitos.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, grafos, dijkstra, typescript]
---

Ir directamente de A a B cuesta 10. Pasar por C cuesta 1 + 1. Un algoritmo que minimiza aristas puede escoger la ruta directa y responder correctamente a la pregunta equivocada.

**Dijkstra** minimiza la suma de pesos cuando son no negativos. A diferencia de [BFS](/posts/bfs-recorrido-anchura-camino-minimo), la próxima entrada no sale de una cola FIFO: sale de una cola de prioridad ordenada por distancia tentativa.

## Distancia conocida no es todavía definitiva

Inicializamos la distancia del origen a cero y las demás como desconocidas, equivalentes a infinito. Al examinar u→v calculamos una candidata: distancia de u más peso de la arista.

Si mejora la distancia de v, la guardamos y recordamos u como predecesor. Este paso se llama **relaxation**. No afirma que tengamos la mejor ruta posible; mejora lo que sabíamos.

```text
A --10--> B --1--> D
 \        ^
  1       1
   v      |
   C -----+

Extraer A=0: descubrir B=10 y C=1
Extraer C=1: mejorar B=2
Extraer B=2: descubrir D=3
Extraer D=3: terminar; ruta A-C-B-D
```

Siempre extraemos la menor distancia pendiente. Con pesos no negativos, una ruta que todavía pase por un vértice más lejano no puede volver con un descuento y mejorar ese mínimo.

## El min-heap mantiene ordenada la prioridad, no toda la salida

La función completa `dijkstra` está en `focused.ts` del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/algorithms.ts). Usa `MinHeap` de `algorithms.ts`, un Map de distancias y otro de predecesores.

Este es su bucle de relajación; validación, extracción y reconstrucción están en el archivo completo:

```typescript
for (const edge of graph.get(current.node)!) {
  const candidate = current.distance + edge.weight
  if (!Number.isSafeInteger(candidate)) throw new RangeError('Distancia fuera de rango')
  if (candidate >= (distances.get(edge.to) ?? Infinity)) continue
  distances.set(edge.to, candidate)
  previous.set(edge.to, current.node)
  frontier.push({ node: edge.to, distance: candidate })
}
```

Cada mejora añade una entrada. No buscamos la anterior dentro del heap ni cambiamos su prioridad. Si al extraer una entrada su distancia no coincide con la vigente en el Map, la descartamos antes de expandir vecinos.

Queda pendiente B=10 después de descubrir B=2. Esa entrada es **stale**, no otra ruta que debamos expandir. Este descarte permite usar un heap sin `decrease-key`.

## Cuándo terminar al encontrar el destino

No terminamos al descubrirlo por primera vez: la candidata podría mejorar. Terminamos al extraerlo con su distancia vigente, porque entonces es el mínimo pendiente y los pesos no negativos permiten fijar esa distancia.

Reconstruimos siguiendo predecesores hasta el origen. No prometemos una ruta única en caso de empate: conservamos la primera mejora estricta y la elección puede depender del orden de exploración.

Con pesos cero seguimos pudiendo aplicar el razonamiento. No insertamos mejoras iguales, por lo que un ciclo de coste cero no genera una secuencia infinita de entradas idénticas.

## Validar antes de aprovechar la salida temprana

Admitimos pesos enteros seguros no negativos y comprobamos todas las aristas antes del recorrido, incluso las desconectadas. Cada destino debe existir como vértice.

No devolvemos una respuesta temprana afirmando que se cumple una precondición que no hemos revisado. En una aplicación mayor podríamos validar al construir un grafo y reutilizarlo para varias consultas.

La suma también debe ser un entero seguro. Dos pesos válidos pueden producir una distancia fuera del rango exacto. Lanzamos un error en vez de continuar con comparaciones posiblemente incorrectas. No usamos decimales de coma flotante para costes monetarios exactos.

Pesos negativos requieren otra estrategia, como Bellman–Ford bajo sus condiciones. Con ciclos negativos alcanzables puede ni siquiera existir un mínimo finito. No arreglamos Dijkstra añadiendo un pequeño parche a la cola.

## El coste incluye las entradas obsoletas

Validar cuesta O(V + E). El heap puede guardar O(E) entradas, con inserciones y extracciones O(log(E + 1)). Una cota global es O(V + E log(E + 1)), con memoria O(V + E), bajo operaciones de Map esperadas acotadas.

No atribuimos memoria O(V) a esta frontera ni usamos sin explicación la cota de una versión con `decrease-key`. Las variantes importan al traducir el análisis al código.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-20/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Los tests cubren mejoras, peso cero, entradas obsoletas, destino inaccesible, origen igual al destino, referencias inválidas, pesos negativos/no finitos y overflow. No integramos mapas externos ni implementamos A\*, Bellman–Ford o cambios concurrentes.

## Ejercicio: una salida demasiado temprana

Usa A→D de coste 20, A→B de coste 2 y B→D de coste 2. Compara terminar al descubrir D con hacerlo al extraer su distancia vigente. Exige distancia 4 y ruta A→B→D. Después añade peso negativo y exige rechazo antes de empezar.

## Referencias

- [Boost Graph Library: Dijkstra y pesos no negativos](https://www.boost.org/doc/libs/latest/libs/graph/doc/html/graph/algorithms/shortest_paths/dijkstra_shortest_paths.html).
