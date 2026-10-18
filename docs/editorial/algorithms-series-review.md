# Revisión: estructuras de datos y algoritmos

18 de octubre de 2026. Ampliación de tres a **21 borradores españoles**, todos
centrados en P011. Se preservan IDs/URLs y los borradores anteriores. Sin Git,
paradigmas, lenguajes o concurrencia de las otras fichas de Serie 02. Después se
inicia Serie 03, como pidió el usuario. Sin publicar, traducir, audio, commit o push.

## Decisiones editoriales

- P011: mapa. DSA-02: contratos, invariantes y complejidad, sin agrupar algoritmos.
- Posts propios para arrays/listas, pilas/colas, BST, búsqueda lineal, lower bound
  y hashing. Cada ordenación tiene su espacio: insertion, selection, bubble,
  merge, quick, heap y counting. Binary heap precede a heapsort y Dijkstra.
- Grafos: representación, BFS, DFS y Dijkstra por separado. Medición al final.
- IDs estables, no números de posición: DSA-03 sigue siendo el benchmark final.
- Ruta en ruta-estructuras-algoritmos.md. Tres objetivos/errores por entrega en
  algorithms-series-scope.md. No se afirma enumerar todos los algoritmos existentes.

## Evidencia ejecutada

- focused.test.mjs primero falló por ausencia de focused.ts. Implementación
  posterior contrastada con referencia y 243 arrays exhaustivos pequeños por
  cada nueva ordenación genérica. Comparadores coherentes como precondición.
- **28 tests del laboratorio**: 13 anteriores + 12 algoritmos + 3 visor. Estabilidad
  por identidad, contraejemplos de inestabilidad, BST degenerado, DFS/ciclos,
  Dijkstra con cero/negativos/no finitos, overflow y descarte stale comprobado
  contando que B se expande una sola vez incluso al agotar la frontera.
- Cinco tests de raíz: 21 metadatos/dependencias, **18 extractos** iguales al código,
  cinco SVG con dimensiones reales, muestras/tabla y ZIP/copias byte a byte.
- TypeScript 5.9.3 strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes;
  Node 24.19.0 con type stripping, que no sustituye el typecheck.
- Suite conjunta: **94 tests distintos aprobados**, 55 raíz + 28 algoritmos + 11
  laboratorio HTTP del inicio de la siguiente serie. Repeticiones no se suman.
- Chromium: **42 vistas** (21 por 1440/360), noindex, navegación 1/21–21/21, TOC,
  imágenes, recursos, KaTeX y ausencia de pageerror/overflow. **10 casos interactivos**
  en explorador y nuevo visor manual; adelante/atrás, rechazo de desorden y salida
  de inserción. Informe/capturas: /tmp/algorithms-layout.3FLqS1. Visor y post móvil
  inspeccionados visualmente.
- ZIP actualizado sin dependencias. Se verifica inventario exacto y bytes. El
  README explica ejecutar tests, benchmark y servidor estático sin instalación.
- Build público correcto; las 21 rutas draft no se emiten. Los assets de public
  siguen siendo públicos, no un mecanismo de confidencialidad.

## Matices revisados

Map exige promedio sublineal en ECMAScript, no un O(1) universal. La búsqueda
binaria presupone orden y no lo valida en cada consulta. El visor sí lo valida
antes de construir su traza y explica la diferencia.

Quicksort de tres arrays es estable por diseño, determinista, no in-place y con
posible espacio vivo O(n²) en el peor caso. No se trasladan propiedades de otras
variantes. Heapsort tiene heapify lineal; su núcleo usa O(1) pero copiar añade O(n).
Counting sort cuesta O(n+k) y reconstruye números, no registros con identidad.

DFS marca al retirar y admite O(E) pendientes; seen no detecta ciclos dirigidos.
Dijkstra valida todo el grafo, pesos enteros seguros no negativos y sumas; usa
entradas obsoletas con cota O(V + E log(E+1)) y espacio O(V+E) bajo el modelo indicado.
AVL/red-black, radix, Bellman–Ford, A* y topological sorting quedan como ampliaciones,
no implementaciones terminadas.

## Medición e incidencias

Se conservan las 324 duraciones originales: 12 casos × 3 variantes × 9 muestras,
200 consultas, cinco warmups, orden rotatorio. Fixtures fuera del reloj; checksum
al terminar. Construcción incluida en fresh y excluida explícitamente en indexed.
No se regeneraron cifras ni se descartaron picos al ampliar artículos.

No se midieron bytes, colisiones del runtime, red, percentiles HTTP ni CPU aislada.
El explorador no suma operaciones distintas ni les asigna nanosegundos.

El formatter cambió comas y el test de snippets detectó divergencia. Se corrigió
sincronizando funciones completas desde AST, no debilitando la comparación.
Una escritura agotó la revisión automática; se comprobó ausencia del archivo y el
reintento permitido funcionó. No constituyó un bloqueo del contenido.

Las 21 entregas desarrollan una ficha P011, no 21 fichas del catálogo. La siguiente
serie está iniciada en ruta-diseno-apis-seguridad.md; el roadmap global no está completo.
