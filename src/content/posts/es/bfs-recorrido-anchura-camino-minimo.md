---
id: DSA-18
title: 'BFS: encontrar un camino con el menor número de aristas'
published: 2026-10-18T03:17:00Z
locale: es
translationKey: dsa-bfs-shortest-path
slug: bfs-recorrido-anchura-camino-minimo
draft: true
status: draft
level: intermedio
prerequisites: [DSA-05, DSA-17]
description: 'Sigue la cola de BFS por capas, evita ciclos y reconstruye una ruta con predecesores. Menos aristas no siempre significa menor coste.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, grafos, bfs, typescript]
---

Encontrar una ruta no demuestra que sea la más corta. **Breadth-first search**, o **BFS**, sí puede garantizar un mínimo concreto: el número de aristas, cuando todas cuentan lo mismo.

Después de [representar un grafo](/posts/grafos-listas-adyacencia-matrices), vamos a seguir el orden de sus descubrimientos. La garantía no aparece al usar una cola por costumbre, sino porque esa cola conserva las capas de distancia.

## Una cola mantiene primero lo descubierto antes

Ponemos el origen en una cola FIFO y lo marcamos como descubierto. Retiramos el primero y añadimos sus vecinos todavía desconocidos. Los descubiertos después se colocan al final.

```text
Grafo: A -> B, A -> C, B -> D, C -> D, B -> A

Retirar   Nuevos       Cola tras procesar
A         B, C        [B, C]
B         D           [C, D]
C         ninguno     [D]
D         destino     []

Predecesores: B <- A, C <- A, D <- B
Ruta reconstruida: A -> B -> D
```

B y C están a una arista de A. D se descubre desde B y queda detrás de C. Antes de procesar un vértice a distancia dos, ya hemos procesado los de distancia uno. Esa propiedad distingue BFS de [DFS](/posts/dfs-recorrido-profundidad-stack).

<img src="/assets/visuals/algorithms-series/DSA-02.svg" alt="Grafo dirigido con ciclo entre A y B, rutas A B D y A C D y vértice aislado Z; una cola FIFO conserva las capas del recorrido BFS." width="833" height="1121" loading="lazy" style="width:100%;height:auto" />

## La primera llegada fija un predecesor

El laboratorio guarda un `Map` llamado `previous`. Que un vértice aparezca ahí significa que ya lo descubrimos. Su valor identifica desde dónde llegamos; para el origen usamos `null`.

Este es el bucle de vecinos de `shortestPath`, en `algorithms.ts`:

```typescript
for (const neighbor of graph.get(node) ?? []) {
  if (!graph.has(neighbor)) throw new RangeError(`Vértice inexistente: ${neighbor}`)
  if (previous.has(neighbor)) continue
  // Marcar al encolar evita añadir varias veces un mismo vértice.
  previous.set(neighbor, node)
  frontier.enqueue(neighbor)
}
```

Marcar al **encolar**, no al retirar, evita añadir D dos veces cuando B y C conducen a él. También impide que B→A vuelva a introducir el origen. No basta con evitar procesados duplicados si antes llenamos la cola de copias innecesarias.

La implementación completa está en el [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/algorithms.ts), junto a `Queue`. Incluye comprobación de extremos, extracción, salida temprana y reconstrucción.

## Por qué el primer descubrimiento usa el mínimo de aristas

El origen está a distancia cero. Si procesamos todos los vértices de distancia d antes que los de distancia d+1, cada vecino nuevo añadido desde esa capa tiene un camino de d+1 aristas.

Si hubiera un camino más corto hasta ese vecino, lo habríamos descubierto desde una capa anterior. Por eso no necesitamos sustituir su predecesor cuando lo encontramos desde otra rama.

La prueba depende de que cada arista cuente una unidad. Con una arista directa de coste 100 y una ruta de dos aristas de coste 1 cada una, BFS puede escoger la directa. Es mínima en aristas, no en peso. [Dijkstra](/posts/dijkstra-caminos-minimos-pesos) cambia la prioridad para resolver ese otro problema con pesos no negativos.

## Reconstruir no exige guardar todos los caminos

Cuando retiramos el destino, seguimos `previous` hacia atrás y luego invertimos la secuencia. Cada vértice guarda un predecesor, en lugar de copiar una ruta completa en cada entrada de la cola.

Puede haber varios caminos mínimos. El resultado depende del orden de vecinos: con B antes que C obtenemos A→B→D; invirtiéndolos podemos obtener A→C→D. No atribuimos una unicidad que el grafo no tiene.

Si origen y destino coinciden y existen, devolvemos ese vértice. Si alguno no existe o el destino no es alcanzable, devolvemos `undefined`. Un vértice aislado existente no es lo mismo que un identificador ausente.

## Complejidad con la representación indicada

Con listas de adyacencia visitamos cada vértice alcanzable una vez y examinamos sus aristas salientes. El coste es O(Vr + Er), bajo el modelo de acceso esperado acotado a Map y cola; r identifica la región explorada. O(V + E) es la cota global.

Cola y predecesores ocupan O(Vr). Reconstruir una ruta de L vértices añade O(L). Una matriz obligaría a recorrer filas completas; no trasladamos automáticamente la misma cuenta.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-18/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Los tests cubren ciclos, alternativas, vértices aislados y destino inalcanzable. Validamos las referencias de las aristas examinadas, no las componentes sin recorrer. El grafo no debe cambiar durante la exploración.

## Ejercicio: cambiar FIFO por LIFO

Traza A→B→C→D y A→D. Procesa primero la rama B usando una pila y compara con BFS. Ambos pueden encontrar D, pero solo las capas justifican el mínimo sin buscar todas las rutas. Escribe qué garantía desaparece al cambiar de estructura.

## Referencias

- [Open Data Structures: recorridos de grafos y BFS](https://opendatastructures.org/ods-python/12_3_Graph_Traversal.html).
