---
id: DSA-08
title: 'Búsqueda binaria: entender los límites para no perder la respuesta'
published: 2026-10-18T03:06:00Z
locale: es
translationKey: dsa-binary-search-lower-bound
slug: busqueda-binaria-lower-bound
draft: true
status: draft
level: intermedio
prerequisites: [DSA-07]
description: 'Implementa lower bound con un intervalo semiabierto y sigue cada actualización. Duplicados, posición de inserción, terminación y datos sin ordenar.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, busqueda-binaria, invariantes, typescript]
---

Una búsqueda binaria con un límite mal actualizado puede fallar justo cuando quedan dos posiciones. Con duplicados, además, «he encontrado el valor» no responde necesariamente a «dónde empieza su grupo».

En lugar de memorizar una variante de `low`, `high` y `middle`, vamos a dar un significado preciso a cada límite. Partimos de la [búsqueda lineal](/posts/busqueda-lineal-contrato-coste), pero ahora aceptamos una precondición nueva: los datos están ordenados.

## Lower bound responde dónde empieza una frontera

**Lower bound** devuelve la primera posición cuyo valor es mayor o igual al objetivo. Si no existe, devuelve `length`. Para `[2, 4, 4, 9]`, el lower bound de 4 es 1, el de 5 es 3 y el de 10 es 4.

No siempre devuelve una coincidencia. Para consultar pertenencia necesitamos comprobar también que la posición sea menor que la longitud y que allí esté el valor buscado. Esta separación permite reutilizar el algoritmo para inserciones o rangos de valores.

Archivo `algorithms.ts`, función completa del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/algorithms.ts):

```typescript
export function lowerBound(sorted: readonly number[], target: number): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (sorted[middle]! < target) low = middle + 1
    else high = middle
  }
  return low
}
```

Admitimos números finitos ordenados de menor a mayor y un objetivo finito. No incluimos `NaN`, porque sus comparaciones no proporcionan el orden que exige el razonamiento.

## El intervalo pendiente es [low, high)

Antes de `low`, todos los valores son menores que el objetivo. Desde `high` hasta el final, todos son mayores o iguales. Lo que falta por clasificar está entre ambos límites: incluye `low`, pero no incluye `high`.

Al empezar, los dos tramos conocidos están vacíos. Si el centro es menor que el objetivo, también lo son las posiciones anteriores hasta ese centro. Podemos descartarlas haciendo `low = middle + 1`.

Si el centro es mayor o igual, podría ser la respuesta. No podemos saltarlo con `high = middle - 1`; lo conservamos como frontera usando `high = middle`.

```text
Array [2, 4, 4, 9], objetivo 4

low  high  middle  valor  actualización
 0     4      2      4    high = 2
 0     2      1      4    high = 1
 0     1      0      2    low  = 1
 1     1      -      -    termina, devuelve 1
```

Cuando `low === high`, el intervalo pendiente está vacío. Los dos tramos conocidos se tocan en la primera posición válida. Eso cubre también el array vacío: ambos límites comienzan en cero y no entramos al bucle.

## La terminación se puede demostrar

El tamaño pendiente es `high - low`. El centro siempre cumple `low <= middle < high`. En ambas ramas reducimos ese tamaño al menos una unidad; no queda un caso de dos elementos en el que los límites permanezcan iguales.

El `!` de `sorted[middle]!` informa a TypeScript de que el acceso tiene valor; no comprueba el índice en ejecución. Lo justifica el razonamiento anterior. Usarlo sobre un índice recibido del usuario sin validación sería otro asunto.

Cada iteración reduce aproximadamente a la mitad los candidatos. El número de iteraciones es O(log n) y la memoria auxiliar es O(1), suponiendo acceso por índice y comparación de coste acotado. Sobre una lista enlazada no podríamos acceder al centro con ese mismo coste.

## Ordenar una vez y consultar muchas no es ordenar para cada consulta

Con `[3, 1, 2]` y objetivo 3, esta función devuelve 3 aunque el valor está en la posición cero. No es un bug del bucle: la entrada viola el contrato que permitía descartar posiciones.

Comprobar que todo esté ordenado dentro de cada búsqueda costaría O(n). En una aplicación, conviene establecer esa garantía al construir o actualizar la colección y no destruirla después.

Ordenar para una sola consulta también tiene un coste. Si necesitas la primera coincidencia en el orden original, ordenar puede cambiar incluso la pregunta. Una búsqueda binaria no sustituye automáticamente a cualquier `find`.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-08/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Las pruebas comparan el resultado con una referencia lineal sobre arrays ordenados, incluidos vacíos, duplicados, objetivos antes y después de todos los valores. También conservan el contraejemplo sin ordenar. No implementamos **upper bound**: sería la primera posición estrictamente mayor, con un invariante relacionado pero otra condición.

[Abre el visor paso a paso](/assets/interactive/algorithms-series/steps.html). Puedes cambiar el objetivo, retroceder y observar cómo se reduce el intervalo. El visor rechaza entradas sin ordenar antes de preparar la traza; esa validación didáctica no forma parte de cada consulta del algoritmo del laboratorio.

## Ejercicio: localizar un rango de duplicados

Traza lower bound para `[1, 4, 4, 4, 8]` y objetivos 0, 4 y 9. Después diseña upper bound y comprueba que la diferencia entre ambas fronteras da el número de apariciones de 4. No cambies solo `<` por `<=` sin explicar qué significa cada tramo.

La siguiente búsqueda cambia orden previo por un índice: [hashing y Map](/posts/busqueda-hash-map-colisiones).

## Referencias

- [Open Data Structures: búsqueda binaria en arrays ordenados](https://opendatastructures.org/ods-python/11_1_Comparison_Based_Sorti.html).
- [Open Data Structures: corrección y análisis de complejidad](https://opendatastructures.org/ods-python/1_5_Correctness_Time_Comple.html).
