---
id: P086
title: 'Machine Learning empieza por definir qué quieres predecir y cuándo'
published: 2026-10-18T01:00:00Z
locale: es
translationKey: ml-problem-target-prediction
slug: machine-learning-problema-target-prediccion
draft: true
status: draft
math: true
level: intermedio
prerequisites: []
description: 'Clasificación, regresión, ranking y aprendizaje sin etiquetas: elegir la tarea, el target y el instante de predicción antes que el algoritmo.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, ingenieria, prediccion, datos]
---

Un modelo acierta casi todos los retrasos de una empresa de reparto. Después descubrimos que una de sus entradas era la hora real de llegada. El cálculo funciona, pero responde a una pregunta que ya sabíamos contestar cuando recibimos ese dato.

Antes de elegir un algoritmo necesitamos decidir **qué queremos predecir, en qué momento y para tomar qué decisión**. Esa definición será el punto de partida de esta serie, orientada a ingenieros que programan pero todavía no tienen un proceso de trabajo con **Machine Learning**.

## Aprender de ejemplos cambia cómo escribimos la solución

En una regla tradicional fijamos el comportamiento: si un contrato establece una tarifa, la calculamos siguiendo el contrato. No necesitamos aprender la tarifa a partir de facturas anteriores.

En **supervised learning** tenemos ejemplos de entradas y resultados observados. Ajustamos los parámetros de una función para que sus predicciones se aproximen a esos resultados. En notación breve, $\hat y=f_\theta(x)$: $x$ son las entradas, $\theta$ los parámetros aprendidos y $\hat y$ la predicción, no el resultado real $y$.

El ajuste no demuestra que la relación vaya a mantenerse. Si cambian las rutas, los vehículos o el registro de incidencias, también puede cambiar el comportamiento del modelo. Por eso evaluar ejemplos no usados durante el ajuste forma parte del problema, no es un trámite al terminarlo.

Un **baseline** es una solución de referencia. Puede ser una regla, la media histórica o el valor de la semana anterior. Si el modelo añade complejidad sin aportar una mejora relevante frente a ella, todavía no tenemos una buena razón para ponerlo en producción.

## La misma operación permite plantear tareas diferentes

Tomemos un envío antes de su salida. Queremos avisar de un retraso superior a treinta minutos y conocemos distancia, carga, centro de salida y previsión de lluvia.

En **classification**, el target es una categoría: `delayed=1` si acaba superando ese retraso, `0` en caso contrario. Si intentamos estimar cuántos minutos se retrasará, tenemos **regression**. Convertir minutos en una etiqueta pierde información, pero puede encajar mejor con la decisión de emitir un aviso.

En **ranking** importa el orden entre candidatos. Un buscador puede ordenar documentos por consulta y evaluarse con **NDCG@10**, que da más peso a colocar resultados relevantes en las primeras posiciones. No basta con evaluar documentos aislados sin conservar su consulta.

<img src="/assets/visuals/ml-series/P086.svg" alt="Un envío antes de salir aporta distancia, carga, centro y previsión de lluvia; el modelo estima retraso y una política decide si emitir un aviso; el resultado real llega después." width="608" height="934" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P086.svg).

## No tener etiquetas no significa no tener una tarea

En **unsupervised learning** buscamos estructura sin una respuesta etiquetada para cada ejemplo. **Clustering** puede agrupar rutas por patrones parecidos. Eso no demuestra que cada grupo sea una categoría útil para operar: habrá que revisar estabilidad, diferencias y consecuencias de utilizarlo.

**Anomaly detection** identifica observaciones atípicas según alguna referencia. Un sensor fuera de lo habitual puede estar averiado o haber detectado un evento legítimo. La rareza no es una etiqueta de fraude, defecto o peligro. Esta tarea puede abordarse con métodos no supervisados o con ejemplos etiquetados, si existen.

En **self-supervised learning** fabricamos objetivos a partir de los propios datos. Ocultar tokens de un texto y aprender a predecirlos es un ejemplo. No hay una persona etiquetando cada token oculto, pero sí hay un objetivo de entrenamiento. Su pérdida tampoco demuestra por sí sola que la representación sirva para otra tarea.

No implementaremos ese entrenamiento en esta serie de ML clásico. Lo situamos para distinguir de dónde sale la señal de aprendizaje, no para presentar todas estas categorías como compartimentos excluyentes.

## Una ficha de problema evita muchos errores de modelado

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/machine-learning/data.py) incluye diez problemas clasificados en `machine-learning/tasks.json`, con unidad, datos, target y métrica. Uno requiere un experimento causal y otro una regla determinista: decidir no usar ML también es parte del ejercicio.

Archivo: `machine-learning/data.py`, contrato de entradas del ejemplo logístico.

```python
SEED = 20261018
FEATURES = ['distance_km', 'load', 'rain_forecast', 'hub']
```

La lista no contiene `delay_minutes`: ese resultado se conoce al finalizar el envío. Tampoco contiene el identificador de la fila. La previsión meteorológica debe ser la que estaba disponible al salir, no una reconstrucción que incorpore el tiempo observado después.

El fixture tiene novecientos envíos válidos y es **completamente sintético**. Permite probar el procedimiento, no estimar la calidad de una empresa o justificar decisiones sobre personas.

## Predecir un retraso no demuestra cómo evitarlo

Que los envíos con cierta característica sufran más retrasos no demuestra que cambiar esa característica reduzca el retraso. Puede haber otras variables relacionadas con ambas cosas.

Predecir responde a «¿qué resultado cabe esperar dadas estas entradas?». Una pregunta causal es «¿qué cambiaría si interviniéramos?». Para evaluar si enviar un aviso reduce retrasos necesitamos un diseño que permita comparar intervenciones, como un experimento aleatorizado apropiado, no solo un clasificador preciso.

También conviene distinguir predicción de inferencia estadística: estimar un efecto o un parámetro, con sus supuestos e incertidumbre, no es lo mismo que ordenar envíos por riesgo.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p086/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/machine-learning
```

## Garantías y límites

La ficha fija una pregunta verificable, pero no garantiza que existan datos suficientes, permisos para utilizarlos o una intervención útil. Antes de automatizar, habrá que definir quién revisa los errores y qué ocurre si no hay una predicción disponible.

## Ejercicio: diez problemas antes de entrenar

Revisa `tasks.json`. Para cada caso, escribe qué dato no estaría disponible al decidir. En demanda semanal, por ejemplo, las ventas de la semana que intentas predecir no pueden ser una entrada. Si cambias el instante de predicción, revisa también las features permitidas.

Continuamos con [EDA y calidad de datos](/posts/eda-numpy-pandas-calidad-datos). Puedes recuperar antes [probabilidad y Bayes](/posts/probabilidad-bayes-prior-alertas) si necesitas repasar probabilidades condicionadas.

## Referencias

- [Google: introducción a Machine Learning](https://developers.google.com/machine-learning/intro-to-ml).
- [scikit-learn: problemas habituales, incluido data leakage](https://scikit-learn.org/stable/common_pitfalls.html).
