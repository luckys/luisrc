---
id: DSA-15
title: 'Binary heap: mantener la próxima prioridad sin ordenar toda la colección'
published: 2026-10-18T03:13:00Z
locale: es
translationKey: dsa-binary-heap
slug: binary-heap-cola-prioridad
draft: true
status: draft
level: intermedio
prerequisites: [DSA-04, DSA-05]
description: 'Representa un heap en un array y sigue sift-up y sift-down. Prioridades, empates, costes amortizados y claves que no deben mutar dentro de la estructura.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, heap, priority-queue, typescript]
---

Si solo necesitamos sacar la tarea de menor prioridad numérica, ordenar todas las tareas después de cada inserción hace más trabajo del necesario. Un **min-heap** mantiene una garantía más pequeña: ningún padre es mayor que sus hijos.

Eso coloca un mínimo en la raíz, pero no ordena el array completo. Entender esa diferencia permite utilizar una **priority queue** sin pedirle consultas que no está diseñada para resolver.

## Un árbol completo cabe en un array sin enlaces

Un **binary heap** tiene forma de árbol binario completo: llenamos los niveles de izquierda a derecha. En un array indexado desde cero, los hijos de i están en `2*i+1` y `2*i+2`; su padre está en `floor((i-1)/2)`.

```text
Array: [1, 3, 2, 7, 4]

          1 (0)
         /     \
      3 (1)    2 (2)
      /   \
   7 (3) 4 (4)
```

3 y 2 son hermanos y no necesitan estar ordenados entre sí. La propiedad exige 1 ≤ 3, 1 ≤ 2, 3 ≤ 7 y 3 ≤ 4. Por transitividad, la raíz no es mayor que ningún descendiente.

La forma completa mantiene una altura O(log n). A diferencia del [BST sin balancear](/posts/arbol-binario-busqueda-altura-balanceo), no puede degenerar en una cadena por el orden de inserción.

## Insertar restaura la propiedad hacia arriba

Añadimos el nuevo valor al final, conservando la forma. La única posible violación está entre ese nuevo nodo y sus antepasados. Si es menor que su padre, los intercambiamos y repetimos: **sift-up**.

Insertar 0 en el dibujo añade el nodo como hijo de 2. Intercambiamos 0 con 2 y después con 1. No necesitamos tocar el subárbol de 3, porque sus relaciones internas no cambiaron.

La clase completa `MinHeap<T>` está en `algorithms.ts` del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/algorithms.ts). Recibe un comparador para definir qué significa «menor» sin depender de una propiedad fija de T.

## Extraer necesita reparar hacia abajo

Retiramos la raíz y movemos el último elemento a su lugar para conservar la forma. Después lo comparamos con sus hijos. Si alguno es menor, intercambiamos con el menor de los dos: **sift-down**.

Escoger arbitrariamente un hijo menor no basta. Si el otro hijo es todavía menor, el nuevo padre podría seguir violando la propiedad. El código selecciona primero el hijo más pequeño y luego decide si hace falta el intercambio.

```text
Extraer 1 de [1, 3, 2, 7, 4]
Mover último: [4, 3, 2, 7]
Hijo menor de 4: 2
Intercambiar: [2, 3, 4, 7]
```

Cada reparación baja o sube un nivel. Por eso las comparaciones de inserción y extracción son O(log n). El array dinámico puede tener una ampliación O(n) en una inserción concreta; el coste de crecimiento se analiza amortizado. No confundimos las comparaciones del heap con cada detalle de asignación del runtime.

## Prioridades iguales requieren una política

Si dos tareas tienen la misma prioridad, el heap no promete que salga antes la que llegó primero. Para exigirlo podemos comparar primero prioridad y después una secuencia de llegada única, creciente e inmutable.

La secuencia convierte el empate en un orden explícito. No basta con confiar en que un ejemplo pequeño «parece conservarlo». Los swaps pueden reordenar entradas equivalentes.

Tampoco debemos cambiar la prioridad de un objeto guardado sin reparar su posición. El heap no observa mutaciones externas. Una API con actualización de prioridades necesita localizar la entrada y restaurar el invariante, o una estrategia de nuevas entradas con descarte de obsoletas, como veremos en [Dijkstra](/posts/dijkstra-caminos-minimos-pesos).

## Lo que una priority queue no resuelve

El mínimo está accesible en la raíz, pero buscar una clave cualquiera no obtiene automáticamente O(log n): no sabemos en qué rama vive. El heap tampoco proporciona orden FIFO ni persistencia de trabajos.

Cuando necesitamos todos los valores ordenados una sola vez, podemos usar otra ordenación. Cuando recibimos y extraemos prioridades de manera intercalada, mantener esta propiedad parcial puede evitar ordenar de nuevo toda la colección.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-15/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Las pruebas insertan y extraen valores, alternan operaciones y comparan la secuencia final con una referencia. No implementamos `decrease-key`, borrado arbitrario ni actualización de objetos mutados. El `pop` vacío devuelve `undefined`, así que los consumidores usan `size` para controlar el estado.

## Ejercicio: reparar con el hijo equivocado

Dibuja una raíz 8 con hijos 5 y 2. Intercambia primero con 5 y comprueba qué relación queda mal. Después usa el hijo menor y explica por qué la siguiente posible violación solo puede estar en la rama por la que ha descendido 8.

La siguiente entrega utiliza un max-heap para [heapsort](/posts/heapsort-construccion-bottom-up).

## Referencias

- [Open Data Structures: binary heaps y reparaciones locales](https://opendatastructures.org/ods-python/10_1_BinaryHeap_Implicit_Bi.html).
