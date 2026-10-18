---
id: DSA-02
title: 'Algoritmos: contratos, invariantes y complejidad antes del código'
published: 2026-10-18T03:01:00Z
locale: es
translationKey: algorithms-search-sort-graphs
slug: algoritmos-busqueda-ordenacion-heaps-grafos
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P011]
description: 'Aprende a definir qué resuelve un algoritmo, demostrar su progreso y distinguir peor caso, coste esperado y amortizado antes de implementarlo.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, contratos, invariantes, complejidad]
---

Un algoritmo puede devolver una lista ordenada y seguir siendo incorrecto: quizá ha eliminado duplicados o modificado una entrada que debía conservar. Antes de discutir su velocidad necesitamos acordar qué resultados están permitidos.

Este artículo prepara la serie. Después del [mapa de estructuras](/posts/estructuras-datos-elegir-patron-acceso), cada búsqueda, ordenación y recorrido tendrá su propia entrega. Aquí construiremos las preguntas que vamos a utilizar para revisarlos, sin comprimir sus implementaciones en un único texto.

## El contrato define el problema, no solo la firma

Una función que recibe números y devuelve un número admite muchas interpretaciones. ¿Devuelve una posición? ¿El valor encontrado? ¿La primera coincidencia? ¿Qué ocurre si no hay ninguna?

Una **precondition** describe las entradas que admite el algoritmo. Una **postcondition** describe qué debe ser cierto al terminar. Si una búsqueda binaria exige datos ordenados, una lista desordenada no es otra prueba equivalente: viola el supuesto que permite descartar candidatos.

No conviene convertir esa observación en una excusa para aceptar cualquier error externo. La aplicación debe establecer dónde valida y quién conserva la garantía. Validar el orden una vez al construir un catálogo es distinto de recorrerlo antes de cada búsqueda.

Para una ordenación fijaremos cuatro preguntas: la salida respeta el comparador, conserva todos los elementos y sus multiplicidades, mantiene intacto el array original cuando lo promete y conserva el orden de equivalentes si es **stable**. Una prueba puede verificar una de ellas y pasar por alto las otras tres.

## Un invariante explica por qué cada paso sigue siendo válido

Un **invariant** es una propiedad que conservamos durante la ejecución. En búsqueda lineal, todas las posiciones anteriores ya se examinaron sin coincidencia. En insertion sort, el prefijo anterior a la posición actual está ordenado.

El razonamiento tiene tres partes. La propiedad debe ser cierta antes de empezar, cada paso debe conservarla y, al terminar, debe permitir deducir la salida prometida. Si falta alguna, tener un bucle que parece familiar no demuestra nada.

```text
Contrato -> estado inicial -> paso que conserva una propiedad -> salida válida
                               |
                               +-> medida pendiente que disminuye -> terminación
```

La terminación requiere una explicación adicional. Un bucle puede conservar eternamente que todos los valores procesados están ordenados si nunca avanza al siguiente. En búsqueda binaria usaremos la longitud del intervalo pendiente; en una pasada, las posiciones restantes.

## Big O describe crecimiento bajo un modelo

**O(f(n))** expresa una cota superior asintótica, no un número de milisegundos ni una igualdad exacta. **Theta**, Θ, expresa una cota ajustada de crecimiento. Un algoritmo lineal también puede tener una cota O(n²), aunque esa descripción sea poco informativa.

Antes de usar una fórmula, define n y qué estás contando: comparaciones, movimientos, visitas o memoria. Si hacemos q consultas sobre n filas, el peor caso de búsqueda lineal es O(nq). No conviene ocultar q si también cambia.

Las operaciones primitivas dependen del modelo. Acceder al centro de un array cuesta O(1) en el modelo usual; llegar al centro de una lista enlazada necesita seguir enlaces. Comparar números pequeños no cuesta lo mismo que comparar textos arbitrariamente largos.

Dos algoritmos con la misma complejidad pueden tener tiempos distintos. Uno con mejor crecimiento puede perder para entradas pequeñas por preparación, asignaciones o constantes. La complejidad orienta qué medir; no reemplaza una medición bien diseñada.

## Peor caso, esperado y amortizado responden a preguntas distintas

El **worst case** pregunta qué entrada admitida exige más trabajo para un tamaño. Una búsqueda lineal ausente recorre todas las posiciones.

Un coste **expected** depende de una distribución de entradas o de decisiones aleatorias. No basta con llamar «promedio» a una observación agradable. En quicksort, seleccionar una posición fija no permite afirmar las garantías de un pivote aleatorio.

El coste **amortized** analiza una secuencia completa de operaciones. Un array dinámico puede tener una inserción costosa al crecer, pero repartir ese trabajo entre muchas inserciones. No significa que esa operación concreta vaya a terminar rápido.

Tampoco son sinónimos «memoria auxiliar máxima» y «cantidad total asignada». Un algoritmo recursivo puede crear muchos arrays temporales sin necesitarlos todos simultáneamente. El heap observado añade además las decisiones del garbage collector.

## Tests e invariantes cubren riesgos diferentes

Un test de ejemplo detecta un fallo concreto, pero no demuestra todos los tamaños posibles. Por eso combinaremos casos dirigidos con comparación contra una solución de referencia y enumeración exhaustiva de entradas pequeñas.

En ordenación verificaremos claves, multiplicidades, identidad de equivalentes y ausencia de mutación. En grafos incluiremos ciclos, vértices aislados y rutas alternativas. Para Dijkstra añadiremos pesos inválidos y sumas fuera de rango.

Un **oracle** también puede estar mal. Usar una búsqueda lineal sencilla como referencia ayuda a reducir ese riesgo. Comparar dos implementaciones que comparten el mismo error de límites ofrece menos confianza.

## Garantías y límites

El [laboratorio descargable](/assets/examples/estructuras-algoritmos-lab.zip) contiene código, pruebas y un benchmark separado. Las pruebas no imponen umbrales de velocidad: una máquina más lenta no vuelve incorrecta una ordenación.

Conservamos la URL de este borrador para no romper enlaces internos. Su contenido ya no agrupa búsqueda binaria, merge sort y BFS: ahora tienen entregas propias. El orden completo está en la ruta editorial de la serie.

## Ejercicio: una ordenación que parece correcta

Imagina que ordenar `[3, 1, 3]` devuelve `[1, 3]`. Escribe la propiedad que incumple, aunque todas las parejas de la salida estén ordenadas. Después añade objetos con claves iguales y define una segunda prueba para estabilidad. Termina anotando si la función puede modificar la entrada.

Continúa con [arrays y linked lists](/posts/arrays-listas-enlazadas-costes-reales). Entender su representación evitará atribuir a cualquier colección los costes de un array.

## Referencias

- [Open Data Structures: corrección y complejidad](https://opendatastructures.org/ods-python/1_5_Correctness_Time_Comple.html).
- [Open Data Structures: modelo de cálculo](https://opendatastructures.org/ods-python/1_4_Model_Computation.html).
