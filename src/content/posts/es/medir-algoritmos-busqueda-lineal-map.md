---
id: DSA-03
title: 'Medir algoritmos: cuándo compensa cambiar una búsqueda lineal por Map'
published: 2026-10-18T03:20:00Z
locale: es
translationKey: algorithms-measure-linear-map
slug: medir-algoritmos-busqueda-lineal-map
draft: true
status: draft
math: true
level: intermedio
prerequisites: [DSA-07, DSA-09]
description: 'Big O, costes amortizados y esperados, muestras reales y construcción del índice: comparar algoritmos sin confundir un modelo con un benchmark.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [algoritmos, complejidad, benchmark, rendimiento, typescript]
---

Medir solo `map.get(id)` y compararlo con una búsqueda lineal puede llevarnos a una conclusión incompleta. El índice tuvo que construirse, ocupa memoria y quizá se descarte después de una sola consulta.

La comparación útil depende del trabajo completo: **cuántas búsquedas hacemos, qué buscan y cuánto reutilizamos la estructura**. Ya elegimos [estructuras de datos](/posts/estructuras-datos-elegir-patron-acceso) y razonamos sobre [la corrección de los algoritmos](/posts/algoritmos-busqueda-ordenacion-heaps-grafos). Ahora separaremos tres cosas: crecimiento teórico, operaciones contadas y tiempo observado.

## Big O describe crecimiento, no milisegundos

La **time complexity** relaciona el tamaño de la entrada con el trabajo de un algoritmo bajo un modelo de operaciones. La **space complexity** hace lo mismo con la memoria. Es habitual distinguir memoria total de memoria auxiliar; comparar ambas sin decir cuál usamos confunde.

Escribir T(n) ∈ O(f(n)) significa que, a partir de cierto tamaño, existen constantes c y n₀ tales que T(n) ≤ c·f(n). Es una cota superior asintótica, no una igualdad ni una predicción de reloj. **Θ**, theta, expresa una cota ajustada por arriba y por abajo. Un algoritmo lineal también está en O(n²), aunque esa descripción sea poco informativa.

Tres matices importan al leer una tabla: **worst case** acota el caso más costoso; **expected** depende de una distribución o de decisiones aleatorias; **amortized** reparte el coste sobre una secuencia. Amortizado no significa «normalmente»: una ampliación del array puede ser cara aunque el conjunto de inserciones tenga coste lineal. Estas distinciones aparecen en [Correctness, Time Complexity, and Space Complexity](https://opendatastructures.org/ods-python/1_5_Correctness_Time_Comple.html).

También hay parámetros distintos. Una búsqueda lineal cuesta O(n) en el peor caso; **q búsquedas** sobre el mismo catálogo cuestan O(qn), no simplemente O(n) si q también crece. Bajo el modelo habitual de hashing con accesos esperados constantes, construir y consultar un índice cuesta O(n+q). Eso no fija las constantes ni convierte ese supuesto en una garantía de ECMAScript.

## Contar comparaciones aclara qué cambia al crecer

Nuestro catálogo tiene IDs numéricos únicos y las consultas pueden buscar el primer elemento, el último o uno inexistente. En un bucle lineal, buscar el primero compara una vez; buscar el último o demostrar ausencia compara n veces.

Con 20.000 documentos y 200 ausencias hacemos exactamente **4.000.000 de comparaciones de ID**. No necesitamos un cronómetro para demostrarlo: son n·q iteraciones de ese bucle. Con 200 consultas al primer documento hacemos 200. Ambos escenarios usan el mismo array y la misma función.

El [explorador interactivo](/assets/interactive/algorithms-series/explorer.html) permite variar tamaño, número y patrón de consultas. Cuenta comparaciones lineales, inserciones al índice y llamadas de consulta por separado. **No suma operaciones distintas como si todas costaran lo mismo**, ni simula los pasos internos de una hash table.

Ese contraste explica por qué un benchmark que solo prueba ausencias no representa una carga que consulta casi siempre los primeros elementos. Tampoco basta con aumentar n: el patrón de acceso forma parte del experimento.

## El laboratorio compara tres trabajos, no dos nombres de colección

El [ZIP del laboratorio](/assets/examples/estructuras-algoritmos-lab.zip) incluye código, pruebas, explorador y las muestras originales. `scan` realiza las consultas lineales; `indexed` consulta un Map preparado antes del reloj; `fresh` construye el índice y hace las consultas dentro del tramo medido.

Archivo: `estructuras-algoritmos/benchmark.mjs`, operaciones medidas dentro de `measure`.

```javascript
const scan = () =>
  queries.reduce((sum, id) => sum + (linearSearch(rows, id)?.id ?? -1), 0)
const indexed = () => queries.reduce((sum, id) => sum + (reference.get(id)?.id ?? -1), 0)
const fresh = () => {
  const index = buildIndex(rows)
  return queries.reduce((sum, id) => sum + (index.get(id)?.id ?? -1), 0)
}
```

Cada operación produce un checksum que comprobamos **después de detener el reloj**. Esa comprobación detecta resultados distintos y consume la salida, aunque no impide toda optimización del motor. La construcción comprueba IDs y rechaza duplicados: no la reemplazamos por una variante menos estricta solo para mejorar su cifra.

<img src="/assets/visuals/algorithms-series/DSA-03.svg" alt="Un mismo catálogo y consultas alimentan tres variantes: búsqueda lineal, índice preparado e índice construido dentro del reloj. Se realizan cinco calentamientos y nueve muestras con orden rotatorio antes de interpretar el efecto de la reutilización." width="1329" height="856" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/algorithms-series/DSA-03.svg).

