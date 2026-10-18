---
id: P087
title: 'EDA con NumPy y pandas: qué revisar antes de entrenar un modelo'
published: 2026-10-18T01:01:00Z
locale: es
translationKey: ml-eda-numpy-pandas
slug: eda-numpy-pandas-calidad-datos
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P086]
description: 'Explorar un dataset logístico: tipos, nulos, duplicados, distribuciones y correlaciones sin convertir test en una herramienta de diseño.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, python, numpy, pandas, datos]
---

El CSV carga sin errores y todas las columnas tienen un nombre razonable. Eso no impide que contenga envíos duplicados, distancias negativas y datos ausentes. Si entrenamos directamente, el modelo aprenderá sobre esa representación, aunque no describa lo que creemos estar midiendo.

La **exploratory data analysis**, o **EDA**, sirve para entender las observaciones antes de elegir transformaciones y modelos. No consiste en producir muchas gráficas, sino en descubrir qué preguntas debemos hacerle al dataset.

## NumPy calcula sobre arrays; pandas añade columnas e índices

**NumPy** trabaja con arrays multidimensionales y operaciones numéricas vectorizadas. En ML es habitual una matriz de shape `(n_samples, n_features)`: una fila por observación y una columna por entrada.

**pandas** ofrece un **DataFrame** con columnas nombradas que pueden tener tipos distintos. En el laboratorio, distancia es una medida continua en kilómetros, lluvia prevista es binaria y `hub` es una categoría. `shipment_id` contiene números, pero representa una identidad, no una magnitud con la que tenga sentido calcular una media.

El tipo técnico no decide el significado. Una columna de códigos postales almacenada como entero no se convierte por eso en una escala de distancias. Escribir esta interpretación evita que una conversión automática introduzca relaciones inexistentes.

Los índices de pandas también importan: algunas operaciones alinean por etiqueta, no por posición. Si filtramos un DataFrame y mezclamos sus columnas con un array sin comprobar el orden, podemos asociar una entrada al target de otra fila.

## Primero auditamos el fichero; después delimitamos qué explorar

El [laboratorio](/assets/examples/machine-learning-lab.zip) trae `data/logistics-v1.csv`: **909 filas**, seis repeticiones de IDs y tres filas extra con distancia negativa. La limpieza documentada deja **900 envíos distintos**. Conservamos diez distancias y cinco cargas ausentes para tratarlas después dentro del entrenamiento.

Archivo: `machine-learning/data.py`, política de limpieza del fixture.

```python
def clean(raw: pd.DataFrame) -> pd.DataFrame:
    # En este fixture, mismo ID implica la misma fila, no otra observación.
    frame = raw.drop_duplicates('shipment_id').copy()
    valid = frame.distance_km.isna() | (frame.distance_km > 0)
    return frame.loc[valid].sort_values('departure').reset_index(drop=True)
```

Eliminar duplicados por ID es correcto aquí porque las filas repetidas son copias. En un sistema real, el mismo ID podría aparecer en varios eventos legítimos o tener versiones contradictorias. Habría que resolver qué constituye una observación y cuál es el registro válido, no conservar automáticamente «el primero».

Las comprobaciones estructurales del fichero completo se limitan a un contrato predefinido. La EDA que guía decisiones de modelado utiliza los **540 registros de train**, sin estudiar relaciones entre features y target en test. Consultar test repetidamente para decidir cómo limpiar o transformar también influye en el modelo final.

## Un dato ausente necesita una explicación antes que un reemplazo

Un **missing value** no es necesariamente cero. Una distancia no registrada no significa que el envío recorriera cero kilómetros. pandas permite detectarla con `isna()`, pero no puede descubrir por sí solo por qué falta.

Conviene medir cuánto falta, en qué periodos y en qué grupos. Si un centro antiguo no registra la carga, imputar una mediana puede esconder una diferencia en el proceso de captura. Y si eliminamos todas sus filas, la evaluación dejará de representar ese centro.

En el fixture introducimos nulos deliberadamente para probar el pipeline. No afirmamos haber identificado un mecanismo real de ausencia. La imputación del siguiente artículo se ajustará solo con train y conservará la misma transformación al predecir.

<img src="/assets/visuals/ml-series/P087.svg" alt="El CSV pasa por comprobaciones de identidad y dominio; después se separa por fecha en entrenamiento, validación y test, reservando la exploración de relaciones para entrenamiento." width="618" height="1128" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P087.svg).

## La distribución muestra lo que un resumen no puede contar

En train, la mediana de distancia es **315,39 km** y los cuantiles 5 % y 95 % son aproximadamente **45,61 y 573,76 km**. El histograma conserva también el número de observaciones por intervalo. Son datos generados artificialmente, no una distribución logística observada.

<img src="/assets/visuals/ml-series/distance-histogram.svg" alt="Histograma de las quinientas treinta distancias disponibles en train, con intervalos de cien kilómetros y conteos entre setenta y siete y noventa y ocho en los intervalos ocupados." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar el histograma](/assets/visuals/ml-series/distance-histogram.svg).

Un **histogram** depende de sus intervalos: cambiar el ancho puede esconder o sugerir agrupaciones. Una distribución acumulada o varios cuantiles ayudan a contrastar la lectura. También hay que conservar unidades y distinguir un valor extremo válido de un error de captura.

La clase positiva ocupa **112 de 540 envíos**, aproximadamente **20,74 %**. Una predicción constante de «no se retrasa» acertaría cerca del 79,26 % en ese conjunto. Esa cifra ya nos avisa de que accuracy no bastará para evaluar las alertas.

## Correlación describe una relación, no una intervención

La correlación de Pearson entre distancia y retraso en train es aproximadamente **0,4124**, calculada sobre los pares disponibles. Resume asociación lineal, no toda dependencia posible. Una relación curva puede tener correlación pequeña y seguir siendo predecible.

Tampoco demuestra que aumentar la distancia sea la causa del retraso. En datos reales podrían intervenir tipo de ruta, tráfico o selección de envíos. En estos datos sabemos cómo se generaron porque el mecanismo está en `data.py`; esa ventaja no existe automáticamente en un CSV de producción.

## Garantías y límites

El informe de calidad conserva conteos, unidades, tratamiento de duplicados y alcance de la EDA. No demuestra representatividad, ausencia de sesgo de selección o corrección de etiquetas. Un dataset limpio puede seguir sin incluir los casos donde el sistema más falla.

## Ejercicio: una limpieza que cambia la población

Compara cuántas filas perderías eliminando cualquier nulo frente a mantenerlas para imputar. Identifica si se concentran al principio de la serie temporal. Explica por qué, en datos reales, esa concentración podría afectar a lo que el modelo aprende sobre cambios en el tiempo.

Seguimos con [preprocesamiento dentro de pipelines](/posts/preprocesamiento-pipelines-data-leakage).

## Referencias

- [NumPy: arrays, shapes y operaciones básicas](https://numpy.org/doc/stable/user/absolute_beginners.html).
- [pandas: tratamiento de datos ausentes](https://pandas.pydata.org/docs/user_guide/missing_data.html).
- [pandas: correlación entre columnas](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.corr.html).
