---
id: P090
title: 'Árboles, Random Forest y Gradient Boosting: cómo comparar modelos tabulares'
published: 2026-10-18T01:04:00Z
locale: es
translationKey: ml-trees-ensembles
slug: arboles-random-forest-gradient-boosting
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P088, P089]
description: 'Splits, profundidad, bagging y boosting: comparar familias de modelos sobre las mismas features sin confundir un resultado sintético con un ranking universal.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, arboles, random-forest, gradient-boosting]
---

Una combinación lineal puede quedarse corta si la lluvia apenas afecta a rutas cortas, pero agrava mucho los retrasos en rutas largas. Un árbol puede expresar esa interacción mediante preguntas sucesivas, sin obligarnos a escribir de antemano todas las combinaciones.

Eso no significa que debamos sustituir el modelo lineal automáticamente. La flexibilidad de **decision trees** también permite aprender detalles accidentales de train. Para comparar necesitamos las mismas entradas, particiones y métricas.

## Un árbol elige cortes que hacen más homogéneas sus hojas

Un **split** divide observaciones mediante una condición, por ejemplo `distance_km <= 300`. El algoritmo prueba candidatos y elige según una reducción de impureza, ponderada por cuántas observaciones quedan en cada lado.

En clasificación binaria, **Gini impurity** puede escribirse $1-p^2-(1-p)^2$, donde $p$ es la proporción positiva del nodo. Es cero cuando todas las observaciones comparten clase. **Entropy** también mide mezcla mediante probabilidades y logaritmos, aunque no produce siempre el mismo árbol.

La búsqueda suele ser **greedy**: escoge un corte localmente conveniente, no examina todos los árboles posibles. En una hoja, el clasificador estima probabilidades a partir de las frecuencias de las clases que llegaron allí. Una hoja pequeña con todos sus ejemplos positivos puede producir una confianza poco defendible fuera de train.

**Max depth**, tamaño mínimo de hoja y pruning limitan complejidad. Un árbol de profundidad uno, un **stump**, puede quedarse corto; uno muy profundo puede capturar ruido. Este equilibrio se suele describir como **bias–variance trade-off**: limitar capacidad puede aumentar error sistemático, pero reducir sensibilidad a la muestra.

## Random Forest reduce dependencia entre árboles

**Bagging** entrena estimadores sobre muestras bootstrap del conjunto de entrenamiento y combina sus salidas. Cada muestra contiene repeticiones; no son nuevos datos independientes.

**Random Forest** añade selección aleatoria de features candidatas en los cortes. Busca que los árboles no cometan siempre los mismos errores. Para clasificar, scikit-learn promedia sus probabilidades por clase y elige después la más alta.

Más árboles pueden estabilizar ese promedio, pero no resuelven etiquetas incorrectas, leakage o features insuficientes. También aumentan memoria y coste de inferencia. Un bosque puede reducir varianza frente a un árbol sin superar a un modelo lineal bien planteado.

Archivo: `machine-learning/models.py`, configuración del bosque probado.

```python
        'forest': RandomForestClassifier(n_estimators=100, max_depth=5,
                    min_samples_leaf=5, random_state=seed, n_jobs=1),
```

Fijamos cien árboles y hojas de al menos cinco observaciones. No son valores óptimos conocidos: son una configuración acotada que podemos reproducir y comparar.

## Gradient Boosting añade correcciones de forma secuencial

En **Gradient Boosting**, cada etapa añade un estimador para mejorar la pérdida del conjunto actual. En regresión con error cuadrático la intuición de aprender residuos funciona directamente; con otras pérdidas, las correcciones se relacionan con su gradiente, no simplemente con restar etiquetas.

El **learning rate** reduce la contribución de cada etapa. Su interacción con número de iteraciones, profundidad y regularización importa más que cualquiera de esos parámetros aislado.

<img src="/assets/visuals/ml-series/P090.svg" alt="Random Forest entrena árboles con bootstrap y aleatoriedad de features para promediar probabilidades; Gradient Boosting agrega correcciones sucesivas guiadas por la pérdida." width="1075" height="930" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P090.svg).

El laboratorio ejecuta **HistGradientBoostingClassifier**, que agrupa valores numéricos en bins para buscar cortes. **XGBoost** y **LightGBM** son otras bibliotecas de boosted trees con opciones y estrategias propias; LightGBM documenta crecimiento leaf-wise y XGBoost objetivos con regularización. No las hemos ejecutado ni comparado aquí, así que no les atribuimos estas cifras ni un orden de velocidad.

## El mismo protocolo puede dar un ganador poco espectacular

El [laboratorio descargable](/assets/examples/machine-learning-lab.zip) entrena con 540 envíos y evalúa en los 180 siguientes. La métrica es **average precision**, una medida de ranking que detallaremos más adelante. No es accuracy.

| Modelo | Average precision en validation |
| --- | ---: |
| Baseline de probabilidad constante | 0,2444 |
| Regresión logística | 0,8457 |
| Árbol, profundidad 3 | 0,7465 |
| Random Forest | 0,8342 |
| HistGradientBoosting | 0,7959 |

La logística encaja bien con el mecanismo que generó estas features y el target. Este resultado no establece que supere a los ensembles en otros problemas. Tampoco hemos dedicado igual presupuesto de búsqueda a cada familia: son referencias educativas con configuraciones fijas, no una competición exhaustiva.

<img src="/assets/visuals/ml-series/tree-depth.svg" alt="Average precision de entrenamiento y validación al aumentar profundidad del árbol; train sube de cero coma cuarenta y uno a cero coma ochenta y uno, mientras validation deja de mejorar entre profundidad seis e ilimitada." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar la curva de profundidad](/assets/visuals/ml-series/tree-depth.svg).

La curva muestra que profundizar mejora train sin garantizar mejora en validation. No necesita descender de forma espectacular para advertirnos de que capacidad adicional y generalización son cosas distintas.

## Garantías y límites

Todas las referencias usan las mismas columnas y particiones. No se han medido latencia, memoria, rendimiento de entrenamiento ni robustez ante cambios reales. Las probabilidades de árboles y ensembles tampoco están calibradas por definición.

## Ejercicio: cambiar una condición a la vez

Mantén cien árboles y compara `min_samples_leaf=1` frente a cinco, usando solo train y validation. Anota AP y Brier, no elijas el ganador mirando test y comprueba si el cambio favorece ambas métricas o solo una.

Seguimos con [clustering cuando no tenemos etiquetas](/posts/clustering-kmeans-dbscan-estabilidad).

## Referencias

- [scikit-learn: árboles de decisión](https://scikit-learn.org/stable/modules/tree.html).
- [scikit-learn: bagging, bosques y boosting](https://scikit-learn.org/stable/modules/ensemble.html).
- [XGBoost: introducción a boosted trees](https://xgboost.readthedocs.io/en/stable/tutorials/model.html).
- [LightGBM: características y estrategia de crecimiento](https://lightgbm.readthedocs.io/en/stable/Features.html).