Usamos tres tamaños, **1.000, 5.000 y 20.000 documentos**, y cuatro patrones: primer elemento, último, ausencia y mezcla determinista con la mitad de ausencias. Cada lote contiene 200 consultas. Para cada caso hacemos cinco warmups por variante y nueve muestras, rotando el orden de las variantes.

Los datos y las consultas se crean fuera del tramo medido. No usamos red, disco ni un servidor: este experimento estudia búsquedas en memoria, no latencia de una API. Medimos con [`performance.now` de Node](https://nodejs.org/download/release/v24.19.0/docs/api/perf_hooks.html), un reloj de alta resolución, no con la hora del calendario.

## Qué observamos en esta ejecución

Entorno registrado: **Node 24.19.0**, Linux x64, kernel 7.0.0-38-generic e Intel Core Ultra 9 285H, con 16 CPUs lógicas visibles. Las cifras son medianas de nueve muestras, en **milisegundos por lote de 200 consultas**, redondeadas para leerlas. No son nanosegundos por operación ni resultados universales.

<div class="overflow-x-auto" role="region" aria-label="Medianas de búsqueda y construcción por lote" tabindex="0">

| Documentos | Patrón             | Búsqueda lineal | Map preparado | Construir Map + consultar |
| ---------- | ------------------ | --------------: | ------------: | ------------------------: |
| 1.000      | Mitad ausencias    |          0,1267 |        0,0030 |                    0,0219 |
| 5.000      | Mitad ausencias    |          0,3787 |        0,0027 |                    0,2103 |
| 20.000     | Mitad ausencias    |          1,6939 |        0,0037 |                    1,2796 |
| 20.000     | Siempre el primero |          0,0017 |        0,0024 |                    1,3376 |

</div>

<img src="/assets/visuals/algorithms-series/mixed-timings.svg" alt="Medianas observadas para lotes mixtos: al crecer de mil a veinte mil documentos, las búsquedas lineales pasan de 0,1267 a 1,6939 ms y construir más consultar pasa de 0,0219 a 1,2796 ms. El índice preparado queda por debajo de 0,004 ms por lote." width="900" height="500" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/algorithms-series/mixed-timings.svg).

En la carga mixta observada, preparar el índice compensa incluso al incluir su construcción para ese lote. Si siempre buscamos el primer elemento, construir veinte mil entradas hace un trabajo que el recorrido evita. La pequeña diferencia entre consultar el Map preparado y consultar el primero **no permite declarar un ganador general**: son tramos de pocos microsegundos por lote y especialmente sensibles al ruido.

