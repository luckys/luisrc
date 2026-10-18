---
id: P080
title: 'Probabilidad y Bayes: una alerta no es la probabilidad de que haya un problema'
published: 2026-10-18T00:04:00Z
locale: es
translationKey: math-probability-bayes
slug: probabilidad-bayes-prior-alertas
draft: true
status: draft
math: true
level: intermedio
prerequisites: []
description: 'Probabilidades condicionadas, independencia, prior y posterior mediante un filtro de spam ficticio y una simulación reproducible.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, probabilidad, bayes, estadistica]
---

Un filtro detecta el 90 % del spam. Llega un correo marcado y concluimos que tiene un 90 % de probabilidad de ser spam. Hemos intercambiado dos preguntas diferentes: cuánto spam detecta el filtro y cuánto spam hay entre los correos que marca.

**Bayes** permite relacionarlas, pero necesita conocer más que la sensibilidad del filtro. Este artículo puede leerse de forma independiente: solo trabajaremos con eventos, proporciones y un ejemplo ficticio.

## Una probabilidad condicionada cambia el grupo que observamos

Un **event** es un conjunto de resultados posibles. Llamaremos $S$ al evento «el correo es spam» y $A$ a «el filtro genera una alerta».

$P(S)$ describe la frecuencia o creencia probabilística asignada a spam en la población del modelo. $P(A\mid S)$ describe alertas dentro del grupo spam. En cambio, $P(S\mid A)$ mira spam dentro del grupo alertado.

Cuando $P(S)>0$, la definición es $P(A\mid S)=P(A\cap S)/P(S)$. La probabilidad conjunta $P(A\cap S)$ se refiere a que ocurran ambos hechos, sin cambiar el denominador a un subgrupo.

Dos eventos son **independent** si su probabilidad conjunta factoriza como $P(A)P(S)$. Un filtro útil no pretende que su alerta sea independiente de la condición que intenta detectar. Tampoco podemos suponer que dos reglas del mismo filtro aportan evidencia independiente: quizá ambas reaccionan al mismo texto.

## Contar correos hace visible el denominador

Imaginemos **10.000 correos**, con un **1 % de spam**. El filtro marca el 90 % del spam y genera una alerta para el 5 % del correo que no es spam. Son supuestos inventados, no métricas de un producto real.

Hay 100 correos spam, de los que se marcan 90. Entre los 9.900 legítimos se marcan 495. En total tenemos 585 alertas y solo 90 corresponden a spam:

$$
P(S\mid A)=\frac{90}{90+495}\approx0.1538.
$$

El resultado es aproximadamente **15,38 %**, no 90 %. Una tasa de falsas alertas relativamente pequeña puede producir muchas alertas cuando el grupo mayoritario es muy grande.

<img src="/assets/visuals/math-series/P080.svg" alt="De diez mil correos ficticios, cien son spam; el filtro genera noventa alertas correctas y cuatrocientas noventa y cinco falsas, dejando aproximadamente quince coma treinta y ocho por ciento de spam entre alertas." width="703" height="942" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P080.svg).

## Bayes reúne prior, likelihood y evidencia

La fórmula expresa el mismo recuento:

$$
P(S\mid A)=\frac{P(A\mid S)P(S)}{P(A\mid S)P(S)+P(A\mid\neg S)P(\neg S)}.
$$

El **prior** $P(S)$ describe la probabilidad antes de incorporar esa alerta. La **likelihood** $P(A\mid S)$ describe cuánto encaja la alerta bajo la hipótesis spam. La **posterior** es $P(S\mid A)$ después de condicionar en la evidencia.

Una likelihood no es una posterior. Mantener fijas las tasas del filtro y cambiar la proporción de spam cambia la posterior. Esa es una razón para no transportar automáticamente una métrica de un dataset a otra población.

Archivo: `matematicas-estadistica/foundations.py`, núcleo de `bayes_flag` tras validar probabilidades.

```python
    joint = prior*sensitivity
    evidence = joint + (1-prior)*false_positive
    if evidence == 0:
        raise ValueError('el evento condicionado tiene probabilidad cero')
    return joint/evidence
```

La función rechaza una condición con probabilidad cero en lugar de devolver una certeza inventada. El test compara el cálculo con el recuento `90/585`.

## Una simulación permite comprobar el modelo, no demostrar sus supuestos

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) genera 100.000 correos sintéticos bajo esos parámetros. En la ejecución archivada hubo **5.807 alertas**, de las cuales **853** correspondían a spam: aproximadamente **14,69 %**.

No esperamos obtener exactamente 15,38 % en una muestra finita. Tampoco la diferencia demuestra que Bayes esté mal: la fórmula calcula el modelo y la simulación obtiene una realización aleatoria de él. Conservamos semilla, generador y resultados para poder reproducirla.

Ejecuta `python3 experiments.py` desde la carpeta descargada. Cambia después el prior y predice la dirección del cambio antes de mirar la salida.

## Una probabilidad no decide por sí sola qué hacer

Bloquear el correo, enviarlo a revisión o mostrar un aviso tiene costes distintos. Elegir un umbral necesita considerar falsos positivos, falsos negativos y consecuencias de cada acción.

Un clasificador que emite 0,9 tampoco está necesariamente calibrado. Una probabilidad predicha requiere evaluación sobre datos pertinentes; el valor numérico no valida su interpretación.

## Garantías y límites

El ejemplo aplica probabilidades discretas a una población ficticia y conocida. No estima las tasas de un filtro real, no calcula incertidumbre sobre esos parámetros y no valida independencia entre señales. Si las tasas son inciertas, la conclusión también depende de esa incertidumbre.

## Ejercicio: mismo filtro, otra población

Cambia el prior del 1 % al 20 %, manteniendo sensibilidad 90 % y falsas alertas 5 %. El resultado debe ser $0.18/(0.18+0.04)$, aproximadamente 81,82 %. Explica qué supuesto has mantenido y por qué habría que verificarlo al cambiar de población real.

Seguimos con [las distribuciones que describen resultados y sus resúmenes](/posts/distribuciones-media-percentiles-latencia).

## Referencias

- [ProbabilityCourse: Bayes' Rule](https://www.probabilitycourse.com/chapter1/1_4_3_bayes_rule.php).
- [Deep Learning: probabilidad e información](https://www.deeplearningbook.org/contents/prob.html).

Fuentes consultadas el 18 de octubre de 2026. Todos los correos y parámetros del ejemplo son ficticios.
