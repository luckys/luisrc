---
id: P094
title: 'Calibración, interpretabilidad y equidad: cuatro preguntas para una predicción'
published: 2026-10-18T01:08:00Z
locale: es
translationKey: ml-calibration-interpretability-fairness
slug: calibracion-interpretabilidad-equidad-modelos
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P093]
description: 'Distinguir ranking, probabilidades, explicaciones y errores por grupo: calibration curves, Brier, permutation importance y límites de fairness.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, calibracion, interpretabilidad, fairness]
---

Un modelo asigna 0,99 a una alerta y otro asigna 0,8 al mismo caso. Ambos lo colocan por delante de los demás y ambos pueden equivocarse. El primero no es mejor por mostrar más decimales ni por expresar más confianza.

Al revisar predicciones conviene separar cuatro preguntas: **¿ordena bien los casos?, ¿sus probabilidades son fiables?, ¿qué utiliza para predecir? y ¿cómo reparte los errores entre grupos?** Una respuesta favorable no resuelve las otras tres.

## Calibration compara probabilidades con frecuencias observadas

Un modelo bien calibrado debería aproximar un 80 % de positivos entre muchos casos comparables a los que asigna una probabilidad cercana a 0,8. No exige acertar cada uno ni convierte el resultado individual en una certeza.

Una **calibration curve**, o reliability diagram, agrupa predicciones en bins. Para cada uno compara la media de probabilidades con la proporción positiva observada. La diagonal representa coincidencia entre ambas cantidades.

El resultado depende del binning y del número de observaciones por grupo. Una curva cercana a la diagonal en cinco bins puede esconder diferencias dentro de un bin o grandes incertidumbres. Antes de interpretar un punto extremo necesitamos saber cuántos casos contiene.

**Brier score** promedia $(p_i-y_i)^2$; menor es mejor. Es sensible a calibración y discriminación, por lo que no debe interpretarse como una medida pura de descalibración.

## La misma ROC-AUC puede acompañar probabilidades peores

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/machine-learning/models.py) construye veinte casos. En el primer grupo hay dos positivos entre diez; en el segundo, ocho entre diez. Un predictor asigna 0,2 y 0,8; otro exagera con 0,01 y 0,99.

Archivo: `machine-learning/models.py`, construcción del contraejemplo.

```python
    y = np.array([0]*8 + [1]*2 + [0]*2 + [1]*8)
    honest = np.array([.2]*10 + [.8]*10)
    confident = np.array([.01]*10 + [.99]*10)
```

Ambos conservan ranking, **ROC-AUC=0,8** y las mismas clases al aplicar threshold 0,5. Sin embargo, Brier pasa de **0,16 a 0,1961** y log loss de **0,5004 a 0,9291**. Los errores del segundo predictor reciben probabilidades mucho menos compatibles con lo observado.

Son frecuencias construidas para explicar la diferencia, no una demostración de calibración en una población futura. Una transformación monótona puede conservar AUC y empeorar mucho las probabilidades.

<img src="/assets/visuals/ml-series/P094.svg" alt="Una predicción se revisa en cuatro dimensiones independientes: ranking, calibración, explicación de entradas y errores por grupo; ninguna certifica por sí sola las otras." width="666" height="1128" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P094.svg).

## Calibrar requiere datos separados del ajuste de cada modelo

Métodos como **sigmoid calibration** e **isotonic regression** aprenden una transformación entre scores y resultados. Isotonic ofrece más flexibilidad, pero puede sobreajustarse con pocos datos.

El ejemplo usa `CalibratedClassifierCV` con tres folds temporales dentro de train. Cada estimador base se ajusta antes de su tramo de calibración y el ensemble promedia sus predicciones calibradas. Validation solo evalúa el resultado de ese procedimiento.

Brier de la logística original en validation es aproximadamente **0,08965**; el procedimiento calibrado obtiene **0,08986**, ligeramente peor. No hemos encontrado una mejora. Además de transformar scores, esta configuración cambia los estimadores base y promedia varios modelos, así que no podemos atribuir la diferencia únicamente a «calibrar».

<img src="/assets/visuals/ml-series/calibration.svg" alt="Curva de calibración de la logística en validation, con cinco bins y referencia diagonal; los promedios de probabilidad no coinciden exactamente con todas las frecuencias observadas." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar la curva de calibración](/assets/visuals/ml-series/calibration.svg).

El threshold se decide después según costes y restricciones. Si el score no está calibrado, aplicar una regla de coste que lo trate como probabilidad puede producir decisiones equivocadas aunque el ranking sea útil.

## Explicar una predicción no demuestra una causa

**Permutation importance** baraja una columna y mide cuánto empeora una métrica. Pregunta cuánto depende este modelo de esa información en este conjunto. El laboratorio usa validation y aumento de log loss, cinco repeticiones y semilla fija.

La lluvia produce el mayor empeoramiento medio, aproximadamente **0,2796**. No significa que cause ese número de minutos de retraso. Variables correlacionadas pueden sustituirse y reducir su importancia individual; barajar una también puede crear combinaciones poco realistas.

**SHAP** distribuye la diferencia entre una predicción y una referencia entre features según una formulación basada en valores de Shapley. Su interpretación depende del explicador, la referencia y el tratamiento de dependencias. No ejecutamos SHAP aquí y no lo presentamos como una prueba causal o una explicación independiente del modelo.

Una explicación técnicamente consistente puede describir un modelo que utiliza señales inapropiadas. Primero hay que revisar la legitimidad de las entradas y de la decisión.

## Los promedios esconden errores diferentes por grupo

En validation hay **32 envíos rurales**, con trece positivos, y **148 urbanos**, con 31 positivos. A threshold 0,5, rural tiene nueve TP, cuatro FN y dos FP; urban tiene dieciocho TP, trece FN y tres FP.

Recall es aproximadamente 69,23 % y 58,06 %, respectivamente. No concluimos que el sistema sea justo ni injusto con esos dos valores. Los denominadores son pequeños, las prevalencias difieren y son grupos operativos ficticios, no una evaluación de atributos protegidos.

**Fairness** necesita definir quién recibe beneficios o daños, qué errores importan y en qué contexto. Igualar recall, tasa de falsos positivos o calibración son objetivos distintos y pueden entrar en tensión cuando las tasas base difieren. Ninguna métrica aislada certifica equidad; retirar una columna sensible tampoco elimina posibles proxies.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p094/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/machine-learning
```

## Garantías y límites

El laboratorio distingue ranking, calibración y grupos con números verificables. No realiza una auditoría legal, causal o de equidad. Las explicaciones se calculan sobre validation y son exploratorias; no se usan para rediseñar después la comparación final ya fijada.

## Ejercicio: revisar un bin antes de confiar en él

Añade el número de observaciones a cada punto de la curva de calibración. Compara cinco y diez bins. Explica qué puedes sostener si un bin con probabilidad media 0,9 solo contiene dos casos, aunque ambos resulten positivos.

Cerramos la serie con [un protocolo de experimentos reproducibles](/posts/experimentos-ml-reproducibles-baselines).

## Referencias

- [scikit-learn: calibración y CalibratedClassifierCV](https://scikit-learn.org/stable/modules/calibration.html).
- [scikit-learn: permutation importance](https://scikit-learn.org/stable/modules/permutation_importance.html).
- [SHAP: documentación de explicadores y ejemplos](https://shap.readthedocs.io/en/latest/).
- [Fairlearn: conceptos y evaluación de fairness](https://fairlearn.org/main/user_guide/fairness_in_machine_learning.html).
