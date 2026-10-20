---
id: DSA-04
title: 'Arrays y linked lists: qué operación estás pagando realmente'
published: 2026-10-18T03:02:00Z
locale: es
translationKey: dsa-arrays-linked-lists
slug: arrays-listas-enlazadas-costes-reales
draft: true
status: draft
level: intermedio
prerequisites: [P011, DSA-02]
description: 'Acceso por índice, desplazamientos, capacidad y referencias: entender cuándo una lista enlazada mejora una operación y cuándo solo añade trabajo.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, arrays, linked-lists, typescript]
---

«Borrar en una linked list cuesta O(1)» parece una razón suficiente para sustituir un array. Hasta que descubrimos que primero tenemos que encontrar el elemento anterior al que queremos borrar. Esa búsqueda puede costar más que la operación que intentábamos mejorar.

Después del [mapa de estructuras](/posts/estructuras-datos-elegir-patron-acceso) y de [cómo razonar sobre un algoritmo](/posts/algoritmos-busqueda-ordenacion-heaps-grafos), vamos a separar tres trabajos que a menudo se mezclan: **localizar**, **modificar** y **mantener la representación**.

## Un array permite calcular dónde está una posición

En el modelo de un array de tamaño fijo, sus elementos ocupan posiciones consecutivas. Si conocemos la posición inicial y el tamaño de cada elemento, podemos calcular la ubicación del elemento i sin visitar los anteriores. Ese es el fundamento del acceso O(1), no que los arrays sean «rápidos» de forma general.

Buscar un valor desconocido sigue necesitando otra estrategia. Si no hay orden ni índice auxiliar, podemos tener que examinar todos los elementos. Acceder a `items[100]` y preguntar «¿dónde está el documento 100?» son operaciones diferentes.

Los arrays dinámicos separan **length**, elementos disponibles, de **capacity**, espacio reservado. Cuando falta capacidad, una implementación puede reservar más espacio y trasladar los elementos. Una inserción al final concreta puede costar O(n), aunque una secuencia de inserciones tenga coste **amortizado** O(1) por operación si el crecimiento es geométrico.

No estamos afirmando que un `Array` de **TypeScript** sea un bloque de enteros con representación fija. TypeScript se ejecuta con las reglas de su runtime JavaScript; arrays densos, huecos, objetos y optimizaciones internas afectan a la representación. El modelo explica estructuras, no garantiza el layout de cualquier motor.

## Insertar en medio necesita abrir un hueco

Para insertar X antes de C en `[A, B, C, D]`, un array debe conservar el orden desplazando C y D. Si insertamos al principio, se desplazan n elementos. Si insertamos al final y hay capacidad, no desplazamos ninguno.

```text
Antes:     [ A ][ B ][ C ][ D ][ libre ]
Mover:               C ->  D ->
Después:   [ A ][ B ][ X ][ C ][ D ]
```

La misma distinción aparece al borrar: eliminar B y conservar el orden exige cerrar su hueco. Si el contrato permite desordenar, podemos sustituir B por el último elemento y reducir la longitud. Es otra operación, con otro compromiso observable.

Por eso una tabla de complejidad sin semántica puede resultar engañosa. «Borrar O(1)» no sirve si el usuario espera que las filas restantes conserven su posición relativa.

## Una linked list cambia movimientos por referencias

En una **singly linked list**, cada nodo almacena un valor y una referencia al siguiente. No podemos calcular dónde está el nodo i: tenemos que seguir enlaces desde el principio. Acceder por posición cuesta O(n).

```text
head -> A -> B -> C -> D -> null

Con una referencia a B, insertar X después:
X.next = B.next
B.next = X

head -> A -> B -> X -> C -> D -> null
```

Esas dos actualizaciones son O(1) si **ya tenemos B**. Buscar B por su contenido sigue siendo O(n). Para borrar C en una lista simple necesitamos B, porque es B quien apunta a C. Una lista doble añade `previous` y permite otras operaciones locales, a costa de más referencias y más invariantes que mantener.

El código ejecutable de esta idea está en `algorithms.ts`, clase `Queue`, dentro del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/algorithms.ts). Cada nodo contiene `value` y `next`; la cola conserva `head` y `tail`. No añadimos búsqueda por índice porque sus operaciones no la necesitan.

## Locality y memoria también forman parte de la decisión

Recorrer posiciones cercanas puede aprovechar mejor las cachés del procesador que seguir referencias entre objetos dispersos. Una lista también necesita almacenar sus enlaces y asignar nodos. El coste exacto depende del lenguaje, del runtime, del allocator y de los datos.

Esto no convierte a las listas en una mala estructura. Una cola que inserta al final y retira al principio puede aprovecharlas bien. Lo que no conviene es elegirlas solo porque una celda de una tabla dice O(1).

Para un catálogo que se muestra y recorre completo, empezaría por un array. Si además necesita acceso por identificador, estudiaría un índice **Map**, no una lista enlazada. Si el requisito es procesar entradas FIFO, pasaría a una [cola con operaciones explícitas](/posts/pilas-colas-lifo-fifo).

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-04/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

El laboratorio verifica el comportamiento FIFO y las referencias de la cola; no mide cachés de CPU ni demuestra que una representación sea siempre más rápida. Las complejidades anteriores describen el modelo indicado, con acceso y actualización de una referencia de coste acotado.

## Ejercicio: contar la búsqueda antes de borrar

Escribe los pasos para borrar el documento con ID 900 en dos colecciones sin ordenar: un array y una lista simple. Primero cuenta cómo lo localizas; después cómo mantienes el orden restante. Repite el razonamiento si ya dispones del nodo anterior en la lista. La diferencia debe aparecer en tu explicación, no solo en el resultado final.

## Referencias

- [Open Data Structures: array-based lists y crecimiento de capacidad](https://opendatastructures.org/ods-python/2_Array_Based_Lists.html).
- [Open Data Structures: singly linked lists](https://opendatastructures.org/ods-python/3_1_SLList_Singly_Linked_Li.html).
