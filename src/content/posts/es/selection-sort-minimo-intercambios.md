---
id: DSA-11
title: 'Selection sort: pocas posiciones cambiadas, muchas comparaciones'
published: 2026-10-18T03:09:00Z
locale: es
translationKey: dsa-selection-sort
slug: selection-sort-minimo-intercambios
draft: true
status: draft
level: intermedio
prerequisites: [DSA-10]
description: 'Traza selection sort y distingue comparaciones de intercambios. Un contraejemplo con objetos muestra por qué esta variante no es estable.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, selection-sort, typescript]
---

Ordenar un array que ya está ordenado puede seguir costando trabajo cuadrático. **Selection sort** lo muestra con claridad: aunque no necesite recolocar casi nada, vuelve a buscar el mínimo entre todos los elementos pendientes.

Después de [insertion sort](/posts/insertion-sort-prefijo-ordenado), conviene estudiar una estrategia que también construye un prefijo ordenado, pero lo hace por una razón distinta. Compartir el dibujo de la salida no implica compartir el coste.

## Cada pasada elige el menor de los pendientes

Al empezar la posición i, el prefijo contiene los i elementos menores en su ubicación definitiva. Recorremos el sufijo, conservamos la posición de su mínimo y lo intercambiamos con el elemento situado en i.

```text
Entrada: [4, 2, 3, 1]
i = 0: mínimo 1, intercambiar con 4 -> [1 | 2, 3, 4]
i = 1: mínimo 2, ya está ahí       -> [1, 2 | 3, 4]
i = 2: mínimo 3, ya está ahí       -> [1, 2, 3 | 4]
```

La primera pasada ya ordena casualmente esta entrada completa, pero el algoritmo no lo sabe. Ha demostrado que 1 es el mínimo, no que el sufijo restante esté ordenado. Necesita seguir comparando para sostener su contrato.

## La implementación hace explícita la búsqueda del mínimo

Archivo `focused.ts`, función completa del [laboratorio](/assets/examples/estructuras-algoritmos-lab.zip):

```typescript
export function selectionSort<T>(
  input: readonly T[],
  compare: (a: T, b: T) => number,
): T[] {
  const items = [...input]
  for (let i = 0; i < items.length - 1; i++) {
    let smallest = i
    for (let j = i + 1; j < items.length; j++)
      if (compare(items[j]!, items[smallest]!) < 0) smallest = j
    const value = items[i]!
    items[i] = items[smallest]!
    items[smallest] = value
  }
  return items
}
```

Durante el bucle interior, `smallest` identifica el menor elemento del tramo que ya hemos inspeccionado. Al terminar, representa el mínimo del sufijo completo. El intercambio amplía el prefijo correcto en una posición.

Usamos una copia para no modificar el array de entrada. Las aserciones `!` corresponden a índices delimitados por la longitud; no convierten una entrada arbitraria en datos válidos. El comparador sigue teniendo que definir un orden coherente.

## Comparaciones y movimientos no son la misma cuenta

Para n elementos hacemos `(n−1) + (n−2) + ... + 1`, es decir n(n−1)/2 comparaciones. Esa cuenta no depende de que los datos ya estuvieran ordenados. Su tiempo es Θ(n²) en este modelo, tanto en el mejor como en el peor caso para n creciente.

El número de intercambios entre posiciones distintas es como máximo n−1. Nuestra función también ejecuta asignaciones cuando el mínimo ya está en i; una comprobación `smallest !== i` podría evitarlas. Eso reduce escrituras, no elimina las comparaciones cuadráticas.

El núcleo necesita O(1) memoria auxiliar. El contrato de devolver una copia añade O(n). Decir «selection sort usa memoria constante» sin señalar esa copia sería describir otra variante, no toda nuestra función.

En un sistema donde escribir sea mucho más caro que comparar, separar ambas cuentas puede resultar útil. Pero no basta con esa observación para recomendar este algoritmo: hay que incluir los costes concretos del almacenamiento y las alternativas disponibles.

## El intercambio a distancia rompe la estabilidad

Considera `(2,a), (2,b), (1,c)`, donde solo comparamos la clave numérica. El mínimo es `(1,c)`. Al intercambiarlo con la primera posición obtenemos `(1,c), (2,b), (2,a)`.

Las claves están ordenadas y no falta ningún elemento, pero a y b han invertido su orden. Esta implementación **no es stable**. El fallo no se arregla escogiendo el primer mínimo: lo provoca mover el elemento de la primera posición por encima de otros equivalentes.

Podríamos desplazar elementos para insertar el mínimo sin ese salto, diseñando una variante estable. Eso cambia el patrón de movimientos. No atribuimos a esa variante las mismas ventajas de pocos intercambios que acabamos de analizar.

## Qué aprender de una opción que normalmente no elegiríamos

Selection sort permite distinguir una prueba de corrección de una optimización. Saber que el mínimo ha llegado a su sitio no demuestra que todo esté ordenado. También muestra por qué la estabilidad se prueba con identidades y no solo con números repetidos.

Para uso general preferiría la ordenación estándar. Si el objetivo es entender adaptación a entradas casi ordenadas, insertion sort ofrece una comparación más interesante. El siguiente artículo estudia [bubble sort](/posts/bubble-sort-intercambios-adyacentes), cuya parada temprana sí depende de lo ocurrido en una pasada completa.

## Garantías y límites

Las pruebas verifican orden, multiplicidades, ausencia de mutación y un contraejemplo de estabilidad. No afirmamos superioridad temporal por ejecutar menos swaps. No se ha medido esta función sobre almacenamiento con escrituras costosas.

## Ejercicio: contar dos recursos por separado

Traza `[1, 2, 3, 4]` y `[4, 3, 2, 1]`. Anota comparaciones e intercambios entre posiciones distintas. Las comparaciones deben coincidir; los movimientos no tienen por qué. Después añade la condición que evita un intercambio consigo mismo y verifica que la salida no cambia.

## Referencias

- [Miller y Ranum: selection sort](https://www.openbookproject.net/books/pythonds/SortSearch/TheSelectionSort.html).
