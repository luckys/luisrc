---
id: P084
title: 'Entropía y cross entropy: qué castiga una pérdida probabilística'
published: 2026-10-18T00:08:00Z
locale: es
translationKey: math-entropy-cross-entropy
slug: entropia-cross-entropy-kl-logits
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P080]
description: 'Relaciona entropía, cross entropy, KL y likelihood, y evita errores numéricos al calcular pérdidas desde logits.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, teoria-informacion, probabilidades, machine-learning]
---

Dos clasificadores eligen la misma etiqueta incorrecta. Uno le había asignado un 51 % de probabilidad; el otro, un 99,9 %. Su accuracy cuenta ambos como un fallo, pero una pérdida probabilística puede distinguir cuánto confiaban en ese error.

Partimos de [probabilidad condicionada](/posts/probabilidad-bayes-prior-alertas). Ahora queremos puntuar una distribución predicha, no solo la etiqueta que queda al elegir su valor máximo.

## Entropía describe incertidumbre bajo una distribución

Para probabilidades discretas $p_i$, la **entropy** es:

$$
H(p)=-\sum_i p_i\log p_i.
$$

Usamos logaritmo natural, de modo que la unidad es **nats**. Con logaritmo en base dos serían bits. El término correspondiente a probabilidad cero se toma como cero mediante su límite.

Si un resultado tiene probabilidad uno, no hay incertidumbre sobre cuál ocurrirá y la entropía es cero. Una distribución uniforme sobre varias opciones tiene más incertidumbre. No significa que sus datos sean «peores»: describe un objeto probabilístico, no la calidad del software ni la dificultad de cualquier tarea.

La [referencia de probabilidad e información de Deep Learning](https://www.deeplearningbook.org/contents/prob.html) reúne estas definiciones. En el laboratorio exigimos probabilidades no negativas cuya suma sea uno, en lugar de tratar cualquier lista de scores como una distribución.

## Cross entropy pregunta qué pasa al predecir con otra distribución

Si los resultados siguen $p$ y predecimos probabilidades $q$ sobre las mismas clases:

$$
H(p,q)=-\sum_i p_i\log q_i.
$$

El experimento usa $p=(0.25,0.75)$ y $q=(0.5,0.5)$. La entropía calculada es aproximadamente **0,5623 nats** y la **cross entropy** es **0,6931 nats**.

La diferencia es la **KL divergence** $D_{KL}(p\Vert q)$, aproximadamente **0,1308 nats**:

$$
H(p,q)=H(p)+D_{KL}(p\Vert q).
$$

KL no es una distancia métrica: no tiene por qué ser simétrica. Si asignamos probabilidad cero a un resultado posible bajo $p$, la cross entropy y KL pueden ser infinitas. Añadir un epsilon cambia el valor y debe ser una decisión numérica explícita, no una forma de ocultar el caso.

## Likelihood conecta la fórmula con ejemplos etiquetados

Para una observación cuya clase correcta es $y$, la pérdida es $-\log q_y$. Con varios ejemplos independientes bajo el modelo, maximizar el producto de las probabilidades asignadas a lo observado equivale a minimizar su **negative log likelihood**, o **NLL**, sumada.

Trabajar con logaritmos convierte productos en sumas y facilita el cálculo. Para clasificación, el promedio de estas pérdidas es una forma habitual de cross entropy empírica.

Asignar 0,9 a la clase correcta produce aproximadamente **0,1054 nats**; asignarle 0,1 produce **2,3026 nats**. El castigo aumenta al dar poca probabilidad al resultado que ocurrió. Esto no vuelve irrelevante la accuracy: ambas métricas responden preguntas distintas.

## Softmax convierte logits en probabilidades, no en certeza calibrada

Los **logits** son scores reales. **Softmax** aplica exponenciales y normaliza para obtener probabilidades que suman uno. Un logit no es ya una probabilidad ni está limitado al intervalo de cero a uno.

La implementación ingenua calcula `exp(1000)` y puede desbordar. Restar el máximo a todos los logits conserva matemáticamente softmax y evita ese desbordamiento en este caso. Pero un valor muy pequeño todavía puede redondearse a cero.

<img src="/assets/visuals/math-series/P084.svg" alt="Para logits mil y menos mil, softmax seguido de log puede alcanzar cero; log-sum-exp calcula directamente una NLL finita de dos mil nats para la segunda clase." width="1091" height="628" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P084.svg).

Si después hacemos `log` de una probabilidad redondeada a cero, recuperamos el problema. Para calcular NLL conviene trabajar directamente con **log-sum-exp**.

Archivo: `matematicas-estadistica/foundations.py`, núcleo de `nll_logits` tras validar entradas.

```python
    maximum = max(logits)
    return maximum-logits[target]+math.log(math.fsum(math.exp(value-maximum) for value in logits))
```

Con logits `[1000, -1000]` y clase correcta 1, la pérdida es **2000 nats**, finita. El test verifica ese caso y otro moderado con resultado conocido. **SciPy** documenta una [implementación especializada de logsumexp](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.logsumexp.html).

## Una pérdida baja sigue necesitando contexto

Softmax no garantiza calibración: decir 0,9 no demuestra acertar el 90 % de los casos comparables. La evaluación debe estudiar ese comportamiento con datos adecuados.

También importa la mezcla de clases. Un agregado favorable puede ocultar una clase minoritaria que siempre recibe probabilidades muy bajas. Y minimizar pérdida de entrenamiento no demuestra generalización: necesitamos evaluación separada y controlar filtraciones de información.

## Garantías y límites

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) verifica la identidad entre entropía, cross entropy y KL, soportes con ceros y estabilidad de los logits del ejemplo. Usa distribuciones discretas pequeñas; no entrena ni calibra un clasificador.

El cálculo desde logits muestra una decisión de estabilidad concreta, no garantiza precisión para cualquier magnitud extrema. Para trabajo real utilizaríamos funciones de pérdida mantenidas por una biblioteca.

## Ejercicio: misma etiqueta, distinta confianza

Compara dos predicciones sobre la misma clase correcta con probabilidades 0,4 y 0,01. Pueden producir la misma etiqueta ganadora incorrecta en un problema binario, pero la segunda debe tener mayor NLL. Calcula ambas antes de consultar la función.

Cerramos la serie con [otra representación de datos: muestras de una señal y sus frecuencias](/posts/fourier-fft-convolucion-errores-numericos).

## Referencias

- [Deep Learning: probabilidad e información](https://www.deeplearningbook.org/contents/prob.html).
- [SciPy: logsumexp](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.logsumexp.html).
- [Google: log loss y regularización](https://developers.google.com/machine-learning/crash-course/logistic-regression/loss-regularization).

Fuentes consultadas el 18 de octubre de 2026. Todas las pérdidas son cálculos sobre distribuciones ficticias.
