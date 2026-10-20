---
id: DSA-19
title: 'DFS: explorar una rama sin perderse en los ciclos'
published: 2026-10-18T03:18:00Z
locale: es
translationKey: dsa-depth-first-search
slug: dfs-recorrido-profundidad-stack
draft: true
status: draft
level: intermedio
prerequisites: [DSA-05, DSA-17]
description: 'Implementa DFS iterativo con una pila y visitados. Orden de vecinos, ciclos, memoria de pendientes y límites para caminos mínimos.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, grafos, dfs, typescript]
---

Una búsqueda que sigue enlaces recursivamente puede repetir A→B→A hasta desbordar el stack. Para explorar un grafo no basta con elegir un vecino: hay que recordar qué vértices ya procesamos.

**Depth-first search**, o **DFS**, profundiza antes de continuar con otras ramas pendientes. Utilizaremos una pila explícita para hacer visible ese orden y no depender del límite de llamadas recursivas del runtime.

## Profundizar no significa elegir el camino más corto

Si desde A podemos ir a B o D y seguimos B→C→D, llegamos por tres aristas aunque existía una conexión directa. DFS sirve para explorar alcanzabilidad y como base de otros algoritmos; no garantiza un camino mínimo al encontrar un destino por primera vez.

En [BFS](/posts/bfs-recorrido-anchura-camino-minimo), la cola conserva capas. En DFS, la pila LIFO hace que el vecino recién añadido se procese antes que otras ramas pendientes.

```text
Grafo: A -> B, C; B -> A, D; C -> D

Stack (tope a la derecha)   Acción
[A]                        retirar A, apilar C y B
[C, B]                     retirar B, apilar D
[C, D]                     retirar D
[C]                        retirar C; D ya visitado
[]                         terminar

Orden emitido: A, B, D, C
```

Apilar vecinos al revés permite visitar primero el que aparece primero en la lista. Es una política, no una garantía de que cualquier DFS produzca idéntica secuencia.

## La implementación separa pendientes de procesados

Archivo `focused.ts` del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/focused.ts), función completa:

```typescript
export function depthFirst(
  graph: ReadonlyMap<string, readonly string[]>,
  start: string,
): string[] {
  if (!graph.has(start)) return []
  const stack = [start]
  const seen = new Set<string>()
  const order: string[] = []
  while (stack.length) {
    const node = stack.pop()!
    if (seen.has(node)) continue
    seen.add(node)
    order.push(node)
    const neighbors = graph.get(node)!
    // Apilar al revés hace que el primer vecino de la lista se visite antes.
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i]!
      if (!graph.has(neighbor)) throw new RangeError('Vértice inexistente')
      if (!seen.has(neighbor)) stack.push(neighbor)
    }
  }
  return order
}
```

Marcamos al retirar. Un vértice pendiente puede aparecer varias veces en la pila si distintas ramas lo descubren antes de procesarlo. La segunda extracción lo descarta sin volver a emitirlo ni recorrer sus vecinos.

No es la política de marcado al encolar de BFS. Aquí buscamos una exploración sencilla con orden de profundidad; el precio es admitir pendientes duplicados. Ese detalle impide prometer memoria O(V) sin revisar la variante.

## Por qué termina con ciclos

Cada vértice se procesa y emite como máximo una vez. Solo al procesarlo recorremos sus vecinos. La arista hacia A no vuelve a expandirlo porque ya está en `seen`.

Un grafo finito tiene un número finito de entradas de adyacencia. Cada una puede añadir como máximo un pendiente al examinarla. Aunque haya duplicados en la pila, su cantidad total está acotada por las aristas exploradas y terminamos.

Si el origen no existe devolvemos `[]`. Si existe pero está aislado, devolvemos solo ese origen. Para explorar otras componentes habría que lanzar recorridos desde los vértices no visitados y compartir el conjunto de marcados.

## La memoria depende de cómo gestionamos la frontera

El tiempo es O(Vr + Er) con listas de adyacencia y operaciones esperadas acotadas de Map/Set. Salida y `seen` necesitan O(Vr). La pila puede contener O(Er) pendientes por el marcado tardío.

Una variante que guarde marcos con el índice del próximo vecino puede representar la rama activa con O(Vr) espacio, de forma similar al estado recursivo. Marcar antes de apilar también cambia el comportamiento y requiere revisar el orden obtenido, no solo mover una línea.

## Visitar no equivale a detectar ciclos

`seen` evita repetir trabajo, pero no distingue un nodo activo en la rama actual de uno cuya exploración terminó. Para detectar ciclos dirigidos o hacer **topological sorting** necesitamos estados y momentos de salida adicionales.

Reencontrar D desde C no implica un ciclo: B y C pueden conducir a D sin volver hacia un antepasado. No usamos «ya visitado» como detector genérico.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-19/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Los tests cubren orden para vecinos fijos, ciclos, desconexión, origen ausente y referencias inválidas visitadas. No implementamos tiempos de entrada/salida, componentes fuertemente conexas ni orden topológico. La salida es un orden de visita, no una ruta con aristas entre cada par consecutivo.

## Ejercicio: distinguir un cruce de un ciclo

Dibuja A→B, A→C, B→D y C→D. Añade después D→A. Explica por qué el primer grafo no tiene ciclo aunque aparezca un vecino ya visitado, y qué información adicional permitiría detectar el ciclo del segundo durante DFS.

## Referencias

- [Open Data Structures: DFS y recorrido de grafos](https://opendatastructures.org/ods-python/12_3_Graph_Traversal.html).
