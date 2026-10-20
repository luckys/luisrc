---
id: DSA-07
title: 'Búsqueda lineal: cuándo recorrer los datos es una buena decisión'
published: 2026-10-18T03:05:00Z
locale: es
translationKey: dsa-linear-search
slug: busqueda-lineal-contrato-coste
draft: true
status: draft
level: intermedio
prerequisites: [DSA-04]
description: 'Primera coincidencia, ausencias y duplicados: implementa una búsqueda lineal y calcula su coste según la consulta real, no solo según el tamaño del array.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, busqueda-lineal, typescript, complejidad]
---

Si solo necesitas encontrar un elemento una vez, construir un índice completo puede ser más trabajo que recorrer la colección. La búsqueda lineal no es un error que haya que eliminar siempre: es una solución con un contrato pequeño y sin preparación previa.

Vamos a usarla como primera búsqueda de la serie. Lo que aprendamos sobre coincidencias, ausencias y duplicados será el punto de comparación para [búsqueda binaria](/posts/busqueda-binaria-lower-bound) e [índices hash](/posts/busqueda-hash-map-colisiones).

## Definir qué significa encontrar un elemento

Nuestro catálogo contiene objetos con un `id` numérico. La operación devuelve la **primera referencia** cuyo identificador coincide, o `undefined` si no existe. No ordena, no copia objetos y no rechaza identificadores repetidos.

La palabra «primera» importa. Si tenemos dos registros con ID 4 y títulos diferentes, devolver cualquiera no satisface el mismo contrato. Tampoco es equivalente devolver una copia si otra parte del programa utiliza identidad de referencias.

El archivo `algorithms.ts` del [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/data-structures-algorithms/algorithms.ts) contiene la función completa:

```typescript
export function linearSearch<T extends { readonly id: number }>(
  rows: readonly T[],
  id: number,
): T | undefined {
  for (const row of rows) if (row.id === id) return row
  return undefined
}
```

`readonly T[]` evita que esta función modifique el array a través de ese parámetro. No congela los objetos en ejecución ni impide que otro código los cambie. La función es genérica para conservar el tipo del objeto encontrado, incluido cualquier campo adicional.

## Por qué podemos devolver la primera coincidencia

Antes de cada iteración, todas las filas anteriores ya se han comparado y ninguna tenía el ID buscado. Ese es el **invariant** del bucle. Cuando encontramos una igualdad, sabemos que no hemos saltado una coincidencia anterior.

Si agotamos el array, el tramo examinado es toda la colección. Por eso `undefined` significa ausencia según esta comparación. No significa «hubo un error de red» ni «no teníamos permiso»: esas son otras condiciones que la capa que llama tendrá que representar por separado.

```text
IDs:        [ 8 ][ 3 ][ 8 ][ 1 ]
Objetivo 8:   ^                       -> primera fila, 1 comparación
Objetivo 1:   x    x    x    ^         -> cuarta fila, 4 comparaciones
Objetivo 9:   x    x    x    x         -> ausencia, 4 comparaciones
```

La terminación se justifica porque cada paso consume una posición y el array tiene una longitud finita. No hay enlaces que puedan formar ciclos ni una rama que mantenga el mismo intervalo pendiente.

## Mejor caso, peor caso y distribución de consultas

Con n filas, el mejor caso de una búsqueda exitosa necesita una comparación. El peor caso necesita n: la coincidencia está al final o no existe. Hablamos de O(n) como cota de peor caso y de memoria auxiliar O(1).

Si una consulta exitosa tiene la misma probabilidad de apuntar a cada posición, el promedio es `(n + 1) / 2` comparaciones. Esa fórmula depende de la hipótesis de uniformidad. Un catálogo cuyo primer registro concentra las consultas puede comportarse de otra manera; las ausencias obligan a recorrerlo completo.

Para q consultas, no conviene decir solo «es lineal». En el peor caso acumulamos n × q comparaciones. Si q también crece con n, el coste conjunto puede ser cuadrático. Si q es uno, preparar otro índice exige justificar su construcción y su memoria.

## Un predicado más caro cambia el trabajo real

Aquí comparamos números. Si cada comparación normaliza un texto grande, calcula una expresión regular o inspecciona una estructura anidada, no podemos tratar ese coste como una constante independiente de la entrada sin explicarlo.

También cambia el significado al usar otra igualdad. Nuestro contrato usa `===`. Un ID `4` no coincide con el string `"4"`; `NaN` tampoco es igual a sí mismo. El laboratorio trabaja con IDs enteros seguros no negativos, de modo que la comparación con el índice posterior parte de un dominio válido común.

Una búsqueda sobre datos remotos introduce otro problema: recorrer en memoria no autoriza descargar una tabla completa para cada consulta. Antes de optimizar el bucle, identifica dónde viven los datos y qué operaciones ofrece ese sistema.

## Cuándo conservar esta solución

Es razonable para colecciones pequeñas, consultas ocasionales, datos sin ordenar o predicados que no justifican una estructura auxiliar. Su sencillez permite usarla también como **reference implementation** para comprobar otra estrategia: ambas deben coincidir en todas las entradas válidas del contrato compartido.

No basta con que una alternativa sea más rápida si cambia el tratamiento de duplicados o devuelve otro resultado. En el laboratorio, el constructor de Map rechaza duplicados precisamente para no esconder esa diferencia bajo una comparación de tiempos.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dsa-07/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/data-structures-algorithms
```

## Garantías y límites

Las pruebas verifican presencia, ausencia, referencia devuelta y duplicados. El [explorador de contadores](/assets/interactive/algorithms-series/explorer.html) permite variar tamaño y distribución; cuenta comparaciones, no predice milisegundos. La [medición final](/posts/medir-algoritmos-busqueda-lineal-map) incluye muestras reales y construcción del índice.

## Ejercicio: diseñar la carga antes del benchmark

Con 1.000 filas y 200 consultas, calcula el número de comparaciones si todas encuentran la primera fila, si encuentran la última y si no encuentran ninguna. Después explica por qué conocer únicamente «1.000 filas» no permite elegir entre búsqueda lineal e índice preparado.

## Referencias

- [Open Data Structures: modelo de cálculo y coste de las operaciones](https://opendatastructures.org/ods-python/1_4_Model_Computation.html).
