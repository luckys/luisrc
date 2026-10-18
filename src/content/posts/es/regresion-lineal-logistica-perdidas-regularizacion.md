---
id: P089
title: 'Regresión lineal y logística: qué aprende el modelo y qué significa su salida'
published: 2026-10-18T01:03:00Z
locale: es
translationKey: ml-linear-logistic-regression
slug: regresion-lineal-logistica-perdidas-regularizacion
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P088]
description: 'Coeficientes, MSE, sigmoid, log loss y regularización: dos primeros modelos para entender el ajuste y separar predicción de decisión.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, regresion, python, optimizacion]
---

Queremos estimar minutos de retraso y comenzamos con una combinación de distancia, carga y lluvia prevista. Antes de probar un modelo más complejo conviene entender qué puede expresar esa combinación y qué significa que el entrenamiento la considere buena.

La **linear regression** aproxima una cantidad numérica. La **logistic regression**, pese a compartir el apellido, suele utilizarse para clasificación. Comparten una combinación lineal de entradas, pero cambian la salida y la pérdida que optimizan.

## Un coeficiente relaciona una entrada con la predicción del modelo

Con una sola feature, la regresión lineal predice $\hat y=b+wx$. $b$ es el **intercept** y $w$ el coeficiente. Si $x$ mide kilómetros e $y$ minutos, $w$ se expresa en minutos por kilómetro.

Con varias entradas usamos $\hat y=b+\sum_j w_jx_j$. Un coeficiente describe cómo cambia la predicción al variar esa entrada manteniendo las otras constantes **dentro de ese modelo**. No demuestra el efecto causal de intervenir sobre ella.

Si dos variables aportan información muy parecida, los coeficientes pueden cambiar mucho entre muestras aunque las predicciones sean similares. Y si previamente estandarizamos las columnas, sus unidades dejan de ser las originales: un incremento de uno representa una desviación estándar aprendida en train.

## MSE convierte los residuos en un objetivo de ajuste

El residuo es la diferencia entre valor observado y predicción. La **mean squared error** promedia sus cuadrados:

$$
\operatorname{MSE}=\frac{1}{n}\sum_{i=1}^{n}(y_i-\hat y_i)^2.
$$

Los errores grandes pesan más que con error absoluto. Eso puede ser útil si importan especialmente, pero también hace al ajuste sensible a valores extremos. La pérdida no decide qué observaciones están mal registradas.

Minimizar MSE y minimizar la suma de cuadrados dan los mismos coeficientes sin penalización, porque difieren por un factor constante. Al añadir regularización, su escala respecto a la pérdida sí importa.

Podemos optimizar con [gradient descent](/posts/gradiente-descendente-learning-rate-convergencia), pero para este ejemplo utilizamos **least squares** mediante una factorización numérica. No calculamos explícitamente la inversa de $X^TX$: puede ser inestable o no existir.

Archivo: `machine-learning/models.py`, solución con NumPy e intercept explícito.

```python
def ols(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    design = np.column_stack([np.ones(len(x)), x])
    coefficients, _, rank, _ = np.linalg.lstsq(design, y, rcond=None)
    if rank < design.shape[1]:
        raise ValueError('no hay solución única para los coeficientes')
    return coefficients
```

En el [laboratorio](/assets/examples/machine-learning-lab.zip), diez observaciones inventadas alrededor de una recta producen intercept **2,2** y pendiente **2,963636…**. `LinearRegression` de scikit-learn obtiene los mismos valores dentro de tolerancia numérica. Son coeficientes de ese pequeño ejemplo, no del clasificador logístico de retrasos.

Los tests incluyen la recta exacta $2+3x$ y una entrada constante que impide identificar por separado intercept y pendiente. Una biblioteca puede devolver una solución de norma mínima en el segundo caso; nuestro ejemplo lo rechaza para hacer visible que los coeficientes no son únicos.

<img src="/assets/visuals/ml-series/P089.svg" alt="Una combinación lineal produce un número para regresión con MSE, o pasa por sigmoid para clasificación con log loss; el umbral de decisión se aplica después de estimar la probabilidad." width="858" height="798" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P089.svg).

## La sigmoid cambia la salida, no valida su interpretación

Para un target binario definimos $z=b+\sum_jw_jx_j$ y aplicamos la **sigmoid**:

$$
p=\frac{1}{1+e^{-z}}.
$$

La salida está entre cero y uno. El entrenamiento logístico utiliza **log loss**, $-[y\log p+(1-y)\log(1-p)]$ por observación. Penaliza especialmente asignar una probabilidad muy pequeña al resultado que termina ocurriendo.

El coeficiente es lineal en los **log odds**, $\log(p/(1-p))$, no en la probabilidad. Aumentar $z$ en una unidad no aumenta $p$ en una cantidad fija: depende de dónde estemos en la curva.

Una salida 0,8 no garantiza que el 80 % de los envíos similares se retrasen. Esa interpretación requiere evaluar **calibration** en datos adecuados. Sigmoid limita el rango; calibración comprueba la correspondencia entre probabilidades y frecuencias.

## L1 y L2 limitan coeficientes a cambio de introducir sesgo

**L2** penaliza la suma de cuadrados de los coeficientes y tiende a reducirlos. **L1** penaliza la suma de sus valores absolutos y puede llevar algunos a cero. Ninguna demuestra que una variable eliminada sea irrelevante en cualquier población.

La penalización hace que las escalas importen. Un modelo puede necesitar un coeficiente pequeño para kilómetros y uno grande para una proporción sin que la primera entrada sea menos importante. Estandarizar dentro del pipeline evita comparar magnitudes arbitrarias al penalizar.

El laboratorio usa logística con `C=1`, regularización L2 por defecto en la versión registrada. **C** es una fuerza inversa de regularización: menor C implica mayor penalización. No debe confundirse con el parámetro alpha de otros estimadores, ni trasladarse entre implementaciones sin revisar la normalización del objetivo.

## El threshold convierte una predicción en una acción

Un **threshold** de 0,5 clasifica como retraso los scores iguales o superiores. Es una convención, no una obligación. Con costes asimétricos puede convenir otro umbral, elegido en validation y respetando capacidad de revisión.

En validation, nuestra logística detecta **27 de 44 retrasos** con cinco falsas alertas a 0,5. No estamos optimizando directamente esa matriz al minimizar log loss: pérdida de entrenamiento y política de decisión resuelven preguntas relacionadas pero diferentes.

## Garantías y límites

La comparación con NumPy comprueba el ajuste numérico de una regresión simple. No valida supuestos inferenciales, intervalos de coeficientes ni causalidad. La clasificación usa datos sintéticos, y un buen ajuste lineal aquí no anticipa el mejor algoritmo para otro dataset.

## Ejercicio: cambiar unidades sin cambiar la pregunta

Repite el ejemplo lineal convirtiendo kilómetros en metros. La pendiente debe dividirse por mil y las predicciones mantenerse, salvo redondeo. Explica después por qué introducir una penalización sin revisar la escala puede cambiar ese resultado.

Continuamos con [árboles y ensembles para datos tabulares](/posts/arboles-random-forest-gradient-boosting).

## Referencias

- [NumPy: numpy.linalg.lstsq](https://numpy.org/doc/stable/reference/generated/numpy.linalg.lstsq.html).
- [scikit-learn: modelos lineales](https://scikit-learn.org/stable/modules/linear_model.html).
- [scikit-learn: LogisticRegression y sus parámetros](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html).
