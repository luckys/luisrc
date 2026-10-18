---
id: P092
title: 'Train, validation y test: cómo evaluar el futuro sin entrenar con él'
published: 2026-10-18T01:06:00Z
locale: es
translationKey: ml-temporal-validation
slug: validacion-temporal-cross-validation-seleccion
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P088, P089]
description: 'Holdout, cross validation, estratificación y splits temporales: separar selección de modelos y evaluación final según el escenario de uso.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, evaluacion, cross-validation, series-temporales]
---

Un modelo aprende con envíos de enero y diciembre y se evalúa en otros de marzo. Puede ser una evaluación razonable si queremos completar registros del mismo periodo. No representa lo mismo que entrenar hasta marzo y predecir abril sin haber observado todavía el resto del año.

Un **split** define qué información dejamos disponible para evaluar una predicción. Por eso debe parecerse al uso previsto. Elegirlo solo por comodidad puede cambiar la pregunta sin que cambie una sola línea del modelo.

## Train, validation y test tienen responsabilidades distintas

**Train** sirve para ajustar parámetros y transformaciones. **Validation** sirve para comparar alternativas: features, hiperparámetros, umbrales o familias de modelos. **Test** estima el comportamiento de un procedimiento que ya hemos definido.

Si consultamos test después de cada cambio y conservamos lo que mejora, ese conjunto acaba participando en la selección. No importa que nunca llamemos `fit(test)`: nuestras decisiones también pueden sobreajustarse a sus resultados.

El **holdout** reserva una parte de los datos para evaluar. No hay un porcentaje universalmente correcto. Necesitamos suficientes ejemplos relevantes y una separación que represente nuevas observaciones, no solo un reparto visualmente equilibrado.

En el [laboratorio](/assets/examples/machine-learning-lab.zip), tras limpiar y ordenar, reservamos **540 filas para train, 180 para validation y 180 para test**. El train termina el 23 de junio de 2025; validation va del 24 de junio al 20 de diciembre; test empieza el 21 de diciembre. Las fechas pertenecen al fixture ficticio.

<img src="/assets/visuals/ml-series/P092.svg" alt="Línea temporal: entrenamiento primero, validación después para decisiones exploratorias y test final reservado; dentro del entrenamiento, tres folds de ventana creciente mantienen el pasado antes del futuro." width="556" height="958" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P092.svg).

## Cross validation repite la separación, no crea datos nuevos

En **k-fold cross validation**, cada fold reserva una parte y ajusta con las restantes. Esto permite observar sensibilidad al reparto, siempre que su construcción respete el problema. Los resultados entre folds no son mediciones completamente independientes: comparten parte del entrenamiento.

La **stratification** conserva aproximadamente proporciones de clases. Ayuda a evitar folds sin positivos en clasificación, pero no soluciona dependencia entre registros. Si tenemos varias imágenes de una pieza, repartir imágenes al azar puede poner la misma pieza en train y validation. En ese caso necesitamos separación por grupo.

Para predecir el futuro, **TimeSeriesSplit** utiliza ventanas de entrenamiento crecientes seguidas de ventanas posteriores de evaluación. Cada pipeline se ajusta de nuevo dentro del fold.

Archivo: `machine-learning/experiments.py`, selección de profundidad usando solo train.

```python
    search = GridSearchCV(pipeline('tree'), {'model__max_depth': [1, 3, 6]},
                          scoring='average_precision', cv=TimeSeriesSplit(n_splits=3))
    search.fit(x, y)
```

La búsqueda compara profundidades uno, tres y seis con tres splits temporales dentro de las 540 filas. Sus medias de AP son aproximadamente **0,3899, 0,5713 y 0,5593**; elige profundidad tres. Son resultados internos de selección, no scores finales sobre test ni una garantía de que tres sea la mejor profundidad futura.

## Fechas ordenadas no bastan si las etiquetas llegan más tarde

El fixture supone que el resultado del envío anterior ya se conoce antes de la siguiente predicción. En operaciones reales puede haber etiquetas que tardan días o ventanas que se solapan.

Entonces necesitamos un **gap** o una separación definida por disponibilidad de resultados, no solo por fecha de la fila. También puede haber grupos que atraviesan periodos: un cliente repetido, un lote o una máquina. Hay que decidir si el despliegue recibirá nuevos casos de grupos conocidos o grupos completamente nuevos.

Cuando la información se comparte entre registros, aumentar el número de folds no corrige la fuga. Primero se define la unidad y después cómo separarla.

## Interpolar fechas y extrapolar al futuro no son la misma tarea

El laboratorio incluye una demostración pequeña: 300 instantes consecutivos con target $y=t/10$. Un regresor de tres vecinos usa el tiempo como única entrada.

Con random split, tiene vecinos a ambos lados de muchos instantes evaluados y obtiene **MAE≈0,07185**. Entrenando con los primeros 210 y evaluando en los 90 posteriores, obtiene **MAE=4,65**. Los vecinos no extrapolan la tendencia; predicen a partir de los últimos valores conocidos.

Este resultado fue construido para mostrar el mecanismo. No demuestra que cualquier random split sea optimista ni que todos los modelos fallen igual al extrapolar. Demuestra que una evaluación puede ser correcta para interpolación y equivocada para la pregunta de despliegue que estamos intentando responder.

## Buscar más opciones también aumenta oportunidades de sobreajuste

**Grid search** prueba una cuadrícula; **randomized search** muestrea combinaciones. Ambas necesitan un presupuesto y una métrica definidos. Probar muchas configuraciones y publicar solo la mejor oculta cuánto dependió el resultado de esa búsqueda.

Con pocos datos puede interesar **nested cross validation**: un bucle interno selecciona y otro externo evalúa el procedimiento de selección. No la implementamos aquí. Mantenemos una separación temporal explícita y una comparación final predefinida para que el flujo sea visible.

Después de fijar el procedimiento se puede reentrenar con train y validation antes de evaluar un test todavía reservado. En este laboratorio no lo hacemos: los tres modelos finales se ajustan solo con train, como indica el protocolo. Así no mezclamos cifras de modelos entrenados con cantidades distintas de datos.

## Garantías y límites

Los tests comprueban orden temporal, tamaños y ausencia de IDs compartidos. No pueden decidir si los datos futuros representan el despliegue real. Una única ventana de test tampoco describe toda la variación entre estaciones o cambios operativos.

## Ejercicio: etiquetas con siete días de retraso

Supón que un resultado solo se confirma siete días después de salir. Dibuja qué filas podrían entrar realmente en train al predecir el 1 de julio. No basta con reservar las del propio julio: las últimas de junio tampoco tienen todavía una etiqueta disponible.

Seguimos con [métricas y costes de los errores](/posts/metricas-ml-precision-recall-auc-errores).

## Referencias

- [scikit-learn: cross validation y estrategias de separación](https://scikit-learn.org/stable/modules/cross_validation.html).
- [scikit-learn: búsqueda de hiperparámetros](https://scikit-learn.org/stable/modules/grid_search.html).
- [scikit-learn: TimeSeriesSplit y gap](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html).
