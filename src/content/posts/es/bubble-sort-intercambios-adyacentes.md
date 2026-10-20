---
id: DSA-12
title: 'Bubble sort: qué demuestra una pasada sin intercambios'
published: 2026-10-18T03:10:00Z
locale: es
translationKey: dsa-bubble-sort
slug: bubble-sort-intercambios-adyacentes
draft: true
status: draft
level: intermedio
prerequisites: [DSA-10]
description: 'Entiende bubble sort mediante pares vecinos, sufijos definitivos y parada temprana. Por qué pocos valores desplazados no garantizan pocas pasadas.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, bubble-sort, typescript]
---

Si un recorrido completo no encuentra ningún par vecino desordenado, podemos dejar de ordenar. **Bubble sort** utiliza esa comprobación para terminar antes. La condición es útil; confundirla con «he visto pocos cambios» no lo es.

No es la opción habitual para ordenar colecciones grandes. Merece un artículo porque permite razonar sobre progreso, estabilidad y casos que parecen pequeños pero obligan a repetir mucho trabajo.

## Un elemento grande puede avanzar varias posiciones en una pasada

Recorremos el array de izquierda a derecha. Si dos vecinos están en orden incorrecto, los intercambiamos. El mayor de ambos queda a la derecha y vuelve a compararse con el siguiente. Al terminar, el máximo del tramo pendiente ha llegado a su posición final.

```text
Entrada:  [4, 2, 3, 1]
Comparar 4,2 -> [2, 4, 3, 1]
Comparar 4,3 -> [2, 3, 4, 1]
Comparar 4,1 -> [2, 3, 1 | 4]
Pasada 2:     [2, 1 | 3, 4]
Pasada 3:     [1 | 2, 3, 4]
```

El sufijo detrás de la frontera ya está en su lugar. Reducir `end` evita volver a compararlo. Durante una pasada, el mayor de los valores inspeccionados va avanzando con el índice interior.

## Implementar una parada que tenga una justificación

Archivo `focused.ts` del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/focused.ts), función completa:

```typescript
export function bubbleSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  const items = [...input]
  for (let end = items.length - 1; end > 0; end--) {
    let changed = false
    for (let j = 0; j < end; j++) {
      if (compare(items[j]!, items[j + 1]!) <= 0) continue
      const value = items[j]!
      items[j] = items[j + 1]!
      items[j + 1] = value
      changed = true
    }
    if (!changed) break
  }
  return items
}
```

Si `changed` sigue siendo falso, todos los pares consecutivos del tramo estaban en orden y no modificamos ninguno durante la pasada. Con un comparador transitivo, eso implica que el tramo completo está ordenado. El sufijo ya lo estaba, de modo que podemos terminar.

La condición `<= 0` evita intercambiar equivalentes. Dos objetos con la misma clave nunca se adelantan entre sí mediante los swaps vecinos, por lo que esta variante es **stable**.

## Un elemento pequeño avanza hacia atrás de otra manera

En `[2, 3, 4, 5, 1]`, el 1 solo retrocede una posición por pasada. Cuando se intercambia con el 5, el índice interior ya está al final; no vuelve inmediatamente hacia atrás para compararlo con el 4.

La entrada tiene un único elemento muy desplazado, pero puede necesitar un número lineal de pasadas. Por eso «casi ordenado» requiere una definición y no garantiza el mismo beneficio para todos los algoritmos. [Insertion sort](/posts/insertion-sort-prefijo-ordenado) coloca ese 1 desplazando el prefijo en una sola inserción.

En el peor caso, bubble sort hace n(n−1)/2 comparaciones y swaps de orden O(n²). Con la parada temprana, el mejor caso ya ordenado necesita n−1 comparaciones: O(n). La variante sin esa comprobación seguiría completando todas sus pasadas.

El núcleo usa O(1) espacio auxiliar; nuestra copia inicial ocupa O(n). Una vez más, distinguir el núcleo del contrato completo evita atribuir al código una propiedad que no tiene.

## Cómo probar algo más que un ejemplo bonito

Los números repetidos comprueban multiplicidades, pero no la estabilidad. Para eso necesitamos objetos con claves equivalentes e identidades diferentes. También interesa comprobar vacíos y un solo elemento: el bucle exterior no debería ejecutar ninguna pasada.

El laboratorio compara cinco variantes de ordenación con una referencia sobre 243 arrays pequeños exhaustivos, además de casos dirigidos. Esa enumeración detecta muchos errores de límites, aunque no demuestra por sí sola la corrección para cualquier longitud. La explicación del invariante y la prueba se complementan.

No incluimos un benchmark para decidir cuál gana. Esos tiempos dependerían del tamaño, del runtime, del comparador y de la distribución. El objetivo aquí es entender el mecanismo y su límite cuadrático.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-12/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Esta función conserva el array original y el orden de equivalentes, siempre que el comparador sea coherente y no tenga efectos que alteren los datos. No promete ordenar entradas hostiles con getters que cambien el estado ni comparadores no transitivos.

## Ejercicio: encontrar la asimetría

Cuenta las pasadas de `[5, 1, 2, 3, 4]` y `[2, 3, 4, 5, 1]`. Ambas tienen un elemento fuera de lugar, pero no necesitan las mismas pasadas en esta dirección de recorrido. Explica el resultado siguiendo el índice, no usando una etiqueta genérica como «array casi ordenado».

Después pasamos a [merge sort](/posts/merge-sort-mezcla-estabilidad), que evita el peor caso cuadrático mediante división y mezcla.

## Referencias

- [Miller y Ranum: bubble sort y variante con parada temprana](https://www.openbookproject.net/books/pythonds/SortSearch/TheBubbleSort.html).
