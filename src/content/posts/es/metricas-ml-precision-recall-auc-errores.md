---
id: P093
title: 'Métricas de Machine Learning: qué errores oculta un buen porcentaje'
published: 2026-10-18T01:07:00Z
locale: es
translationKey: ml-metrics-errors
slug: metricas-ml-precision-recall-auc-errores
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P092]
description: 'Confusion matrix, precision, recall, F1, ROC-AUC, average precision y errores de regresión: elegir una evaluación conectada con la decisión.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, metricas, precision, recall, evaluacion]
---

Un detector de defectos acierta el 99 % de las piezas. Si solo una de cada cien está defectuosa, podría conseguirlo declarando todas correctas. El porcentaje parece bueno, pero no detecta ninguna de las piezas que queríamos retirar.

Una métrica resume un aspecto del comportamiento. Elegirla requiere definir qué error importa, sobre qué población y con qué decisión. **Accuracy**, **recall** y **ROC-AUC** no son maneras intercambiables de expresar «calidad».

## La confusion matrix conserva los cuatro resultados posibles

Llamaremos positiva a una condición que queremos detectar: defecto o retraso. Un **true positive**, TP, es un positivo detectado; un **false negative**, FN, es un positivo que dejamos pasar. Un **false positive**, FP, es una falsa alarma; un **true negative**, TN, es un negativo correctamente descartado.

En validation, el clasificador logístico de envíos utiliza threshold 0,5 y produce:

| Real / predicho | Sin alerta | Con alerta |
| --------------- | ---------: | ---------: |
| Sin retraso     |     131 TN |       5 FP |
| Con retraso     |      17 FN |      27 TP |

Hay **44 retrasos** entre 180 envíos. La **accuracy** es $(TP+TN)/n=158/180$, aproximadamente **87,78 %**. El baseline de no alertar obtiene 75,56 %, pero detecta cero retrasos.

**Precision** pregunta qué proporción de alertas era correcta: $TP/(TP+FP)=27/32$, **84,38 %**. **Recall** pregunta qué proporción de retrasos detectamos: $TP/(TP+FN)=27/44$, **61,36 %**. Cambiar el denominador cambia la pregunta.

**F1** es la media armónica $2PR/(P+R)$, aproximadamente **0,7105** aquí. Combina precision y recall, pero ignora TN y no representa automáticamente los costes operativos. Si no hay alertas, precision tiene denominador cero; el código devuelve cero por convención explícita mediante `zero_division=0`.

<img src="/assets/visuals/ml-series/P093.svg" alt="La matriz de validación conserva ciento treinta y un negativos correctos, cinco falsas alertas, diecisiete retrasos omitidos y veintisiete detectados; precision divide por alertas y recall por retrasos reales." width="835" height="662" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P093.svg).

## El threshold cambia la carga de revisión

Al bajar el **threshold** de 0,5 a 0,2 aparecen **57 alertas**: 37 correctas y veinte falsas. Recall sube a **84,09 %**, mientras precision baja a **64,91 %**. A 0,8 solo emitimos quince alertas, todas correctas en esta muestra, pero omitimos 29 retrasos.

Que no haya falsos positivos en quince alertas no demuestra precision perfecta en la población. Hay que mirar tamaño de muestra e incertidumbre, además de capacidad de revisión.

Para defectos industriales puede interesar priorizar recall de defectos críticos con un límite de falsas alarmas por mil piezas. Para retrasos, quizá la restricción sea cuántos envíos puede revisar una persona al día. La métrica debe incluir esa condición, no maximizar F1 por costumbre.

### Mueve el umbral sin volver a entrenar

Puedes [abrir el laboratorio interactivo de umbrales](/assets/interactive/ml-series/explorer.html). Cambia el threshold y los costes ficticios de FP y FN: la matriz, las métricas y el coste se actualizan con las mismas 180 predicciones de validation. La línea vertical relaciona tu elección con las curvas de precision y recall.

