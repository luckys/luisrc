---
id: P011
title: 'Estructuras de datos: elige según lo que necesitas hacer con los datos'
published: 2026-10-18T03:00:00Z
locale: es
translationKey: data-structures-access-pattern
slug: estructuras-datos-elegir-patron-acceso
draft: true
status: draft
math: true
level: intermedio
prerequisites: []
description: 'Arrays, listas, sets, maps, pilas, colas, heaps, árboles y grafos: elegir por operaciones, semántica y costes, no por costumbre.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, algoritmos, complejidad, typescript]
---

Un catálogo carga sus documentos una vez y después los busca por ID cientos de veces. Guardarlos en un array funciona, pero recorrerlo completo en cada búsqueda repite un trabajo que podríamos preparar una sola vez.

Eso no convierte al array en una mala estructura. Si solo recorremos el catálogo para mostrarlo, construir un índice puede añadir trabajo sin resolver ningún problema. La decisión empieza por **qué operaciones necesitamos y con qué frecuencia**, no por qué colección parece más sofisticada.

Esta serie tiene 21 entregas: este mapa de decisiones, [contratos e invariantes](/posts/algoritmos-busqueda-ordenacion-heaps-grafos), estructuras concretas, tres estrategias de búsqueda, siete ordenaciones y grafos. Cada algoritmo tiene espacio para seguir sus pasos, justificar sus límites y probar los errores habituales. Cerramos con [una medición de búsqueda lineal frente a Map](/posts/medir-algoritmos-busqueda-lineal-map). No necesitas un framework: utilizaremos datos ficticios y un laboratorio en **TypeScript**.

## El contrato de una colección no es su implementación

Una **estructura de datos** organiza información para facilitar ciertas operaciones. Un **abstract data type**, o tipo abstracto de datos, define qué operaciones ofrece sin obligarnos a implementarlas de una única manera.

Una **queue** promete atender elementos en orden FIFO, _first in, first out_. Puede implementarse con una lista enlazada o con un buffer circular. Lo importante para quien la usa es ese orden; para quien la implementa también importan las asignaciones, el acceso a memoria y el coste de cada operación.

Antes de elegir, concreta cuatro preguntas: ¿buscas por posición o por clave?, ¿importa el orden?, ¿aceptas duplicados?, ¿cuántas actualizaciones ocurren entre consultas? Esas respuestas pueden descartar una estructura aunque sea rápida en un benchmark ajeno.

<img src="/assets/visuals/algorithms-series/P011.svg" alt="La operación dominante guía la elección: posición y recorrido llevan a arrays; claves a Set o Map; llegada a colas o pilas; prioridad a heaps; relaciones a árboles o grafos. Todas las alternativas requieren evaluar duplicados, actualizaciones y memoria." width="1313" height="782" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/algorithms-series/P011.svg).

## Arrays y listas enlazadas: acceder no es lo mismo que insertar

Un **array** clásico permite calcular dónde está una posición a partir de su índice. Una lista basada en un array dinámico añade capacidad de crecimiento: cuando falta espacio, puede reservar otro bloque y copiar elementos. Por eso añadir al final puede ser barato **amortizado**, aunque una ampliación concreta sea costosa.

