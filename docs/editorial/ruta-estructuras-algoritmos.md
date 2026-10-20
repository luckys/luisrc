# Estructuras de datos y algoritmos

Serie en español y en borrador. La ficha P011 se amplía de tres artículos a **21
entregas** por petición del usuario. No incluye Git, paradigmas, lenguajes ni
concurrencia de P010/P012–P019. No depende de Paysafe ni de otra empresa.

## Orden de lectura

1. [Estructuras de datos: elige según lo que necesitas hacer con los datos](../../src/content/posts/es/estructuras-datos-elegir-patron-acceso.md).
2. [Algoritmos: contratos, invariantes y complejidad antes del código](../../src/content/posts/es/algoritmos-busqueda-ordenacion-heaps-grafos.md).
3. [Arrays y linked lists: qué operación estás pagando realmente](../../src/content/posts/es/arrays-listas-enlazadas-costes-reales.md).
4. [Pilas y colas: cómo elegir el orden en que se procesa el trabajo](../../src/content/posts/es/pilas-colas-lifo-fifo.md).
5. [Binary search trees: por qué la altura importa más que el nombre](../../src/content/posts/es/arbol-binario-busqueda-altura-balanceo.md).
6. [Búsqueda lineal: cuándo recorrer los datos es una buena decisión](../../src/content/posts/es/busqueda-lineal-contrato-coste.md).
7. [Búsqueda binaria: entender los límites para no perder la respuesta](../../src/content/posts/es/busqueda-binaria-lower-bound.md).
8. [Hashing y Map: buscar por clave sin olvidar colisiones ni actualizaciones](../../src/content/posts/es/busqueda-hash-map-colisiones.md).
9. [Insertion sort: ordenar manteniendo un prefijo correcto](../../src/content/posts/es/insertion-sort-prefijo-ordenado.md).
10. [Selection sort: pocas posiciones cambiadas, muchas comparaciones](../../src/content/posts/es/selection-sort-minimo-intercambios.md).
11. [Bubble sort: qué demuestra una pasada sin intercambios](../../src/content/posts/es/bubble-sort-intercambios-adyacentes.md).
12. [Merge sort: ordenar al mezclar y conservar los empates](../../src/content/posts/es/merge-sort-mezcla-estabilidad.md).
13. [Quicksort: particionar bien no garantiza elegir bien el pivote](../../src/content/posts/es/quicksort-particion-pivote.md).
14. [Binary heap: mantener la próxima prioridad sin ordenar toda la colección](../../src/content/posts/es/binary-heap-cola-prioridad.md).
15. [Heapsort: ordenar con una frontera y construir el heap en O(n)](../../src/content/posts/es/heapsort-construccion-bottom-up.md).
16. [Counting sort: ordenar contando funciona si puedes pagar el rango](../../src/content/posts/es/counting-sort-rango-frecuencias.md).
17. [Grafos: representar conexiones antes de elegir un recorrido](../../src/content/posts/es/grafos-listas-adyacencia-matrices.md).
18. [BFS: encontrar un camino con el menor número de aristas](../../src/content/posts/es/bfs-recorrido-anchura-camino-minimo.md).
19. [DFS: explorar una rama sin perderse en los ciclos](../../src/content/posts/es/dfs-recorrido-profundidad-stack.md).
20. [Dijkstra: el camino más barato no siempre tiene menos pasos](../../src/content/posts/es/dijkstra-caminos-minimos-pesos.md).
21. [Medir algoritmos: cuándo compensa cambiar una búsqueda lineal por Map](../../src/content/posts/es/medir-algoritmos-busqueda-lineal-map.md).

## Por qué esta división

- Primero contrato, representación y coste: no asignar a una lista el acceso de un array.
- Búsquedas separadas: lineal sin preparación, binaria con orden, hashing con un índice mantenido.
- Una ordenación por artículo: invariant, traza, código, estabilidad, tiempo, memoria y contraejemplos.
- Heaps como estructura antes de heapsort y Dijkstra.
- Grafos: representación antes de BFS, DFS y rutas con pesos.
- Medición al final: no usar un ranking de Big O como sustituto de una carga real.

Los IDs son estables, no números de posición: DSA-03 sigue identificando la
medición final y DSA-21 counting sort. El orden lo fijan fecha y dependencias.
Las 21 entregas desarrollan **una ficha P011**, no 21 fichas del catálogo general.

## Recursos

- [Laboratorio](../../packages/data-structures-algorithms/README.md), [ZIP autónomo](../../publichttps://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/README.md).
- [Visor paso a paso](../../public/assets/interactive/algorithms-series/steps.html): lower bound e insertion sort.
- [Explorador de contadores](../../public/assets/interactive/algorithms-series/explorer.html): consultas y tamaños.
- [Muestras originales](../../packages/data-structures-algorithms/results/benchmark.json), sin regenerar por esta ampliación.
- [Alcance](algorithms-series-scope.md), [glosario](algorithms-series-glossary.md), [revisión](algorithms-series-review.md).

Los interactivos requieren un servidor HTTP, no file://. El README explica la
 ejecución local sin instalaciones. No se traducen, publican ni generan audios.