La visualización también ofrece los valores en texto y permite mover el control con el teclado. Explora por qué bajar el umbral puede aumentar recall y el número de revisiones. No utiliza test ni busca automáticamente una configuración ganadora.

## ROC-AUC evalúa ranking, no el umbral que vas a desplegar

La curva **ROC** relaciona recall con la tasa de falsos positivos, $FP/(FP+TN)$, al variar el umbral. **ROC-AUC** resume ese ranking. Puede interpretarse como la probabilidad de ordenar un positivo aleatorio por encima de un negativo, contando empates a medias.

Un AUC alto no asegura pocas falsas alertas en números absolutos cuando hay muchísimos negativos. Tampoco dice si los scores son probabilidades fiables. Una transformación estrictamente creciente conserva el ranking y, por tanto, AUC, pero puede alterar muchísimo la calibración.

La curva **precision–recall** muestra directamente la relación entre las dos cantidades que afectan a las alertas. Su referencia depende de la prevalencia positiva; no conviene comparar valores entre poblaciones distintas sin considerar ese cambio.

<img src="/assets/visuals/ml-series/precision-recall.svg" alt="Curvas precision–recall en los ciento ochenta envíos de validación para logística, Random Forest y boosting; la referencia constante está en la prevalencia de cuarenta y cuatro sobre ciento ochenta." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar las curvas precision–recall](/assets/visuals/ml-series/precision-recall.svg).

## Average precision no es el área trapezoidal de la curva PR

Se utiliza **PR-AUC** para cálculos que no siempre coinciden. El laboratorio informa **average precision**, AP, calculada con `average_precision_score`. Es una suma de precisiones ponderadas por incrementos de recall, no una integración trapezoidal con interpolación lineal.

Archivo: `machine-learning/models.py`, métricas independientes del threshold elegido.

```python
        'roc_auc': float(roc_auc_score(y, probability)),
        'average_precision': float(average_precision_score(y, probability)),
        'brier': float(brier_score_loss(y, probability)),
```

AP de la logística es **0,8457 en validation**. No significa que el 84,57 % de sus alertas a 0,5 sea correcto: esa otra cantidad es precision. Con un score constante, AP coincide aquí con la prevalencia, 44/180.

## Los errores de regresión también necesitan unidades

Para minutos de retraso, **MAE** promedia errores absolutos en minutos; **MSE** promedia cuadrados en minutos cuadrados; **RMSE** vuelve a minutos tomando la raíz de MSE. RMSE sigue dando más peso a errores grandes que MAE.

El test usa valores reales `[0,0]` y predicciones `[3,4]`: MAE=3,5; MSE=12,5; RMSE≈3,5355. No son tres formas de presentar el mismo número ni conviene comparar MSE entre targets con unidades distintas.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p093/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/machine-learning
```

## Garantías y límites

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/machine-learning/models.py) conserva matrices, curvas y scores. No define un coste monetario real ni demuestra utilidad de una intervención. Las funciones de AUC aquí suponen conjuntos binarios con ambas clases; un fold sin positivos necesita tratamiento explícito, no un cero que parezca una medición válida.

## Ejercicio: traducir un coste a una evaluación

Asigna coste uno a FP y diez a FN. Con la matriz a 0,5 el coste ficticio es $5+10\times17=175$. A 0,2 es $20+10\times7=90$. Explica por qué elegirías otro umbral si solo pudieras revisar treinta envíos, aunque el coste calculado favorezca 0,2.

Seguimos con [calibración, explicaciones y errores por grupo](/posts/calibracion-interpretabilidad-equidad-modelos).

## Referencias

- [scikit-learn: métricas de clasificación y regresión](https://scikit-learn.org/stable/modules/model_evaluation.html).
- [scikit-learn: definición de average_precision_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html).
- [scikit-learn: precision_recall_curve](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.precision_recall_curve.html).