La mediana tampoco cuenta toda la historia. Conservamos las nueve muestras y mostramos su dispersión para no esconder una ejecución lenta detrás de un único valor.

<img src="/assets/visuals/algorithms-series/mixed-samples.svg" alt="Nueve muestras individuales del caso mixto con veinte mil documentos, mostrando por separado búsqueda lineal, índice preparado y construcción más consulta. La variación entre muestras se conserva en el resultado descargable." width="900" height="500" loading="lazy" style="width:100%;height:auto" />

[Ampliar las muestras](/assets/visuals/algorithms-series/mixed-samples.svg).

## Cuándo se amortiza el índice depende de cuánto lo conserves

Podemos razonar con un modelo sencillo. Sea B el coste de construir, L el coste medio de una búsqueda lineal y H el de una consulta al índice. Reutilizarlo para q consultas compensa temporalmente cuando:

$$
B + qH < qL
$$

Si L > H, despejamos q > B/(L−H). La fórmula muestra qué hay que conocer; **no estamos estimando ese umbral con precisión** a partir de estas muestras. El coste medio cambia con el patrón, la carga y las cachés. Además, la mediana de «construir y consultar» menos la mediana de «consultar» no es una medición independiente exacta de B.

Si reconstruimos para cada petición, pagamos B repetidamente. Si conservamos el índice durante muchas peticiones, debemos definir su invalidez y mantenerlo coherente con el catálogo. Ahorrar CPU a cambio de devolver documentos eliminados no es una mejora.

## Qué no mide este benchmark

El **JIT**, garbage collector, cachés de CPU y frecuencia del procesador influyen. Los warmups reducen algunos efectos de arranque, pero no crean un estado idéntico. Ejecutamos tamaños y patrones en orden fijo y variantes en orden rotatorio; para una decisión importante añadiríamos procesos independientes y orden aleatorio reproducible.

El índice añade almacenamiento O(n) bajo el modelo habitual. Aquí no medimos sus bytes ni comparamos RSS: ambas variantes conservan el mismo catálogo y el proceso puede retener memoria entre muestras. Tampoco estudiamos strings muy largas como claves, crecimiento con actualizaciones, colisiones adversarias o presión de memoria real.

Un array ordenado con búsqueda binaria es otra alternativa: paga la ordenación y después busca sin mantener una hash table adicional. Si hay inserciones frecuentes, mantener ese orden también cuesta. Si el servicio espera una base de datos durante casi toda la petición, mejorar estas búsquedas puede apenas mover el tiempo total. El siguiente paso sería medir el flujo real y localizar su coste dominante.

## Garantías y límites

Verificamos resultados equivalentes, contadores y conservación de las muestras. Ningún test exige que una variante sea más rápida: eso convertiría ruido del equipo en fallos del proyecto. La evidencia apoya estas observaciones para esta carga, no una promesa sobre navegadores, otros runtimes o percentiles de producción.

Desde la carpeta extraída, `node --test tests/*.test.mjs` ejecuta las pruebas y `node benchmark.mjs` imprime una ejecución nueva sin sobrescribir la original. `results/benchmark.json` conserva el registro usado en este artículo. Node ejecuta las anotaciones compatibles mediante type stripping; la comprobación estática se hace aparte en el repositorio.

## Ejercicio: una consulta no es un lote de doscientas

Cambia q de 200 a 1 en una copia del benchmark y repite los cuatro patrones, conservando tamaños, muestras y checksum. El resultado correcto no es «Map pierde»: debes mostrar por separado consulta preparada y construcción más consulta, y explicar por qué la reutilización cambia la decisión.

Después prueba q=2.000. Compara resultados dentro de cada ejecución, conserva el entorno y evita exigir la misma duración en los tests. Así termina esta serie: con una decisión que puedes defender usando **contrato, carga y evidencia**, no solo una notación de complejidad.

## Referencias

Fuentes consultadas el 18 de octubre de 2026: [modelo de cómputo de Open Data Structures](https://opendatastructures.org/ods-python/1_4_Model_Computation.html), las definiciones de complejidad y la API de medición enlazadas arriba. Las cifras proceden exclusivamente del laboratorio de esta serie.
