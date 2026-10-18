---
id: DSA-05
title: 'Pilas y colas: cómo elegir el orden en que se procesa el trabajo'
published: 2026-10-18T03:03:00Z
locale: es
translationKey: dsa-stacks-queues
slug: pilas-colas-lifo-fifo
draft: true
status: draft
level: intermedio
prerequisites: [DSA-04]
description: 'Implementa una cola FIFO, entiende los invariantes de head y tail y distingue una estructura en memoria de una cola de trabajos duradera.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, stack, queue, typescript]
---

Si cada tarea nueva se coloca delante de las anteriores, un sistema con trabajo constante puede dejar esperando para siempre a las primeras. La estructura sigue guardando todos los elementos; el problema está en el orden de extracción.

Una **stack** y una **queue** no se distinguen por cómo se dibujan, sino por la promesa que hacen. Después de [arrays y listas](/posts/arrays-listas-enlazadas-costes-reales), podemos implementar esa promesa sin exponer detalles que el resto del programa no necesita.

## LIFO y FIFO resuelven necesidades diferentes

Una pila usa **LIFO**, last in, first out. Si apilamos A, B y C, retiramos C, B y A. Es adecuada para volver al contexto anterior: un recorrido DFS, una pila de llamadas o un historial de acciones reversibles. Que una aplicación permita deshacer también exige saber cómo revertir cada acción; la pila solo conserva el orden.

Una cola usa **FIFO**, first in, first out. Si encolamos A, B y C, retiramos A, B y C. Es útil para procesar descubrimientos por capas en BFS o para mantener el orden de llegada de trabajo pendiente.

```text
Pila:     push A, push B, push C  -> pop C, pop B, pop A
Cola:     enqueue A, B, C        -> dequeue A, B, C
```

Son **abstract data types**: definen operaciones y comportamiento, no una única representación. Una pila puede usar un array dinámico; una cola, una lista enlazada o un buffer circular. Una representación adecuada para una operación puede ser ineficiente para otra.

## Por qué no quitar siempre la primera posición de un array

Una implementación ingenua de cola añade al final y elimina al principio de un array. Bajo un modelo que desplaza las posiciones restantes, retirar n elementos puede acumular trabajo cuadrático. No necesitamos depender de las optimizaciones de un motor para evitar ese diseño.

Otra opción es conservar un índice de lectura. Evita desplazar en cada extracción, pero debe liberar referencias a elementos consumidos y decidir cuándo compactar. Un buffer circular reutiliza posiciones, aunque añade el control de capacidad y la vuelta al principio.

En nuestro laboratorio elegimos una lista simple con dos referencias. Sacar el primero y añadir el último son las operaciones que necesitamos; buscar una posición arbitraria no forma parte del contrato.

## Una cola enlazada necesita mantener cuatro condiciones

El archivo `algorithms.ts` contiene la clase completa `Queue<T>`. Su extracción es:

```typescript
  dequeue(): T {
    if (!this.#head) throw new RangeError('Cola vacía')
    const { value, next } = this.#head
    this.#head = next
    if (!next) this.#tail = undefined
    this.#size--
    return value
  }
```

`head` apunta al próximo elemento que saldrá. `tail` apunta al último nodo y su siguiente es `undefined`. Si la cola está vacía, ambos faltan y `size` vale cero. Si no está vacía, `size` coincide con el número de nodos alcanzables desde `head`.

La línea que borra `tail` es fácil de olvidar. Al retirar el último nodo, la cola vuelve al estado vacío. Si conservamos una cola final antigua y la siguiente inserción se enlaza allí, el nuevo nodo puede quedar desconectado del `head` real.

Lanzamos un error al extraer de una cola vacía en lugar de devolver `undefined`. Así podemos guardar legítimamente `undefined` como un valor de tipo T sin confundirlo con «no había elementos». Es una decisión de API; otra cola podría devolver un resultado discriminado.

## El coste de una operación no es toda la política de procesamiento

Insertar y extraer cambia un número constante de referencias: O(1) en este modelo. Almacenar n valores necesita O(n) nodos. Eso no significa que podamos aceptar una cantidad ilimitada de trabajo; la memoria sigue siendo finita.

Tampoco tenemos una cola concurrente, persistencia, confirmaciones ni reintentos. Si un proceso termina, desaparece el contenido. FIFO describe el orden de extracción de esta estructura, no el orden de finalización de tareas ejecutadas en paralelo.

En [BFS](/posts/bfs-recorrido-anchura-camino-minimo), la cola tiene un papel concreto: todos los vértices a distancia d se procesan antes que los descubiertos a distancia d+1. En [DFS](/posts/dfs-recorrido-profundidad-stack), una pila favorece profundizar antes de volver a otras ramas. Cambiar la estructura cambia el algoritmo.

## Garantías y límites

Las pruebas verifican FIFO, tamaño, extracción vacía, almacenamiento de `undefined` y reutilización después de vaciar. No verifican múltiples procesos ni durabilidad. Puedes ejecutarlas con `node --test tests/*.test.mjs` en el [laboratorio descargable](/assets/examples/estructuras-algoritmos-lab.zip).

## Ejercicio: el caso que revela un tail obsoleto

Encola A, retíralo, encola B y retíralo. Comprueba `size` después de cada operación y exige recibir B al final. Después guarda `undefined` y verifica que se puede retirar una vez, pero que una segunda extracción lanza el error definido. Ambos casos comprueban contratos diferentes.

## Referencias

- [Open Data Structures: interfaz de colas, pilas y listas enlazadas](https://opendatastructures.org/ods-python/3_1_SLList_Singly_Linked_Li.html).
