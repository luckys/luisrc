---
id: "P100"
title: "Overfitting y underfitting: interpretar las curvas antes de cambiar la red"
published: "2026-10-25T22:00:00Z"
locale: "es"
translationKey: "generalization-stability-p100"
slug: "overfitting-underfitting-curvas-error-generalizacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-RESUME", "P082"]
description: "Cómo distinguir ajuste, memorización e inestabilidad sin diagnosticar por una sola loss. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

La loss de entrenamiento sigue bajando mientras validation empeora. El programa no tiene por qué estar roto: puede estar ajustándose cada vez mejor a detalles de las muestras que no se repiten fuera de ellas.

Después de [verificar el pipeline y sus checkpoints](/posts/pytorch-reanudar-checkpoint-optimizador-scheduler-rng), cambiamos de problema para estudiar **generalización**. El XOR sencillo anterior no bastaba para provocar este fenómeno de forma clara.

## Ajustar los datos observados y generalizar son objetivos relacionados

El entrenamiento minimiza una pérdida sobre un conjunto disponible. Queremos que ese ajuste resulte útil en otras muestras pertinentes, pero el optimizador no observa por sí mismo esa utilidad futura.

Hablamos de **overfitting** cuando el ajuste recoge particularidades de train que perjudican el comportamiento fuera de ese conjunto. **Underfitting** describe un ajuste insuficiente para la estructura que queremos representar. Ni uno ni otro se identifica con un umbral universal de loss.

Una pérdida train alta puede deberse a capacidad insuficiente, optimización deficiente, una mala escala de datos o una definición equivocada del objetivo. Antes de agrandar la red conviene distinguir esas causas.

## El nuevo experimento permite memorizar observaciones poco fiables

Usamos regresión: x es un escalar entre −1 y 1 y la señal conocida es `sin(2πx)`. Train contiene 24 posiciones equiespaciadas con ruido gaussiano de desviación 0,25. Además desplazamos deliberadamente el target de índice 8 en +1,25.

La contaminación solo afecta a train y está declarada antes de entrenar. En `packages/generalization-stability/training.py`:

```python
    y = original.copy()
    y[config['outlierIndex']] += config['outlierShift']
```

Validation tiene 256 posiciones aleatorias independientes y ruido del mismo nivel, sin ese desplazamiento adicional. El objetivo es mostrar cómo se memoriza una observación contaminada; no estamos simulando dos muestras perfectamente intercambiables de una población limpia.

La red tiene dos capas ocultas ReLU de 64 unidades, 4353 parámetros y salida continua. Usamos **MSE**, no la BCE de clasificación anterior. Cada epoch hace un update full-batch con AdamW, tasa 0,01 y decay cero en la baseline.

## Las curvas deben usar métricas comparables

Cada diez epochs evaluamos train y validation con los mismos pesos, modo eval y sin autograd. La función `checkpoint` calcula:

```python
        train = float((model(data['x'])-data['y']).square().mean())
        validation = float((model(data['vx'])-data['vy']).square().mean())
```

En seed 7, el mejor checkpoint validation observado está en epoch 430, con MSE 0,196041. Al llegar a 2000, la MSE train es 0,006492 y validation, 0,204701. Desde aquel checkpoint, train mejora y validation empeora.

<img src="/assets/visuals/generalization-stability/P100.svg" alt="Cómo distinguir ajuste, memorización e inestabilidad sin diagnosticar por una sola loss. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="288" height="508" loading="lazy" style="width:100%;max-width:288px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/P100.svg).

<img src="/assets/interactive/generalization-stability/overfit-curves.svg" alt="Train y validation MSE en modo eval para baseline seed7. Train termina más bajo que en el mejor checkpoint de validation,pero validation final empeora. Son2000updates reales,con monitorización cada10." width="380" height="440" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/generalization-stability/overfit-curves.svg).

Las otras dos inicializaciones muestran también menor error train al final y mayor error validation que en su mejor checkpoint observado. Publicar las tres evita apoyar la explicación únicamente en la curva más cómoda.

<img src="/assets/interactive/generalization-stability/overfit-functions.svg" alt="Señal conocida,predicción final de baseline seed7 y24targets train. El punto alterado se marca en rojo. El dibujo usa observaciones archivadas yno utiliza la señal conocida para elegir el checkpoint." width="380" height="440" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/generalization-stability/overfit-functions.svg).

## Una baseline sencilla ayuda a formular el diagnóstico

Calculamos también la mejor recta por mínimos cuadrados sobre estas muestras. Obtiene train MSE 0,365053 y validation MSE 0,495312. No es una red que se haya detenido antes de converger: es la solución empírica de esa familia lineal.

La señal sinusoidal no cabe bien en una recta. Esta referencia ilustra una limitación de representación, pero no permite concluir que cualquier red con error alto tenga la misma causa.

Tampoco basta una brecha train/validation para atribuir todo a sobreajuste. Un cambio de distribución, errores de etiquetas o una evaluación hecha en otro modo pueden producir diferencias. Aquí conocemos la contaminación y conservamos el protocolo para hacer comprobable la interpretación.

## Corregir requiere cambiar una decisión y observar su efecto

Comparamos dropout, weight decay, BatchNorm, LayerNorm y early stopping con las mismas muestras y pesos lineales iniciales. Las normalizaciones añaden parámetros y cambian el modelo; no fingimos que todas las intervenciones preservan la arquitectura exacta.

En seed 7, early stopping restaura la epoch 430 y obtiene validation 0,196041 frente a 0,204701 del final continuo. En seed 19, la misma política se detiene prematuramente y termina peor. Las decisiones siguientes merecen artículos propios precisamente porque no son remedios automáticos.

**Divergencia** es otra situación: pérdidas o magnitudes que crecen sin control durante la optimización. Una red puede sobreajustar con números finitos y gradientes razonables. Clipping y regularización responden a problemas diferentes.

## Ejercicio: formula una hipótesis que pueda salir mal

Selecciona seed 19 en el visor y compara el checkpoint elegido por la política de parada con el final continuo. Explica qué dato demuestra parada prematura. Después enumera qué revisarías antes de interpretar una brecha train/validation en un dataset cuya distribución no conoces.

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

- [Recomendaciones prácticas de entrenamiento](https://arxiv.org/abs/1206.5533).

Continúa con [Bias y variance: qué cambia cuando cambia la muestra de entrenamiento](/posts/bias-variance-descomposicion-error-muestras).
