---
id: DSA-14
title: 'Quicksort: particionar bien no garantiza elegir bien el pivote'
published: 2026-10-18T03:12:00Z
locale: es
translationKey: dsa-quicksort
slug: quicksort-particion-pivote
draft: true
status: draft
level: intermedio
prerequisites: [DSA-13]
description: 'Implementa quicksort con partición en tres grupos y entiende el coste del pivote, los duplicados y las diferencias con las variantes in-place.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, quicksort, typescript]
---

Elegir el elemento de la posición central no significa elegir la mediana de los valores. Esa confusión basta para atribuir a **quicksort** una garantía O(n log n) que una implementación concreta no ofrece.

Quicksort también divide el problema, pero a diferencia de [merge sort](/posts/merge-sort-mezcla-estabilidad), primero organiza los elementos respecto a un **pivot**. La calidad de esa división condiciona cuánto trabajo repetirá después.

## Tres grupos hacen explícito qué queda por ordenar

Elegimos un pivote y distribuimos los valores en menores, equivalentes y mayores. Solo necesitamos ordenar recursivamente el primer y el tercer grupo. Los equivalentes ya están en la frontera correcta respecto a los demás.

```text
Entrada: [4, 2, 4, 1, 3], pivote 4
Menores: [2, 1, 3]   Iguales: [4, 4]   Mayores: []

Ordenar menores con pivote 1:
[] + [1] + ordenar [2, 3]

Resultado: [1, 2, 3] + [4, 4] + []
```

Durante la partición, todos los valores visitados están en el grupo que les corresponde. Cada entrada se añade una vez y ningún grupo altera el orden interno en que recibió sus valores.

## Una variante legible, no una variante in-place

Archivo `focused.ts` del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/focused.ts):

```typescript
export function quickSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  if (input.length < 2) return [...input]
  const pivot = input[Math.floor(input.length / 2)]!
  const less: T[] = [],
    equal: T[] = [],
    greater: T[] = []
  for (const value of input) {
    const order = compare(value, pivot)
    if (order < 0) less.push(value)
    else if (order > 0) greater.push(value)
    else equal.push(value)
  }
  return [...quickSort(less, compare), ...equal, ...quickSort(greater, compare)]
}
```

El comparador debe definir un orden coherente, devolver un resultado válido y considerar equivalente un valor a sí mismo. Así al menos el pivote queda en `equal`, y las llamadas recursivas reciben problemas estrictamente menores.

No validamos el comparador llamándolo sobre todos los pares. Además de ser costoso, unas comprobaciones parciales no demostrarían transitividad para valores futuros. Esa condición pertenece al contrato del algoritmo.

## El pivote determina el tamaño de los subproblemas

Si las particiones se reparten de forma razonablemente equilibrada, tenemos O(log n) niveles con O(n) trabajo por nivel: O(n log n). Si en cada paso elegimos el extremo de los valores, el tamaño pendiente solo baja de n a n−1. La suma de trabajo se vuelve O(n²).

Nuestro pivote usa una posición determinista. Mejora ciertos casos frente a escoger siempre el primero, pero no elimina entradas adversas. No afirmamos una cota esperada O(n log n) sin definir una distribución de entradas o una selección aleatoria de pivotes.

La partición de tres grupos sí ayuda con duplicados: si todos los valores son equivalentes, una pasada los coloca en `equal` y no seguimos resolviendo un problema de tamaño n−1. No todas las variantes de quicksort manejan ese caso del mismo modo.

## Esta versión es estable, pero esa propiedad no es general

Como recorremos en orden y añadimos al final de cada grupo, los equivalentes conservan su orden relativo. Las llamadas recursivas hacen lo mismo. Esta variante es **stable** y devuelve un array nuevo.

Muchas implementaciones de quicksort particionan **in-place** intercambiando posiciones dentro de un mismo array y no son estables. Sería incorrecto aplicar esa descripción a nuestro código o presentar nuestra estabilidad como una garantía de cualquier quicksort.

También pagamos por la claridad: reservamos arrays de grupos y concatenaciones. Con particiones equilibradas, el espacio vivo algorítmico es O(n) más el stack. En un peor caso muy desequilibrado, los niveles pueden retener grupos de tamaños n, n−1 y sucesivos, llegando a O(n²) de espacio auxiliar en esta versión. El stack O(n) también puede desbordarse mucho antes de terminar una entrada grande.

## Cuándo estudiar otra implementación

Para controlar memoria y peor caso, hacen falta técnicas adicionales, como partición in-place, gestión explícita de intervalos o una estrategia híbrida con alternativa al alcanzar cierta profundidad. Son cambios de algoritmo y de garantías, no retoques cosméticos.

En una aplicación normal no sustituiría la ordenación estándar por este ejemplo. Su finalidad es mostrar la partición y permitir probar duplicados y estabilidad de una forma fácil de inspeccionar.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-14/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Las pruebas verifican resultados, multiplicidades, estabilidad de esta variante y entrada intacta. No usan tiempos ni certifican seguridad frente a entradas enormes o adversas. El pivote central es determinista y no hemos implementado selección aleatoria ni introsort.

## Ejercicio: separar posición y valor

Construye un array de siete valores distintos cuyo valor central sea el mínimo. Dibuja la primera partición. Después compara ese reparto con usar la mediana de los siete valores. Explica qué coste adicional tendría encontrar esa mediana y por qué «escoger el centro» no demuestra balanceo.

Seguimos con [binary heaps](/posts/binary-heap-cola-prioridad), necesarios para comprender otra ordenación con peor caso O(n log n).

## Referencias

- [Open Data Structures: partición y análisis de quicksort aleatorizado](https://opendatastructures.org/ods-python/11_1_Comparison_Based_Sorti.html).
