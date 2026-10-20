---
id: DSA-16
title: 'Heapsort: ordenar con una frontera y construir el heap en O(n)'
published: 2026-10-18T03:14:00Z
locale: es
translationKey: dsa-heapsort
slug: heapsort-construccion-bottom-up
draft: true
status: draft
level: intermedio
prerequisites: [DSA-15]
description: 'Construcción bottom-up, extracción del máximo y sufijo definitivo: entiende heapsort, su memoria y la pérdida de estabilidad.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, heapsort, typescript]
---

Construir un heap insertando n elementos uno a uno tiene una cota O(n log n). Pero **heapsort** puede preparar el heap en O(n): empieza por los subárboles más pequeños y evita cobrar a todos los nodos el coste de bajar desde la raíz.

Después de [binary heaps](/posts/binary-heap-cola-prioridad), tenemos las piezas para entender una ordenación con peor caso O(n log n). Hay que añadir una frontera que separe el heap pendiente del sufijo ya definitivo.

## Por qué elegimos un max-heap para ordenar ascendente

Un **max-heap** coloca el mayor elemento en la raíz. Lo intercambiamos con la última posición pendiente, reducimos el tamaño del heap y reparamos la raíz. El máximo queda al final, donde debe estar en una salida ascendente.

```text
Heap:             [4, 2, 3, 1]
Extraer máximo:   [1, 2, 3 | 4]
Reparar:          [3, 2, 1 | 4]
Extraer máximo:   [1, 2 | 3, 4]
Reparar:          [2, 1 | 3, 4]
Extraer máximo:   [1 | 2, 3, 4]
```

Los elementos después de la frontera ya no forman parte del heap. Si una reparación los inspeccionara o intercambiara, podría destruir el sufijo ordenado. Por eso `siftDown` recibe una longitud activa distinta de la longitud total del array.

## El código mantiene la frontera explícita

Archivo `focused.ts`, función completa del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/focused.ts):

```typescript
export function heapSort<T>(input: readonly T[], compare: (a: T, b: T) => number): T[] {
  const items = [...input]
  function siftDown(root: number, length: number): void {
    while (2 * root + 1 < length) {
      let child = 2 * root + 1
      if (child + 1 < length && compare(items[child]!, items[child + 1]!) < 0) child++
      if (compare(items[root]!, items[child]!) >= 0) return
      const value = items[root]!
      items[root] = items[child]!
      items[child] = value
      root = child
    }
  }
  for (let root = Math.floor(items.length / 2) - 1; root >= 0; root--)
    siftDown(root, items.length)
  for (let end = items.length - 1; end > 0; end--) {
    const maximum = items[0]!
    items[0] = items[end]!
    items[end] = maximum
    siftDown(0, end)
  }
  return items
}
```

La reparación elige el mayor hijo porque estamos construyendo un max-heap, al contrario del min-heap anterior. Si la raíz ya es mayor o equivalente, el subárbol está reparado y podemos terminar.

## Bottom-up aprovecha que casi todos los nodos están abajo

Las posiciones desde `floor(n/2)` son hojas y ya son heaps de un elemento. Empezamos en el último nodo con hijos y avanzamos hacia la raíz. Cuando reparamos un nodo, sus subárboles ya cumplen la propiedad.

Una cota de n nodos por log n niveles es válida pero demasiado amplia para la construcción. Aproximadamente la mitad son hojas y no bajan; un cuarto puede bajar un nivel, un octavo dos y así sucesivamente. La suma ponderada por alturas es O(n).

La fase de extracción sigue haciendo hasta n−1 reparaciones de altura O(log n). El algoritmo completo es O(n log n) en el peor caso. La construcción lineal no convierte toda la ordenación en lineal.

## Memoria y estabilidad dependen de la variante concreta

El núcleo trabaja sobre el mismo array con índices y variables auxiliares: O(1) espacio extra, sin recursión. Nuestra función copia la entrada para devolver un array nuevo y conservar la comparación justa entre algoritmos; su memoria adicional total es O(n).

No es **stable**. Con `(2,a), (2,b), (1,c)`, los intercambios a distancia pueden dejar b antes que a aunque sus claves sean equivalentes. Los tests conservan ese contraejemplo para impedir que una explicación futura prometa estabilidad por accidente.

Si el orden de equivalentes forma parte del contrato, podemos elegir un algoritmo estable o añadir una posición original como desempate. Esa posición extra modifica la representación y tiene un coste; no la damos por gratuita.

## Cuándo aporta una garantía diferente

Frente a nuestro [quicksort](/posts/quicksort-particion-pivote) determinista, heapsort mantiene O(n log n) en el peor caso sin depender del equilibrio de un pivote. Frente a nuestro [merge sort](/posts/merge-sort-mezcla-estabilidad), el núcleo no necesita un buffer lineal.

Eso no permite concluir que sea el más rápido. Patrón de acceso, constantes, comparador y runtime influyen. No hemos medido ese ranking y no deberíamos sustituir la ordenación estándar por una conclusión sacada solo de la complejidad.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-16/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Las pruebas verifican orden, multiplicidades, entrada intacta y falta de estabilidad. El código asume comparaciones coherentes y accesos de coste acotado. No es un benchmark de localidad ni una implementación pensada para ordenar datos fuera de memoria.

## Ejercicio: una frontera que no se puede cruzar

Traza `[5, 1, 4, 2, 3]`. Después de cada extracción, marca la longitud activa y comprueba dos propiedades: el prefijo es un max-heap y el sufijo está ordenado. Introduce por error `items.length` en la reparación de la segunda fase y escribe una prueba que detecte la salida incorrecta.

Queda una pregunta: ¿podemos ordenar sin comparar pares? [Counting sort](/posts/counting-sort-rango-frecuencias) lo permite cuando las claves tienen un rango adecuado.

## Referencias

- [Open Data Structures: heap-sort y construcción bottom-up](https://opendatastructures.org/ods-python/11_1_Comparison_Based_Sorti.html).
- [Open Data Structures: representación del binary heap](https://opendatastructures.org/ods-python/10_1_BinaryHeap_Implicit_Bi.html).
