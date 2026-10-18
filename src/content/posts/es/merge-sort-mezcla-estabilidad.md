---
id: DSA-13
title: 'Merge sort: ordenar al mezclar y conservar los empates'
published: 2026-10-18T03:11:00Z
locale: es
translationKey: dsa-merge-sort
slug: merge-sort-mezcla-estabilidad
draft: true
status: draft
level: intermedio
prerequisites: [DSA-10]
description: 'Sigue las divisiones y mezclas de merge sort. Demuestra estabilidad, calcula el trabajo por niveles y distingue memoria máxima de asignaciones acumuladas.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, merge-sort, typescript]
---

Mezclar dos listas ya ordenadas no exige ordenar otra vez todos sus pares. Basta con mirar el primer elemento pendiente de cada lista y elegir el menor. **Merge sort** construye una ordenación completa alrededor de esa operación.

Después de los algoritmos cuadráticos, vamos a estudiar qué cambia al dividir el problema. La ventaja no aparece por usar recursión: aparece porque las mitades se reducen de forma equilibrada y cada nivel hace una cantidad lineal de trabajo.

## Dividir es fácil; combinar debe conservar una garantía

Un array vacío o con un elemento ya está ordenado. Para uno mayor, dividimos por la mitad, ordenamos cada mitad y mezclamos las dos salidas.

```text
                   [4, 1, 3, 2]
                 /              \
             [4, 1]            [3, 2]
             /    \            /    \
           [4]    [1]        [3]    [2]
             \    /            \    /
             [1, 4]            [2, 3]
                 \              /
                   [1, 2, 3, 4]
```

La mezcla mantiene un invariante: la salida contiene los menores elementos ya consumidos, en orden. El siguiente menor solo puede estar en la primera posición pendiente de alguna mitad, porque cada mitad ya está ordenada.

Si agotamos una mitad, todo lo que queda de la otra puede añadirse tal cual. No necesitamos nuevas comparaciones entre ambas. Este es el paso que justifica el coste lineal de combinar.

## Una implementación completa que permite seguir los índices

Archivo `algorithms.ts` del [laboratorio](/assets/examples/estructuras-algoritmos-lab.zip):

```typescript
export function mergeSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  if (input.length < 2) return [...input]
  const middle = Math.floor(input.length / 2)
  const left = mergeSort(input.slice(0, middle), compare)
  const right = mergeSort(input.slice(middle), compare)
  const output: T[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    // Elegir izquierda en empate conserva el orden relativo original.
    if (compare(left[i]!, right[j]!) <= 0) output.push(left[i++]!)
    else output.push(right[j++]!)
  }
  while (i < left.length) output.push(left[i++]!)
  while (j < right.length) output.push(right[j++]!)
  return output
}
```

Los índices i y j solo avanzan cuando consumimos un elemento. Cada iteración de mezcla aumenta la salida y reduce lo pendiente; no puede duplicar ni omitir una entrada si los límites están bien definidos.

El caso base es necesario para terminar. Sin él, seguiríamos dividiendo arrays vacíos o unitarios. Las aserciones `!` se apoyan en los límites comprobados antes del acceso, no sustituyen validaciones de datos externos.

## La estabilidad se decide al empatar

Si las cabezas de ambas mitades tienen la misma clave, escogemos primero la izquierda con `<= 0`. Los elementos de esa mitad aparecían antes en la entrada que los de la derecha. Como las mezclas internas también son estables, preservamos el orden relativo en todos los niveles.

Prueba `(2,a), (1,b), (2,c), (1,d)`. La salida debe ser `(1,b), (1,d), (2,a), (2,c)`. Cambiar `<=` por `<` haría que algunos equivalentes de la derecha adelantaran a los de la izquierda. Los números seguirían pareciendo correctos; las identidades revelarían el cambio.

## Por qué el tiempo es O(n log n)

En un nivel, la suma de elementos de todas las mezclas es n. La profundidad es O(log n) porque dividimos aproximadamente por dos hasta llegar a tamaños unitarios. Multiplicar ambos trabajos da O(n log n), suponiendo un comparador de coste acotado.

La entrada ordenada no elimina los niveles ni las copias de esta versión. No hay una comprobación que permita saltarse una mezcla ya ordenada. No le atribuimos la adaptación de otros algoritmos o variantes por compartir el nombre.

El espacio auxiliar máximo algorítmico para arrays es O(n), más O(log n) de stack recursivo. Pero asignamos arrays en muchos niveles: el volumen acumulado de elementos copiados y reservados puede ser O(n log n). Además, el heap observado del runtime puede retener memoria hasta que actúe el garbage collector. Memoria viva necesaria y RSS medido no son la misma magnitud.

## Qué cambiaría en una implementación de producción

Podríamos reutilizar un buffer, trabajar sobre intervalos en vez de `slice` o implementar una versión **bottom-up** que mezcle tramos de tamaños 1, 2, 4 y así sucesivamente. Cada alternativa reduce algunos costes y añade decisiones de implementación.

Aquí preferimos hacer visible la idea antes que minimizar asignaciones. Para ordenar datos de aplicación usaríamos normalmente la biblioteca estándar. Si los datos no caben en memoria, una ordenación externa requiere otro análisis: leer y escribir bloques de disco, no solo comparar elementos.

## Garantías y límites

Los tests comprueban orden, multiplicidades, estabilidad y ausencia de mutación del array original. No garantizamos copia profunda ni comportamiento con comparadores inconsistentes. No medimos esta función contra `sort()` y no presentamos O(n log n) como una promesa de latencia.

## Ejercicio: romper solo los empates

Cambia la condición de mezcla para elegir el elemento derecho cuando el comparador devuelve cero. Ejecuta el test con objetos y observa qué propiedad falla. Después explica por qué una prueba que solo comprueba que las claves están ordenadas no sería suficiente.

La siguiente alternativa distribuye por un pivote antes de resolver las partes: [quicksort](/posts/quicksort-particion-pivote).

## Referencias

- [Open Data Structures: merge sort y análisis por niveles](https://opendatastructures.org/ods-python/11_1_Comparison_Based_Sorti.html).
