# Estructuras de datos y algoritmos

Veintiún artículos españoles que desarrollan la ficha P011. Datos ficticios; solo
CPU/memoria local y, opcionalmente, un servidor de recursos estáticos en loopback.
No requiere instalaciones ni servicios externos. Verificado con Node 24.19.0
(type stripping nativo) y TypeScript 5.9.3 en Linux x64, 18 de octubre de 2026.

## Ejecutar desde esta carpeta

```bash
node --test tests/*.test.mjs
node benchmark.mjs
node serve.mjs
```

El último comando imprime una URL de puerto efímero en 127.0.0.1. Ábrela para el
explorador. Ctrl+C cierra el servidor. No abrir HTML con file://, porque los módulos
necesitan un servidor. El enlace de regreso al artículo funciona en el blog, no en
el servidor mínimo del ZIP.

No hace falta ejecutar pnpm install. El package.json solo declara ESM y la versión
de Node. Si trabajas desde el repositorio del blog, comprueba tipos con la herramienta
ya instalada: `pnpm exec tsc -p examples/estructuras-algoritmos/tsconfig.json`.
Node ejecuta anotaciones borrables pero no comprueba tipos ni aplica tsconfig.

## Archivos y artículos

- P011: algorithms.ts, linearSearch/buildIndex y Queue. IDs enteros seguros no
  negativos y únicos. El índice conserva referencias y debe reconstruirse al
  sustituir el catálogo. Los readonly son controles estáticos, no deep freeze.
- DSA-02: contratos, invariantes y complejidad. Los artículos DSA-04–DSA-21 separan
  arrays/listas, pilas/colas, BST, tres búsquedas, siete ordenaciones y grafos.
- algorithms.ts: lowerBound, mergeSort, MinHeap y shortestPath. Números finitos
  ordenados para lowerBound; comparadores coherentes para ordenación/heap. BFS
  usa grafo dirigido con todos los vértices como claves y vecinos también declarados;
  el orden de vecinos desempata rutas. BFS no resuelve pesos distintos.
- focused.ts: insertion/selection/bubble/quick/heap/counting sort, BST sin balanceo,
  DFS y Dijkstra. Comparadores coherentes; counting sort admite enteros 0..max,
  max <= 100000. Dijkstra valida todo el grafo y usa enteros seguros no negativos;
  descarta prioridades obsoletas y rechaza overflow en las distancias examinadas.
  DFS marca al retirar y puede tener O(E) pendientes, no necesariamente O(V).
- steps.html y steps-model.mjs: visor manual de lower bound e insertion sort.
  Abre /steps.html con node serve.mjs. Las trazas se contrastan con las funciones
  del laboratorio; no son mediciones. En inserción se indica el valor temporal
  mientras el array intermedio muestra el hueco o una copia desplazada.
- DSA-03: benchmark.mjs y results/benchmark.json. Tamaños 1000/5000/20000, lotes
  de 200 consultas, 4 patrones, 5 warmups y 9 muestras con orden rotatorio.
- model.mjs: entradas y contadores deterministas. Se comparte con el explorador;
  no asigna nanosegundos a operaciones ni representa colisiones de Map.
- tests: equivalencia y fallos, cola, heap, búsqueda, ordenación, grafos, muestras
  y servidor local. El test de datos sin ordenar es un contraejemplo deliberado,
  no una garantía de lowerBound fuera de su contrato.

## Datos observados y regeneración

`node benchmark.mjs` imprime una nueva medición sin modificar la archivada. Desde
la raíz del blog, `node scripts/calculate-algorithms.mjs` sí reemplaza el resultado
original de forma explícita. Si lo haces, revisa cifras y tablas de los posts antes
de regenerar gráficas con `node scripts/render-algorithms.mjs` y el ZIP con
`node scripts/package-algorithms.mjs`. No se necesita red para ninguna ejecución.

## Ejercicios comprobables

1. Sustituir un catálogo deja obsoleto el índice: demostrar el fallo y reconstruirlo.
2. Invertir vecinos del grafo cambia la ruta, no la distancia mínima en aristas.
3. Cambiar q a 1 y 2000, conservar muestras y explicar el coste de construir/reutilizar.

No imponer tiempos máximos ni ratios de velocidad en tests. El benchmark no mide
memoria en bytes, tráfico HTTP, concurrencia o garantías de rendimiento del motor.