Insertar al principio o en medio suele exigir desplazar elementos. La [implementación de listas basadas en arrays de Open Data Structures](https://opendatastructures.org/ods-python/2_Array_Based_Lists.html) explica esa diferencia entre acceso y movimiento. El `Array` de JavaScript es una colección más flexible que un bloque de enteros de tamaño fijo; no debemos atribuirle un layout físico idéntico en todos los motores.

Una **linked list** conserva nodos unidos por referencias. No calcula directamente la posición 500: debe seguir enlaces. Cambiar unos enlaces puede costar O(1), **si ya tenemos las referencias necesarias**. Encontrarlas mediante una búsqueda puede costar O(n). En una lista simplemente enlazada, borrar un nodo interior necesita además su predecesor, salvo que cambiemos el contrato de la operación.

Los nodos añaden memoria y seguir referencias puede perjudicar la localidad. No elegimos una lista enlazada solo porque «inserta rápido». Comparamos el recorrido completo necesario y qué información conserva cada operación. Véase [SLList y sus operaciones de extremos](https://opendatastructures.org/ods-python/3_1_SLList_Singly_Linked_Li.html).

## Set responde si existe; Map permite recuperar un valor por clave

Un **set** representa pertenencia sin duplicados. Un **map** asocia cada clave con un valor. Para comprobar IDs procesados basta un `Set<number>`; para recuperar el documento necesitamos un `Map<number, Documento>`.

Una **hash table** calcula un hash de la clave para localizar una zona candidata. Si varias claves coinciden, necesita resolver **collisions** y comprobar igualdad; si aumenta la ocupación, puede reorganizar el almacenamiento. El O(1) esperado que suele asociarse a hashing necesita supuestos sobre dispersión, carga y coste de las claves. No significa «una instrucción» ni garantiza el peor caso. El [capítulo de hashing con encadenamiento](https://opendatastructures.org/ods-python/5_1_ChainedHashTable_Hashin.html) desarrolla esos supuestos.

En JavaScript hay otra precisión importante: la [especificación de Map y Set](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects) exige acceso sublineal **en promedio**, no una implementación concreta ni O(1) universal. Ambos recorren elementos según su orden de inserción, no ordenados por valor. Para claves objeto, dos objetos con el mismo contenido no son automáticamente la misma clave.

## Cambiar a Map puede cambiar el resultado si ignoramos duplicados

Una búsqueda lineal devuelve el primer documento coincidente. Construir un Map sobrescribiendo claves conserva el último. Si el catálogo contiene IDs repetidos, sustituir una implementación por otra puede modificar el resultado sin producir ninguna excepción.

El [laboratorio descargable](/assets/examples/estructuras-algoritmos-lab.zip) exige IDs enteros seguros no negativos y únicos. Preferimos rechazar un catálogo ambiguo en lugar de decidir silenciosamente qué documento gana.

Archivo: `estructuras-algoritmos/algorithms.ts`, función completa `buildIndex`.

```typescript
export function buildIndex<T extends { readonly id: number }>(
  rows: readonly T[],
): Map<number, T> {
  const index = new Map<number, T>()
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id < 0) throw new RangeError('ID inválido')
    if (index.has(row.id)) throw new Error(`ID duplicado: ${row.id}`)
    index.set(row.id, row)
  }
  return index
}
```

La validación forma parte del coste de construcción que mediremos. El índice conserva referencias a los documentos, no copias independientes. Si cambiamos un título veremos el mismo objeto; si cambiamos el ID, la clave anterior no se actualiza sola. En este ejemplo tratamos el catálogo como una **snapshot**: al sustituirlo, reconstruimos el índice.

## Stack y queue expresan dos órdenes distintos

Una **stack**, o pila, sigue LIFO, _last in, first out_: sirve para deshacer la última acción o recorrer una estructura en profundidad. Una **queue**, o cola, sigue FIFO: atiende primero lo que llegó antes. Son contratos de orden, no sinónimos de array.

Nuestra cola usa nodos enlazados y conserva cabeza y cola. Encolar enlaza un nodo al final; desencolar mueve la cabeza al siguiente. Ambas operaciones hacen una cantidad constante de cambios de referencias, sin recorrer los elementos.

Archivo: `estructuras-algoritmos/algorithms.ts`, método `dequeue` dentro de `Queue<T>`.

```typescript
dequeue(): T {
  if (!this.#head) throw new RangeError('Cola vacía')
  const { value, next } = this.#head
  this.#head = next
  if (!next) this.#tail = undefined
  this.#size--
  return value
}
```

Al quitar el último nodo también vaciamos la cola final. Si olvidamos ese detalle, la próxima inserción puede enlazarse a un nodo que ya no pertenece a la colección. Los tests vacían y reutilizan la cola para detectar precisamente ese fallo. La implementación completa, con `enqueue`, está en el ZIP.

Devolver un error cuando está vacía permite almacenar incluso `undefined` sin confundirlo con ausencia. Un buffer circular sería una alternativa con menos asignaciones; elegiría esa opción si el perfil señalara la cola como un coste relevante. Esta cola no implementa concurrencia entre procesos, persistencia ni backpressure.

## Heap, árbol y grafo no son tres nombres para una jerarquía

Un **heap** facilita recuperar el siguiente elemento por prioridad. Un min-heap mantiene cada padre menor o igual que sus hijos; no ordena todos los elementos entre sí. Un **árbol de búsqueda** mantiene otra propiedad: las claves del subárbol izquierdo preceden a la del nodo y las del derecho la siguen. Puede responder consultas de orden y rangos que un heap no resuelve directamente.

Un árbol de búsqueda **balanceado** limita su altura para mantener operaciones logarítmicas; un árbol sin balance puede degenerar en una cadena. No basta con decir «uso un árbol» para prometer O(log n). El [árbol de búsqueda sin balance de Open Data Structures](https://opendatastructures.org/ods-python/6_2_BinarySearchTree_Unbala.html) muestra por qué importa la altura.

Un **grafo** representa conexiones entre vértices: puede tener ciclos, varias rutas y nodos aislados. Un árbol es un caso particular, no el modelo adecuado para cualquier red de relaciones. Las entregas de [representación de grafos](/posts/grafos-listas-adyacencia-matrices), BFS, DFS y Dijkstra separan conexiones, recorridos y costes.

## Una tabla de costes necesita sus supuestos

Estos costes corresponden a modelos habituales, no a tiempos medidos del motor JavaScript. `n` es el número de elementos; las claves y comparaciones tienen coste acotado.

<div class="overflow-x-auto" role="region" aria-label="Costes y supuestos de cada estructura" tabindex="0">

| Estructura                     | Operación útil                      | Coste en ese modelo       | Condición que no conviene ocultar                |
| ------------------------------ | ----------------------------------- | ------------------------- | ------------------------------------------------ |
| Array dinámico                 | Acceder por índice; añadir al final | O(1); O(1) amortizado     | Crecer puede copiar n elementos                  |
| Lista simplemente enlazada     | Encolar y quitar cabeza             | O(1)                      | Conservar cabeza/cola; buscar un nodo no es O(1) |
| Hash table                     | Buscar una clave                    | O(1) esperado             | Depende de hashing, carga y colisiones           |
| Pila o cola                    | Extraer el próximo elemento         | Depende de implementación | LIFO/FIFO es el contrato, no el coste            |
| Binary heap                    | Insertar; extraer mínimo            | O(log n)                  | Reordenación; crecimiento del array se amortiza  |
| Árbol de búsqueda balanceado   | Buscar y actualizar                 | O(log n)                  | Mantener el balance tiene un coste               |
| Grafo con listas de adyacencia | Enumerar vecinos de v               | O(grado de v)             | Una matriz ofrece otros costes y ocupa O(V²)     |

</div>

No estamos ante una clasificación de mejor a peor. Si necesitamos mostrar todos los documentos en orden, un índice por clave no elimina ese recorrido. Podemos mantener array e índice juntos, pero ahora debemos conservar su coherencia y pagar la memoria adicional.

## Garantías y límites

Los tests comprueban equivalencia entre búsqueda lineal e índice para IDs válidos únicos, rechazo de duplicados y comportamiento FIFO incluso al reutilizar una cola vacía. No demuestran que Map sea siempre más rápido, que las referencias sean inmutables en runtime o que esta colección sea apta para acceso concurrente.

Descarga el ZIP y, desde su carpeta, ejecuta `node --test tests/*.test.mjs` con Node 24.19.0 o posterior compatible. No hace falta instalar dependencias. En el repositorio del blog también comprobamos los tipos con TypeScript 5.9.3; ejecutar código no sustituye esa comprobación.

## Ejercicio: un índice que ya no representa al catálogo

Construye el índice de dos documentos y después sustituye el catálogo por otro que quite uno de ellos. El test debe demostrar que reutilizar el índice antiguo devuelve un documento eliminado. Corrígelo reconstruyendo el índice y comprueba que ambos caminos vuelven a producir el mismo resultado.

Ese ejercicio introduce una decisión real para cualquier catálogo de aplicación: **cuándo deja de ser válida la estructura derivada**. En [la siguiente parte](/posts/algoritmos-busqueda-ordenacion-heaps-grafos) pasamos de elegir una colección a explicar por qué una búsqueda o un recorrido encuentra la respuesta correcta.

## Referencias

Fuentes consultadas el 18 de octubre de 2026: los capítulos de Pat Morin y la especificación enlazados en cada sección. Para el entorno ejecutable: [soporte de TypeScript en Node 24.19.0](https://nodejs.org/download/release/v24.19.0/docs/api/typescript.html), que elimina anotaciones pero no comprueba tipos.
