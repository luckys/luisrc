---
id: "DL-BIAS-VARIANCE"
title: "Bias y variance: qué cambia cuando cambia la muestra de entrenamiento"
published: "2026-10-25T22:01:00Z"
locale: "es"
translationKey: "generalization-stability-dl-bias-variance"
slug: "bias-variance-descomposicion-error-muestras"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P100"]
description: "Qué significa la descomposición del error cuadrático y qué puede estimar un experimento finito. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Cambiar la muestra de entrenamiento puede cambiar mucho la predicción, aunque el código y el algoritmo sean los mismos. **Bias** y **variance** sirven para razonar sobre esa variación; no son nombres alternativos para dos números de una única curva.

Después del [diagnóstico de ajuste](/posts/overfitting-underfitting-curvas-error-generalizacion), separamos lo que depende de la familia de estimadores, de las muestras disponibles y del ruido del target.

## La descomposición necesita una pregunta concreta

Supongamos regresión con error cuadrático y `y=f(x)+ε`, donde el ruido tiene media cero y es independiente de la muestra que entrenó el modelo. Para un x fijo, llamamos D a una posible muestra de entrenamiento y `f̂_D(x)` a su predicción.

La predicción media sobre posibles D es m(x). El **bias** es `m(x)−f(x)`: diferencia sistemática de esa media respecto a la señal. La **variance** es el promedio de `(f̂_D(x)−m(x))²`: cuánto cambian las predicciones entre muestras.

Este bias no es el parámetro bias de una capa. Una red puede tener miles de bias entrenables y seguir formando parte de un procedimiento con error sistemático importante.

## Por qué aparecen tres términos

Podemos escribir `f̂_D−y = (f̂_D−m)+(m−f)−ε`. Al elevar al cuadrado y tomar las esperanzas pertinentes, los términos cruzados se anulan bajo los supuestos indicados.

El error esperado queda como **bias² + variance + varianza del ruido**. No se afirma que cualquier loss de clasificación admita sin cambios esta identidad. Tampoco son tres términos que podamos leer directamente de train loss y validation loss de una sola red.

En nuestro generador idealizado, ruido de desviación 0,25 implica varianza 0,0625. Es una contribución al riesgo esperado de un target nuevo, no una cota que toda medición finita de MSE deba respetar.

<img src="/assets/visuals/generalization-stability/DL-BIAS-VARIANCE.svg" alt="Qué significa la descomposición del error cuadrático y qué puede estimar un experimento finito. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="324" height="508" loading="lazy" style="width:100%;max-width:324px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-BIAS-VARIANCE.svg).

## Un experimento separado permite comprobar la aritmética

Para este concepto usamos 32 datasets aleatorios de 24 puntos, sin la contaminación adicional del experimento neuronal. Ajustamos regresores polinómicos de grados 1, 5 y 15 con una penalización ridge fija de 1e-4.

Usamos una base de **Legendre** para construir las features. Sus polinomios son ortogonales bajo una medida uniforme continua en [−1,1]. Eso no convierte nuestra matriz de muestras finitas en una matriz exactamente ortogonal ni evita la sensibilidad cuando hay pocos datos.

En `bias_variance`, dentro de `packages/generalization-stability/probes.py`, las predicciones se agrupan por dataset:

```python
        predictions=np.asarray(predictions);mean=predictions.mean(0)
        bias=(mean-truth)**2;variance=((predictions-mean)**2).mean(0)
```

Promediamos sobre esos 32 ajustes y sobre un grid fijo. Se comprueba que el error cuadrático contra la señal coincide con bias² más variance del conjunto finito de predicciones. El denominador es 32; introducir una corrección de Bessel cambiaría esa identidad empírica.

## Los resultados no dibujan una ley monotónica sencilla

El grado 1 obtiene bias² 0,422488 y variance 0,035295. El grado 5 obtiene 0,110526 y 0,229913. El grado 15 obtiene 0,268004 y 22,082475: aparecen predicciones muy sensibles, especialmente donde la muestra aporta poco apoyo.

<img src="/assets/interactive/generalization-stability/bias-variance.svg" alt="Error contra la señal de32ajustes polinómicos por grado. Las barras apilan bias² yvariance del conjunto finito en escala lineal común. No es un estudio de las tres redes neuronales." width="380" height="440" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/generalization-stability/bias-variance.svg).

Estos valores pertenecen a 32 muestras y a una penalización concreta. La media finita no es la predicción media poblacional exacta. Por eso no usamos el experimento para afirmar que conocemos el bias verdadero de toda la familia.

Tampoco prometemos que aumentar grado reduzca siempre el bias estimado mientras aumenta variance. En este resultado, el grado 15 no sigue esa historia simple. Importan el estimador completo, la regularización, el diseño de las muestras y la incertidumbre de lo que estimamos.

## Tres seeds de pesos responden otra pregunta

Los tres entrenamientos neuronales del laboratorio mantienen el dataset y cambian la inicialización. Esa variación no equivale a volver a muestrear D. Sirve para observar sensibilidad de la optimización, pero no basta para estimar la descomposición anterior.

En proyectos reales rara vez conocemos f. Podemos usar validación, learning curves o remuestreo para estudiar comportamiento, con sus propios límites. La distinción ayuda a no llamar «alto bias» a cualquier entrenamiento que simplemente no ha optimizado bien.

## Ejercicio: identifica qué fuente de variación cambia

Compara estos diseños: repetir una red con distintas seeds sobre el mismo train, repetir con nuevos datasets y repetir solo las predicciones sobre un validation fijo. Explica cuál se acerca a la variable D de esta derivación y qué supuestos faltarían para estimar ruido irreducible en datos reales.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [entrenamiento](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/generalization-stability/training.py), los [probes numéricos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/generalization-stability/probes.py), protocolo, tests y observaciones.

Desde su raíz, con Docker y la image CPU fijada por digest:

```bash
pnpm --dir packages/generalization-stability test:container
pnpm --dir packages/generalization-stability exercise
pnpm --dir packages/generalization-stability verify
pnpm --dir packages/generalization-stability test
```

Si falta el runtime, `pnpm --dir packages/generalization-stability runtime:fetch` lo descarga. No requiere paquetes Python instalados en el host. Verify vuelve a entrenar y recalcula controles; no se limita a comparar hashes.

## Explorar curvas y mecanismos

<iframe src="/assets/interactive/generalization-stability/explorer.html" title="Explorar generalización, normalización, initialization y clipping con observaciones reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor completo](/assets/interactive/generalization-stability/explorer.html). Muestra datos archivados; el navegador no entrena ni ejecuta PyTorch. Distingue el último modelo, el mejor observado y el elegido por la política de parada.

## Garantías y límites

Los 18 entrenamientos usan un mismo dataset contaminado y tres inicializaciones emparejadas. El estudio de bias–variance usa otro diseño sin esa contaminación; los controles de capas y clipping son experimentos separados. No se presenta un único mecanismo como explicación de todos los resultados.

No hay test final, GPU, benchmark de tiempo o recomendación universal. Validation se reutiliza para observar y elegir checkpoints: sus mínimos no son una evaluación independiente del modelo seleccionado.

## Referencias

- [The Elements of Statistical Learning, capítulo 2](https://hastie.su.domains/ElemStatLearn/).

Continúa con [Initialization: cómo llegan activaciones y gradientes a la primera actualización](/posts/initialization-xavier-he-simetria-gradientes).
