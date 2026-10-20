---
id: DSA-17
title: 'Grafos: representar conexiones antes de elegir un recorrido'
published: 2026-10-18T03:16:00Z
locale: es
translationKey: dsa-graph-representations
slug: grafos-listas-adyacencia-matrices
draft: true
status: draft
level: intermedio
prerequisites: [DSA-04, DSA-09]
description: 'Vértices, aristas, dirección y pesos: cómo una lista de adyacencia o una matriz condicionan las consultas, la memoria y los algoritmos de grafos.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, grafos, adyacencia, typescript]
---

Un mapa de rutas puede decir que dos lugares están conectados y aun así no permitir volver por el mismo camino. Una lista de dependencias puede contener ciclos. Antes de elegir BFS o Dijkstra, tenemos que decidir qué significan esas conexiones.

Un **graph** representa vértices y relaciones entre ellos. Su utilidad no se limita a mapas: también aparece en dependencias, permisos, enlaces y flujos. El algoritmo correcto depende de qué representa cada arista y de qué pregunta queremos responder.

## Dirección, peso y existencia son decisiones distintas

Un grafo **directed** distingue A→B de B→A. Uno **undirected** representa una relación en ambos sentidos. Si lo guardamos con listas de vecinos, normalmente registraremos las dos direcciones para el segundo caso.

Un **weight** añade un coste, como distancia, tiempo o precio. Que exista una conexión no implica que cueste uno ni que sea barata. Tampoco debemos usar peso cero como señal de ausencia si el dominio permite conexiones gratuitas.

```text
A -> B -> D       Z
 \-> C -> D

Vértices: A, B, C, D, Z
Aristas dirigidas: A-B, A-C, B-D, C-D
Z existe aunque no tenga conexiones.
```

«¿Existe un camino?», «¿cuál usa menos aristas?» y «¿cuál tiene menor suma de pesos?» son tres problemas. [DFS](/posts/dfs-recorrido-profundidad-stack), [BFS](/posts/bfs-recorrido-anchura-camino-minimo) y [Dijkstra](/posts/dijkstra-caminos-minimos-pesos) no son nombres intercambiables para resolverlos.

## Una lista de adyacencia guarda los vecinos existentes

El laboratorio representa grafos sin pesos como `ReadonlyMap<string, readonly string[]>`. Cada clave identifica un vértice y su array contiene los destinos de sus aristas salientes. Una lista vacía representa un vértice sin salidas, no uno inexistente.

El test de BFS usa un grafo con ciclo A↔B y dos rutas hasta D. Puedes leerlo y ejecutarlo en `tests/algorithms.test.mjs` del [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/focused.ts). Con pesos, `focused.ts` define `Edge` con `to` y `weight` y mantiene la misma organización por origen.

Con V vértices y E aristas almacenadas, esta representación ocupa O(V + E) referencias en el modelo habitual. Enumerar vecinos cuesta proporcionalmente al grado de salida. Comprobar si existe una arista concreta puede exigir recorrer la lista del origen; usar un Set por origen cambiaría esa operación y sus costes.

Las aristas paralelas también requieren una política. Un array permite repetir vecinos; un Set los agrupa. Si dos conexiones entre los mismos destinos tienen distintos pesos o identidades, agruparlas sin más podría perder información del dominio.

## Una matriz reserva un lugar para cada par

Una **adjacency matrix** tiene una celda por par de vértices. Consultar la conexión i→j es acceso directo, pero almacenar la matriz cuesta O(V²), aunque casi todas las celdas estén vacías.

Para recorrer todos los vecinos de un vértice, una matriz simple inspecciona su fila completa: O(V). Un recorrido que explora todos los vértices puede acabar en O(V²), en lugar de la cota O(V + E) que solemos asociar a listas de adyacencia.

No basta con elegir una matriz porque «acceder es O(1)». Hay que preguntar qué acceso repetirá el algoritmo. Con grafos densos, el coste cuadrático puede ser razonable; con millones de vértices y pocas conexiones por vértice, puede ser inviable.

## Las referencias a vértices necesitan un contrato

¿Qué ocurre si A declara un vecino B que no existe como clave? Podemos rechazarlo al construir el grafo o tratarlo como un vértice implícito. Nuestro laboratorio elige rechazar las referencias inválidas, pero no todos sus algoritmos revisan el mismo alcance.

BFS y DFS comprueban las aristas que visitan. Un error en una componente desconectada puede quedar sin descubrir. Dijkstra valida todo el grafo antes del recorrido porque su salida temprana depende también de la precondición global de pesos no negativos.

La diferencia es deliberada y está probada. Si una API promete «grafo validado», conviene separar la construcción y validación de cada consulta para no pagar toda la revisión repetidamente. Aquí mantenemos el código pequeño y declaramos dónde ocurre ese trabajo.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-17/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Los ejemplos usan grafos finitos en memoria. No modelan cambios concurrentes durante el recorrido ni consultan vecinos por red. `ReadonlyMap` expresa intención de solo lectura para el consumidor TypeScript; no congela la estructura en runtime.

Tampoco implementamos una matriz ejecutable. La comparación explica sus operaciones y almacenamiento; no es un benchmark entre representaciones.

## Ejercicio: representar el mismo dominio de dos maneras

Representa cuatro vértices con una sola arista dirigida usando lista y matriz. Cuenta las entradas necesarias y cómo localizarías los vecinos del origen. Después añade peso cero y explica cómo distingues esa arista de una ausencia. No avances a un algoritmo de caminos hasta tener una representación sin ambigüedad.

## Referencias

- [Open Data Structures: adjacency lists](https://opendatastructures.org/ods-python/12_2_AdjacencyLists_Graph_a.html).
- [Open Data Structures: adjacency matrices](https://opendatastructures.org/ods-python/12_1_AdjacencyMatrix_Repres.html).
