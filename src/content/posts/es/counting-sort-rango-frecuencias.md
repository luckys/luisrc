---
id: DSA-21
title: 'Counting sort: ordenar contando funciona si puedes pagar el rango'
published: 2026-10-18T03:15:00Z
locale: es
translationKey: dsa-counting-sort
slug: counting-sort-rango-frecuencias
draft: true
status: draft
level: intermedio
prerequisites: [DSA-10]
description: 'Ordena enteros con frecuencias y distingue n del rango de claves. Por qué no contradice el límite de ordenación por comparaciones y qué cambia con objetos.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, ordenacion, counting-sort, typescript]
---

Ordenar mil puntuaciones entre 0 y 100 no plantea el mismo problema que ordenar mil identificadores repartidos entre cero y un billón. **Counting sort** puede aprovechar el primer caso y reservar una cantidad absurda de memoria en el segundo.

Hasta ahora hemos ordenado preguntando qué elemento va antes que otro. Aquí cambiaremos de modelo: usaremos la clave como posición en un array de contadores. Esa condición nueva explica tanto la ventaja como el límite.

## El tamaño de la entrada y el rango son variables distintas

Llamemos n al número de valores y k al número de claves posibles. Si admitimos enteros entre 0 y `max`, entonces k es `max + 1`, aunque solo aparezcan tres valores distintos.

Primero reservamos k contadores en cero. Después recorremos los n valores e incrementamos su contador. Finalmente recorremos las claves en orden y emitimos cada una tantas veces como apareció.

```text
Entrada: [3, 0, 3, 1], rango 0..3
Clave:       0  1  2  3
Frecuencia:  1  1  0  2
Salida:     [0, 1, 3, 3]
```

La salida conserva multiplicidades sin comparar cada par. Pero hemos visitado todas las posiciones del rango, incluidas las que no aparecen. Un rango enorme y disperso es precisamente el caso que no conviene ocultar al hablar de tiempo lineal.

## La implementación limita el recurso que va a reservar

Archivo `focused.ts` del [laboratorio](/assets/examples/estructuras-algoritmos-lab.zip), función completa:

```typescript
export function countingSort(input: readonly number[], max: number): number[] {
  if (!Number.isInteger(max) || max < 0 || max > 100000)
    throw new RangeError('Rango no admitido')
  const counts = new Array<number>(max + 1).fill(0)
  for (const value of input) {
    if (!Number.isInteger(value) || value < 0 || value > max)
      throw new RangeError('Clave fuera de rango')
    counts[value] = counts[value]! + 1
  }
  const output: number[] = []
  for (let value = 0; value <= max; value++)
    for (let count = 0; count < counts[value]!; count++) output.push(value)
  return output
}
```

El límite 100.000 es una política explícita del ejemplo para evitar reservas arbitrarias. No es una frontera matemática de counting sort ni garantiza por sí sola una cantidad exacta de bytes: la representación del array depende del runtime.

También rechazamos negativos, fracciones y `NaN`. Otra implementación podría desplazar el rango usando un mínimo y un máximo. Tendría que validar la amplitud antes de reservar y comprobar que sus cálculos son representables.

## Dos bucles anidados no implican automáticamente O(nk)

La emisión recorre k claves. Su bucle interior se ejecuta, en total, n veces: la suma de frecuencias es n. No se ejecuta n veces para cada clave.

El coste es O(n + k) y el espacio adicional es O(n + k), contando salida y contadores. Si k crece mucho más que n, no podemos abreviarlo como O(n). La versión del laboratorio inicializa los contadores incluso cuando la entrada está vacía.

Tampoco contradice el límite Ω(n log n) para ordenar por comparaciones en el modelo general. Hemos restringido las claves a enteros de rango conocido y permitimos usarlas como índices. Son supuestos distintos, así que el límite de un modelo no se aplica sin más al otro.

## Reconstruir números no equivale a ordenar registros

Esta función recibe y devuelve números. Si cada entrada fuera `{ score, name }`, reconstruir solo los valores de `score` perdería los nombres. No podríamos anunciarla como una ordenación estable de objetos.

Una variante para registros calcula posiciones mediante frecuencias acumuladas y coloca los objetos conservando el orden de equivalentes. Esa estabilidad resulta importante al construir **radix sort**, que ordena por partes de la clave en varias pasadas. No implementamos esa variante ni radix sort aquí: ambos necesitan explicar posiciones, dirección de recorrido y preservación de los pasos anteriores.

Con números indistinguibles de igual valor, nuestro test puede comprobar frecuencias y orden, pero no observar una identidad relativa inexistente. Es mejor declarar ese alcance que repetir «counting sort es estable» sin conectar la propiedad al código publicado.

## Cuándo empezar por esta alternativa

Puntuaciones acotadas, categorías ordinales pequeñas o claves enteras densas pueden justificarla. Si el rango viene de una entrada externa, validarlo es parte del diseño, no una optimización opcional.

Para strings arbitrarios, números reales o claves dispersas enormes, una ordenación por comparador suele ser una base más adecuada. Si solo necesitamos contar frecuencias sin obtener un array ordenado completo, quizá el problema ni siquiera requiera emitir n elementos.

## Garantías y límites

Los tests cubren duplicados, entrada vacía, extremos de rango y rechazo de claves o límites inválidos. No medimos rendimiento ni soportamos objetos, negativos o rangos mayores. La función conserva el array original y devuelve exactamente las mismas frecuencias.

## Ejercicio: la trampa de «solo hay tres valores»

Compara las entradas `[0, 1, 2]` y `[0, 1, 100000]`. Ambas contienen tres valores distintos, pero nuestra reserva y recorrido del rango cambian mucho. Explica qué variable controla ese coste y por qué reemplazar k por «número de valores presentes» describiría otro algoritmo.

## Referencias

- [Open Data Structures: counting sort, registros asociados y radix sort](https://opendatastructures.org/ods-python/11_2_Counting_Sort_Radix_So.html).
