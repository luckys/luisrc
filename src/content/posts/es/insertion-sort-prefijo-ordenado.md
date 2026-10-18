---
id: DSA-10
title: 'Insertion sort: ordenar manteniendo un prefijo correcto'
published: 2026-10-18T03:08:00Z
locale: es
translationKey: dsa-insertion-sort
slug: insertion-sort-prefijo-ordenado
draft: true
status: draft
level: intermedio
prerequisites: [DSA-04, DSA-02]
description: 'Aprende insertion sort paso a paso: desplazar valores, conservar empates y relacionar el trabajo con las inversiones de la entrada.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, insertion-sort, typescript]
---

Un array casi ordenado no necesita necesariamente el mismo trabajo que uno invertido. **Insertion sort** aprovecha esa diferencia: cada elemento nuevo retrocede solo hasta encontrar su posición entre los que ya estaban ordenados.

Es el primer algoritmo de ordenación que implementaremos. Su interés no está en recomendarlo para cualquier colección, sino en poder explicar cada movimiento y demostrar que los elementos iguales conservan su orden.

## Qué significa ordenar según un comparador

El comparador recibe a y b. Devuelve un número negativo si a debe ir antes, positivo si debe ir después y cero si ambos son equivalentes para ese criterio. Necesitamos que ese criterio sea coherente durante toda la operación.

Ordenar pedidos por importe no significa eliminar los que tienen el mismo importe. Una ordenación correcta conserva todos los elementos y sus multiplicidades. Una ordenación **stable** conserva además el orden relativo de los equivalentes.

Nuestros algoritmos reciben un array de solo lectura y devuelven otro array. Los objetos internos se comparten: no hacemos una copia profunda. Así podemos comparar variantes sin que una ordenación prepare accidentalmente la entrada de la siguiente.

## La frontera separa lo ordenado de lo pendiente

Al empezar la iteración i, el tramo `[0, i)` ya está ordenado. Guardamos el valor de la posición i, desplazamos a la derecha los anteriores que son mayores y colocamos el valor en el hueco restante.

```text
Entrada: [4, 2, 3, 1]
i = 1: guardar 2, desplazar 4      -> [2, 4 | 3, 1]
i = 2: guardar 3, desplazar 4      -> [2, 3, 4 | 1]
i = 3: guardar 1, desplazar 4,3,2  -> [1, 2, 3, 4 | ]
```

No se pierde el elemento que estaba en i porque lo conservamos en `value` antes de sobrescribir posiciones. El índice j identifica el hueco que queda al desplazar. Cada paso reduce j, por lo que el bucle interior termina.

Archivo `focused.ts` del [laboratorio](/assets/examples/estructuras-algoritmos-lab.zip), función completa:

```typescript
export function insertionSort<T>(
  input: readonly T[],
  compare: (a: T, b: T) => number,
): T[] {
  const items = [...input]
  for (let i = 1; i < items.length; i++) {
    const value = items[i]!
    let j = i
    while (j > 0 && compare(items[j - 1]!, value) > 0) {
      items[j] = items[j - 1]!
      j--
    }
    items[j] = value
  }
  return items
}
```

La condición `> 0` es deliberada: no desplazamos un elemento equivalente al que insertamos. El nuevo queda después de los equivalentes anteriores. Cambiarla por `>= 0` seguiría ordenando las claves, pero perdería estabilidad.

## Las inversiones explican cuánto hay que desplazar

Una **inversion** es un par de posiciones en el orden incorrecto: i está antes que j, pero su valor debería ir después. En `[3, 1, 2]`, los pares 3–1 y 3–2 son inversiones.

Cada desplazamiento de insertion sort corrige una de esas inversiones. Si hay I inversiones, el trabajo de esta versión se describe como O(n + I), suponiendo comparaciones y asignaciones de coste acotado. Esto explica mejor el comportamiento con entradas casi ordenadas que decir únicamente O(n²).

En un array ya ordenado, cada nuevo valor comprueba el anterior y se queda en su lugar: O(n). En el orden inverso con claves distintas, hay n(n−1)/2 inversiones y el trabajo es O(n²). La copia inicial cuesta O(n) y ocupa O(n) memoria adicional; el núcleo de inserción solo necesita un valor y unos índices.

## Cuándo resulta útil y cuándo no

Tiene sentido para estudiar invariantes y para tramos pequeños o casi ordenados. Algunas estrategias híbridas utilizan algoritmos simples en particiones pequeñas, donde las constantes y las asignaciones importan. Eso no demuestra que nuestra función supere a la ordenación del runtime: no hemos medido esa afirmación.

Si recibimos millones de elementos arbitrarios, su peor caso cuadrático es una razón suficiente para estudiar [merge sort](/posts/merge-sort-mezcla-estabilidad), [quicksort](/posts/quicksort-particion-pivote) o [heapsort](/posts/heapsort-construccion-bottom-up).

En código de aplicación, la primera opción suele ser la biblioteca estándar. En TypeScript, recuerda que `sort()` modifica el array y necesita un comparador para ordenar números numéricamente; `toSorted()` permite obtener una copia ordenada en runtimes compatibles.

## Garantías y límites

Los tests comparan la salida con una referencia para 243 arrays de longitud cinco con claves −1, 0 y 1, además de casos vacíos, ordenados e invertidos. También usan objetos con la misma clave e identidades distintas para comprobar estabilidad. No validamos en ejecución que el comparador sea transitivo.

[El visor paso a paso](/assets/interactive/algorithms-series/steps.html) permite seleccionar insertion sort y seguir los desplazamientos. Muestra el valor guardado fuera del array para no confundir un estado intermedio con una pérdida de elementos. Sus trazas se contrastan con la función probada del laboratorio.

## Ejercicio: hacer visible la estabilidad

Ordena por `key` las entradas `(2,a), (1,b), (2,c), (1,d)`. El resultado estable debe ser `(1,b), (1,d), (2,a), (2,c)`. Cambia la condición del bucle por `>= 0` y añade un test que falle por el cambio de orden entre b y d. Comparar solo `[1,1,2,2]` no detectaría el defecto.

## Referencias

- [Miller y Ranum: insertion sort y prefijo ordenado](https://www.openbookproject.net/books/pythonds/SortSearch/TheInsertionSort.html).
- [ECMAScript: Array.prototype.sort](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-array.prototype.sort).
