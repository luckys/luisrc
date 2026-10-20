---
id: P091
title: 'Clustering: encontrar grupos no significa haber descubierto categorías reales'
published: 2026-10-18T01:05:00Z
locale: es
translationKey: ml-clustering-stability
slug: clustering-kmeans-dbscan-estabilidad
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P087, P088]
description: 'K-means, DBSCAN y clustering jerárquico: comparar geometrías, ruido y estabilidad sin confundir separación matemática con utilidad operativa.'
author: 'Luis Ramírez Calle'
series: 'Machine Learning clásico: de los datos a una evaluación fiable'
tags: [machine-learning, clustering, kmeans, dbscan]
---

Un algoritmo divide las rutas en tres grupos y les asignamos nombres: eficientes, problemáticas y excepcionales. El algoritmo no descubrió esas etiquetas. Nosotros añadimos una interpretación a una partición que depende de las columnas, sus escalas y la definición de cercanía.

**Clustering** sirve para explorar estructura sin una clase correcta proporcionada para cada fila. Su utilidad exige comprobar qué se mantiene al cambiar decisiones razonables y si los grupos ayudan a responder una pregunta concreta.

## K-means busca cercanía a centros, no cualquier forma posible

**K-means** necesita elegir el número de grupos $k$. Alterna asignar cada punto al centro más cercano y recalcular centros como medias. Reduce la suma de distancias euclídeas al cuadrado dentro de los grupos:

$$
\sum_{i=1}^{n}\lVert x_i-\mu_{c_i}\rVert^2.
$$

$c_i$ indica el grupo asignado y $\mu_{c_i}$ su centro. La inicialización puede llevar a soluciones diferentes; `n_init=10` prueba diez inicializaciones y conserva la de menor objetivo dentro de ese ajuste.

El objetivo favorece grupos compactos alrededor de centros. Dos medias lunas entrelazadas pueden quedar cortadas de una forma estable y aun así no coincidir con las dos curvas que distinguimos visualmente. Más inicializaciones no cambian esa preferencia geométrica.

Scaling importa: medir una columna en metros en lugar de kilómetros puede hacer que domine la distancia. Estandarizar tampoco es neutral; da una escala comparable, pero la relevancia de cada variable sigue siendo una decisión del problema.

## DBSCAN busca densidad y permite dejar puntos sin grupo

**DBSCAN** conecta regiones densas según un radio `eps` y un mínimo de vecinos `min_samples`. Puede capturar grupos no convexos y asigna `-1` a puntos tratados como ruido.

No necesita fijar k, pero eso no significa que carezca de decisiones. Un radio pequeño fragmenta regiones; uno grande puede unir grupos distintos. Densidades muy diferentes complican utilizar un único radio global.

Archivo: `machine-learning/models.py`, exploración controlada del radio.

```python
    for eps in [.12, .3, .8]:
        labels = DBSCAN(eps=eps, min_samples=5).fit_predict(x)
        mask = labels != -1
        clusters = len(set(labels[mask]))
```

El [laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/machine-learning/models.py) genera **240 puntos sintéticos** en dos medias lunas, estandariza coordenadas y mantiene constantes los demás parámetros.

La tabla excluye el ruido al contar grupos y calcular silhouette; la columna «Ruido» cuenta los puntos excluidos.

| eps  | Grupos | Ruido |  Silhouette |
| ---- | -----: | ----: | ----------: |
| 0,12 |     17 |   116 |      0,6404 |
| 0,30 |      2 |     1 |      0,3827 |
| 0,80 |      1 |     0 | No definida |

Elegir el radio con mayor silhouette favorecería aquí una fragmentación de diecisiete grupos que descarta casi la mitad de los puntos. Por eso declaramos **cuántas filas intervienen en la métrica** y por qué han quedado fuera las demás.

<img src="/assets/visuals/ml-series/P091.svg" alt="Las mismas coordenadas estandarizadas se entregan a K-means, DBSCAN y clustering jerárquico; los resultados se revisan por geometría, ruido, estabilidad y utilidad, no por el nombre de una etiqueta." width="696" height="982" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/ml-series/P091.svg).

## Silhouette y estabilidad responden a preguntas diferentes

**Silhouette** compara cercanía dentro del grupo y separación respecto a otros. Un valor alto favorece la geometría evaluada, no demuestra que hayamos encontrado categorías reales.

**Adjusted Rand Index**, o **ARI**, compara particiones sin exigir que compartan los números de sus etiquetas. Que un algoritmo llame grupo cero a lo que otro llama uno no constituye una discrepancia. ARI corrige acuerdo esperado por azar; puede ser negativo.

En estas medias lunas, dos ejecuciones de K-means con semillas distintas tienen **ARI=1** entre sí: obtienen la misma partición. Sin embargo, su ARI respecto a las etiquetas del generador es aproximadamente **0,4762**. Ser estable no equivale a recuperar la estructura que buscábamos.

<img src="/assets/visuals/ml-series/clustering.svg" alt="Dispersión de las dos medias lunas sintéticas coloreadas según K-means; sus grupos cortan la geometría de las curvas en lugar de seguirlas completamente." width="900" height="660" loading="lazy" style="width:100%;height:auto" />

[Ampliar la dispersión](/assets/visuals/ml-series/clustering.svg).

En datos reales no solemos disponer de las etiquetas del generador. Habría que añadir remuestreo, cambios de features y revisión de casos. Dos semillas son una comprobación limitada, no un estudio de estabilidad completo.

## Un dendrograma también incorpora una definición de cercanía

El **hierarchical clustering** aglomerativo parte de observaciones individuales y fusiona grupos. El **linkage** define cómo medir distancia entre grupos: single usa el par más cercano; complete, el más lejano; Ward busca limitar el aumento de variación interna.

El experimento usa single linkage y corta en dos grupos. Recupera las etiquetas sintéticas con ARI=1, pero ese resultado depende de la geometría y del ruido elegidos. Single linkage puede unir regiones mediante cadenas de puntos; no es una solución universal.

**PCA** reduce dimensiones buscando varianza, no grupos. La primera componente conserva aquí aproximadamente 72,73 % de varianza; eso no garantiza conservar separación. Puede revisarse [la explicación de PCA](/posts/transformaciones-lineales-pca-perdida-informacion) antes de usarla como preparación.

## Una anomalía no tiene por qué ser un grupo pequeño

**Isolation Forest** aísla puntos mediante particiones aleatorias y puede marcar observaciones inusuales sin construir clusters. El laboratorio marca dos puntos muy alejados como anomalías, pero no mide detección de incidentes: no hemos creado una población representativa de fallos ni elegido un presupuesto de alertas real.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p091/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/machine-learning
```

## Garantías y límites

Los números describen una geometría sintética conocida. No justifican asignar categorías de personas, riesgo o rendimiento operativo. Ni las etiquetas de clustering ni el valor `-1` explican por qué existe una observación.

## Ejercicio: la escala cambia los vecinos

Multiplica una coordenada por cien y repite sin estandarizar. Compara las particiones con ARI y dibuja los puntos. Después restablece el scaling y explica qué relación de cercanía has decidido conservar.

Continuamos con [selección y evaluación temporal](/posts/validacion-temporal-cross-validation-seleccion).

## Referencias

- [scikit-learn: clustering, algoritmos y evaluación](https://scikit-learn.org/stable/modules/clustering.html).
- [scikit-learn: detección de anomalías y novedad](https://scikit-learn.org/stable/modules/outlier_detection.html).
- [scikit-learn: silhouette_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html).
