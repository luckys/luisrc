---
id: P088
title: 'Preprocesamiento sin data leakage: por qué dividir antes de ajustar'
published: 2026-10-18T01:02:00Z
locale: es
translationKey: ml-preprocessing-leakage
slug: preprocesamiento-pipelines-data-leakage
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P087]
description: 'Imputación, scaling y encoding ajustados solo con train: entender fit, transform y los límites de un Pipeline frente al data leakage.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, pipelines, python, data-leakage]
---

Dividimos los datos en train y test, pero antes habíamos rellenado los nulos con la mediana de todo el fichero. El modelo no ha visto directamente las etiquetas de test, aunque una parte de su preparación ya depende de los ejemplos que pretendíamos reservar.

El **data leakage** aparece cuando usamos información que no debería estar disponible al construir o evaluar una predicción. Puede entrar por el target, por una columna aparentemente inocente o por el momento en que ajustamos una transformación.

## Fit aprende una transformación; transform aplica lo aprendido

Un **StandardScaler** aprende una media y una escala para cada columna. Después transforma un valor con $z=(x-\mu)/\sigma$. En scikit-learn, la varianza empleada por este scaler tiene denominador $n$.

`fit(train)` calcula esas estadísticas. `transform(validation)` las aplica sin volver a estimarlas. Si ajustamos por separado sobre cada conjunto, el mismo valor puede terminar representado de formas distintas. Si ajustamos sobre todos, incorporamos información del conjunto reservado.

Archivo: `machine-learning/models.py`, experimento mínimo de scaling.

```python
    train = np.array([[1.], [2.], [3.]])
    held_out = np.array([[100.]])
    correct = StandardScaler().fit(train)
    leaked = StandardScaler().fit(np.vstack([train, held_out]))
```

La media correcta de train es **2**. Al incorporar el valor reservado pasa a **26,5**. Ese valor 100 se transforma aproximadamente en **120,025** con el scaler de train y **1,732** con el global. La segunda representación es menos extrema precisamente porque ya hemos utilizado ese ejemplo para definir la escala.

Esto demuestra contaminación de estadísticas, no una mejora garantizada de accuracy. Dependiendo del modelo y la transformación, el efecto sobre una métrica puede ser pequeño, grande o incluso desfavorable. El problema es que la evaluación deja de representar el procedimiento declarado.

## Un ColumnTransformer prepara columnas distintas de formas distintas

En el [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/machine-learning/models.py), las columnas numéricas usan **median imputation** y scaling. La categoría `hub` utiliza **one-hot encoding**: una columna indicadora por categoría conocida durante el ajuste.

`handle_unknown='ignore'` permite transformar un centro no visto sin lanzar un error: todas sus columnas de categoría quedan a cero. Eso no implica que el modelo sepa predecir bien para ese centro. En producción también interesa detectar y observar esa situación.

No escalamos categorías como si urban fuese menor que rural. Tampoco imputamos una ausencia con una cifra que parezca válida sin documentarlo. En otros datasets pueden tener sentido una categoría explícita de desconocido o indicadores de ausencia; habrá que justificarlos con la captura real de datos.

<img src="/assets/visuals/ml-series/P088.svg" alt="El train de cada fold ajusta imputación, scaling, encoding y modelo; validation atraviesa las transformaciones ya ajustadas sin participar en fit." width="639" height="958" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P088.svg).

El **Pipeline** encadena preparación y estimador. Al pasarlo completo a cross validation, cada fold vuelve a ajustar sus transformaciones usando solo su parte de train. Pasar al evaluador un array que ya habíamos transformado globalmente no ofrece esa protección.

## Feature engineering también tiene un instante de disponibilidad

Una transformación fija como convertir kilómetros en metros no aprende nada del dataset. En cambio, elegir variables por su correlación con el target sí utiliza datos y debe ocurrir dentro del entrenamiento de cada fold.

Con **target encoding**, una categoría se representa mediante estadísticas del target. Calcularlas con todas las etiquetas filtra la respuesta. Incluso dentro de train conviene un procedimiento out-of-fold que evite que cada fila contribuya directamente a su propia representación. Aquí usamos one-hot y no implementamos target encoding.

Una media histórica por centro puede ser válida si usa únicamente envíos cuyos resultados ya se conocían al emitir esa predicción. Agrupar todo el historial por centro y desplazar la columna después no basta si la consulta ya incorporó resultados futuros.

El pipeline tampoco arregla una feature como `delay_minutes`: si se la entregamos, la procesará obedientemente. Debemos mantener una lista de entradas permitidas y revisar cómo se construyen fuera del código del modelo.

## Transformar outliers requiere conocer su origen

Un **outlier** puede ser un error o una operación infrecuente pero legítima. En el fixture rechazamos distancias negativas porque incumplen un contrato conocido. No recortamos automáticamente las distancias grandes.

Si elegimos límites de clipping mediante cuantiles, esos límites deben aprenderse en train. Lo mismo ocurre con imputación, PCA o selección de variables. Transformaciones como `log1p` pueden reducir asimetría en variables no negativas, pero cambian la interpretación y necesitan tratar correctamente ceros, negativos y unidades.

Scaling facilita regularización comparable en modelos lineales y afecta a distancias en clustering. Los árboles no suelen necesitarlo porque sus cortes dependen del orden de los valores. Lo conservamos en un pipeline común para simplificar la comparación, no porque mejore necesariamente sus predicciones.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p088/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/machine-learning
```

## Garantías y límites

Los tests verifican que el scaler contiene la media de train tras imputar y que admite nulos y categorías nuevas al predecir. No certifican ausencia de leakage en una consulta SQL, ventanas temporales mal definidas o etiquetas revisadas después con información adicional.

## Ejercicio: localizar tres tipos de fuga

Clasifica estos fallos: imputar antes del split, incluir la llegada real y calcular la tasa histórica con envíos todavía no finalizados. Corrige cada uno indicando qué componente cambia. Solo el primero se resuelve automáticamente al mover el transformador dentro del Pipeline.

Seguimos con [qué aprenden la regresión lineal y la logística](/posts/regresion-lineal-logistica-perdidas-regularizacion).

## Referencias

- [scikit-learn: pipelines y transformadores compuestos](https://scikit-learn.org/stable/modules/compose.html).
- [scikit-learn: scaling, encoding y otras transformaciones](https://scikit-learn.org/stable/modules/preprocessing.html).
- [scikit-learn: ejemplos de data leakage](https://scikit-learn.org/stable/common_pitfalls.html).
