---
id: P081
title: 'Distribuciones y percentiles: qué oculta una media de latencia'
published: 2026-10-18T00:05:00Z
locale: es
translationKey: math-distributions-percentiles
slug: distribuciones-media-percentiles-latencia
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P080]
description: 'Media, dispersión y percentiles junto a las distribuciones que pueden modelar conteos, eventos binarios y magnitudes positivas.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, estadistica, distribuciones, latencia]
---

La latencia media parece aceptable y aun así llegan quejas de esperas largas. Puede que nadie esté calculando mal: una sola cifra resume mal una distribución con muchos valores moderados y algunos muy grandes.

Tras [distinguir probabilidades condicionadas](/posts/probabilidad-bayes-prior-alertas), necesitamos describir cómo se reparten los valores posibles y qué información perdemos al resumirlos.

## Una distribución no es solo un histograma

Una **random variable** asigna un valor a cada resultado aleatorio. Su distribución describe las probabilidades asociadas. En variables discretas podemos asignar masa a un valor concreto; en variables continuas hablamos de densidad y de probabilidades sobre intervalos.

El **histogram** de una muestra aproxima una forma observada y depende de los bins elegidos. La **empirical CDF** representa la fracción de observaciones que no supera cada valor. No necesita decidir bins y permite localizar percentiles.

Ninguna gráfica convierte automáticamente una familia matemática en el modelo correcto de tus datos. Hay que comprobar soporte, dependencia, mezcla de poblaciones y mecanismo de generación.

## Media y dispersión describen aspectos diferentes

La **expectation** es una media teórica ponderada por probabilidades. La media muestral promedia los valores observados. La **median** ocupa el centro por posición y no responde igual a valores extremos.

La varianza mide dispersión cuadrática respecto a la media. Para una muestra usamos aquí:

$$
s^2=\frac{1}{n-1}\sum_i(x_i-\bar{x})^2.
$$

Tiene unidades al cuadrado. La **standard deviation** $s$ vuelve a las unidades originales. Usar $n-1$ corresponde al estimador muestral habitual de varianza; no significa que debamos dividir cualquier promedio por $n-1$.

## Cinco familias y las preguntas que permiten formular

**Bernoulli** describe una observación binaria, como acierto o fallo, con probabilidad $p$. **Binomial** cuenta aciertos en $n$ ensayos Bernoulli independientes con el mismo $p$. La independencia y la probabilidad constante son supuestos, no consecuencias del nombre.

**Poisson** puede modelar un conteo en un intervalo con parámetro $\lambda$. Su media y varianza coinciden con ese parámetro; que las peticiones lleguen agrupadas o con tasas cambiantes puede hacer insuficiente ese modelo. Véase la [referencia de NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm).

La **normal distribution** es simétrica y admite valores negativos. Puede describir ciertas variables o errores bajo un modelo, pero no es una elección automática para cualquier medida.

Una variable **log-normal** es positiva y su logaritmo sigue una normal. Puede producir una cola derecha pronunciada. La usaremos para generar latencias ficticias, no porque todas las latencias sigan esa distribución. NIST documenta [su parametrización](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3669.htm).

<img src="/assets/visuals/math-series/P081.svg" alt="Mil latencias lognormales sintéticas producen una media de 84,83 milisegundos, mediana de 51,54 y percentiles noventa y cinco y noventa y nueve mucho mayores." width="1016" height="482" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P081.svg).

## La cola aparece al conservar algo más que la media

El experimento genera 1.000 valores log-normales en milisegundos. En la ejecución archivada, la media es **84,83 ms**, la mediana **51,54 ms**, el p95 **264,66 ms** y el p99 **479,04 ms**.

<img src="/assets/visuals/math-series/latency-cdf.svg" alt="Distribución acumulada empírica de mil latencias sintéticas: la mayor parte cae lejos de los valores más altos de la cola; los percentiles se leen como fracciones acumuladas." width="900" height="460" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/math-series/latency-cdf.svg).

El p95 no es «la latencia media de los lentos». Es un umbral asociado al 95 % acumulado según una convención de cuantiles. En una muestra finita existen métodos de interpolación distintos, de modo que dos implementaciones pueden no coincidir exactamente.

Archivo: `matematicas-estadistica/foundations.py`, interpolación de `quantile` tras ordenar y validar la muestra.

```python
    index = (len(ordered)-1)*probability
    lower, upper = math.floor(index), math.ceil(index)
    return ordered[lower] + (ordered[upper]-ordered[lower])*(index-lower)
```

Usamos interpolación lineal sobre $(n-1)p$. La prueba fija esa decisión con cuatro valores conocidos. No se debe comparar sin aclaración con el nearest-rank usado en otras mediciones del blog.

## Resumir también requiere elegir el denominador

Si eliminamos timeouts del dataset, el percentil describe solo las respuestas completadas. Si mezclamos endpoints muy diferentes, una mejora del agregado puede venir de cambiar su proporción, no de acelerar ninguno.

Conservar counts, errores y segmentación ayuda a interpretar el resultado. Promediar los p95 de varias máquinas no produce el p95 de todas sus peticiones; para eso necesitamos una representación combinable adecuada de las observaciones.

## Garantías y límites

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) archiva muestras, semilla y método de cuantiles. No mide un servicio real ni ajusta una distribución a logs de producción. Tampoco demuestra que 1.000 observaciones permitan estimar con precisión cualquier percentil extremo.

Puedes ejecutar `python3 experiments.py` sin instalar paquetes. La biblioteca estándar `statistics` cubre los descriptivos básicos; una herramienta científica aporta otras estimaciones, pero no elige por ti una población adecuada.

## Ejercicio: un outlier cambia unas cifras más que otras

Añade una latencia de 100.000 ms a una copia de la muestra. Compara media, mediana y p95 antes y después. La media debe subir; explica por qué los otros resúmenes responden de otra manera y por qué no deberías borrar ese valor solo para mejorar el panel.

La siguiente lectura aborda [cuánta incertidumbre conservamos al generalizar desde esa muestra](/posts/inferencia-bootstrap-intervalos-confianza).

## Referencias

- [Python: statistics](https://docs.python.org/3.12/library/statistics.html).
- [NIST: normal distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm).
- [NIST: Poisson distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm).
- [NIST: log-normal distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3669.htm).

Fuentes consultadas el 18 de octubre de 2026. Las cifras son simuladas, no mediciones de tráfico real.
