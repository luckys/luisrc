---
id: DSA-06
title: 'Binary search trees: por qué la altura importa más que el nombre'
published: 2026-10-18T03:04:00Z
locale: es
translationKey: dsa-binary-search-trees
slug: arbol-binario-busqueda-altura-balanceo
draft: true
status: draft
level: intermedio
prerequisites: [DSA-04]
description: 'Construye un BST sencillo y comprueba cómo una entrada ordenada lo convierte en una cadena. Invariantes, duplicados y límites del balanceo ausente.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, arboles, bst, typescript]
---

Insertar números ordenados en un árbol de búsqueda sin balancear puede producir una lista enlazada con otro nombre. Cada consulta atraviesa todos los nodos anteriores, aunque esperábamos descartar media colección en cada paso.

Un **binary search tree**, o **BST**, permite mantener claves ordenadas mientras insertamos. La ventaja depende de su altura y del trabajo necesario para conservarla pequeña. No basta con que cada nodo tenga dos huecos para hijos.

## El orden se aplica a todo el subárbol

En nuestro BST, todas las claves del subárbol izquierdo son menores que la del nodo, y todas las del derecho son mayores. No solo sus hijos inmediatos. Un nieto situado a la izquierda también tiene que respetar las restricciones de todos sus antepasados.

Para insertar `[4, 2, 6, 1, 3]`, obtenemos:

```text
        4
       / \
      2   6
     / \
    1   3

Buscar 3: 3 < 4 -> izquierda; 3 > 2 -> derecha; igualdad.
Buscar 5: 5 > 4 -> derecha; 5 < 6 -> hueco vacío: no existe.
```

Al comparar con un nodo descartamos un subárbol entero. Eso es válido por el invariante, no porque hayamos inspeccionado los valores descartados. Si alguien modifica una clave sin recolocar el nodo, la búsqueda puede dejar de encontrar un valor presente.

## La búsqueda sigue una sola rama

El [laboratorio](/assets/examples/estructuras-algoritmos-lab.zip) incluye `TreeNode`, `treeInsert` y esta función completa en `focused.ts`:

```typescript
export function treeHas(root: TreeNode | undefined, key: number): boolean {
  let current = root
  while (current) {
    if (key === current.key) return true
    current = key < current.key ? current.left : current.right
  }
  return false
}
```

La función termina al encontrar igualdad o llegar a un hueco. En cada iteración bajamos un nivel, por lo que el trabajo es O(h), siendo h la altura. No tenemos todavía motivo para sustituir h por log n.

La inserción recorre el mismo camino hasta un hueco y coloca un nodo allí. Rechaza claves no finitas y trata las repetidas como una inserción sin efecto. Es un **set** ordenado de números, no un almacén que acumula valores por clave.

`treeInsert` devuelve la raíz porque la primera inserción tiene que crearla. Las siguientes modifican nodos existentes; no es una estructura persistente ni una copia independiente del árbol anterior. Quien conserve una referencia a la raíz verá esas inserciones.

## La entrada ordenada revela el peor caso

Inserta `[1, 2, 3, 4]`. Cada valor es mayor que los anteriores y se coloca a la derecha. La altura crece linealmente. Buscar 4 necesita pasar por los cuatro nodos; insertar n valores de esa manera acumula O(n²) comparaciones.

En un árbol con altura O(log n), buscar e insertar pueden costar O(log n). Estructuras como **AVL trees** y **red-black trees** añaden reglas y rotaciones para controlar esa altura. Las rotaciones reorganizan enlaces conservando el orden de las claves, pero sus reglas de balanceo merecen un desarrollo aparte.

No atribuimos esas garantías al código sencillo del laboratorio. Para una aplicación que las necesite, elegiría una implementación mantenida de un árbol balanceado antes que añadir rotaciones sin una batería sólida de pruebas.

## Un BST y un Map no ofrecen la misma consulta

Un índice hash resulta útil para encontrar una clave exacta. Un árbol ordenado puede servir también para obtener el siguiente valor, recorrer un intervalo o producir claves en orden mediante un recorrido **in-order**: subárbol izquierdo, nodo y subárbol derecho.

Un `Map` de TypeScript conserva orden de inserción, no orden numérico de claves. Insertar 9, 2 y 5 no lo convierte en un árbol que pueda responder directamente «la menor clave mayor que 3». Esa diferencia semántica puede importar más que comparar dos Big O aislados.

Si solo tenemos un catálogo estático, un array ordenado y [búsqueda binaria](/posts/busqueda-binaria-lower-bound) también permiten localizar fronteras. El precio de insertar en medio vuelve a ser relevante. La elección depende de cuánto consultamos, cuánto modificamos y qué orden exige la consulta.

## Garantías y límites

Los tests verifican inserción, duplicados, búsquedas presentes y ausentes, claves inválidas y la cadena producida por una entrada ordenada. No implementamos borrado, rangos ni balanceo. Los nodos son mutables y el consumidor debe conservar el invariante; no presentamos este ejemplo como una biblioteca lista para exposición pública.

## Ejercicio: dibujar antes de medir

Construye árboles con `[4, 2, 6, 1, 3, 5, 7]` y `[1, 2, 3, 4, 5, 6, 7]`. Cuenta los nodos visitados para encontrar 7. Después intenta justificar O(log n) para ambos: el segundo dibujo debería impedirlo. Amplía el test para que el número de visitas quede explícito, sin usar milisegundos.

## Referencias

- [Open Data Structures: BST sin balancear, búsqueda e inserción](https://opendatastructures.org/ods-python/6_2_BinarySearchTree_Unbala.html).
