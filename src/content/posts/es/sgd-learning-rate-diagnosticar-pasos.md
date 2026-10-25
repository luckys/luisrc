---
id: "DL-SGD"
title: "SGD y learning rate: por qué un gradiente correcto puede dar un mal paso"
published: "2026-10-25T20:01:00Z"
locale: "es"
translationKey: "training-dynamics-dl-sgd"
slug: "sgd-learning-rate-diagnosticar-pasos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P098"]
description: "Cómo interpretar el signo, la escala y la estabilidad de una actualización SGD. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

El gradiente puede estar bien calculado y, aun así, el siguiente paso aumentar la loss. **SGD** necesita algo que el backward no decide: cuánto desplazarse en la dirección que propone la derivada.

Con [batches y presupuestos ya separados](/posts/epochs-batches-minibatches-comparar-entrenamientos), podemos estudiar la actualización sin atribuir todos los problemas al tamaño del grupo.

## SGD resta una dirección local, no conoce el mínimo

**SGD** abrevia **stochastic gradient descent**. La parte estocástica viene de estimar el gradiente con muestras aleatorias: el optimizador no elige esas muestras por sí mismo. Si el loop le entrega todo el conjunto, la misma regla de actualización se convierte en gradient descent full-batch. Por eso el run `sgd-full` conserva el nombre de la implementación, aunque no use un gradiente de un subconjunto aleatorio.

Llamemos θ al vector de parámetros y g al gradiente medio del batch. La regla básica es `θ_nuevo = θ − ηg`, donde η es el **learning rate**. Un g positivo indica que aumentar esa coordenada incrementa localmente la loss; restarlo propone el sentido opuesto.

La justificación viene de aproximar la función cerca de θ: `L(θ + Δ) ≈ L(θ) + gᵀΔ`. Si elegimos `Δ = −ηg`, el cambio aproximado es `−η‖g‖²`. Para un gradiente no nulo y η positivo, esa aproximación es negativa.

La palabra importante es «cerca». La aproximación omite curvatura y otros términos. Un desplazamiento demasiado grande puede salir de la región donde describe bien la función. Además, el g del minibatch no tiene por qué ser una dirección de descenso de toda la loss train.

En `Optimizer.step`, dentro de `packages/training-dynamics/optimizers.py`, SGD sin decay toma:

```python
            if self.kind == 'sgd':
                direction = g
```

Y la actualización común termina con:

```python
            result.append(base - lr * direction)
```

En este caso `base` es el parámetro anterior. Con θ=2, g=4 y η=0,1 obtenemos 1,6. Un test verifica signo y valor, y comprueba que el array original no cambia: así no mezclamos el estado anterior con el resultado al depurar.

<img src="/assets/visuals/training-dynamics/DL-SGD.svg" alt="Cómo interpretar el signo, la escala y la estabilidad de una actualización SGD. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="227" height="1008" loading="lazy" style="width:100%;max-width:227px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/DL-SGD.svg).

## Una parábola permite ver el límite del tamaño del paso

Considera `L(θ) = 5θ²`, cuya derivada es 10θ. La actualización se reduce a `θ_nuevo = (1−10η)θ`. Aquí podemos razonar sobre estabilidad sin depender de un entrenamiento complejo.

Si `0 < η < 0,2`, el valor absoluto del factor es menor que uno y las iteraciones se acercan a cero. Con η=0,1, esta parábola concreta llega a cero en un paso. Con η=0,21, el factor es −1,1: el signo alterna y la distancia al mínimo crece. En η=0,2 alternaría sin acercarse.

El informe conserva 21 puntos para tasas 0,001, 0,1 y 0,21 desde θ=1. Esto explica un mecanismo de inestabilidad; no ofrece un umbral para una red neuronal. En varias dimensiones importan las distintas curvaturas y, en una red, también cambian a lo largo del recorrido.

## Una tasa pequeña puede parecer un fallo del modelo

En la MLP XOR del laboratorio, SGD con seed 7 y 640 updates termina con validation BCE 0,697263 usando tasa 0,001. Con tasa 0,1 obtiene 0,054380; con tasa 1 obtiene 0,004212. Son los mismos datos, orden y pesos iniciales.

La tasa grande de esta ablation funciona mejor dentro de ese presupuesto. Sería incorrecto inventar una divergencia para ilustrar la regla de «tasa grande». La inestabilidad se demuestra por separado en la parábola, donde conocemos la función exacta.

Tampoco basta con observar que 0,001 termina peor para descartar SGD o la arquitectura. Puede necesitar más updates o una configuración distinta. La observación justifica revisar la escala del paso antes de cambiar de modelo.

## Mean y sum cambian el significado numérico de la tasa

Con batch size 32, sustituir una loss media por su suma multiplica el gradiente de datos por 32 a parámetros fijos. Mantener η=0,1 ya no produce la misma actualización.

En SGD simple, dividir η por 32 compensaría ese cambio concreto. Con momentum, schedules, clipping o métodos adaptativos hay más estado y escalas que revisar. Por eso el informe declara BCE media y no presenta learning rate como un número interpretable fuera del loop que lo usa.

## Diagnosticar la curva requiere saber qué se ha medido

Cada checkpoint del laboratorio incluye train loss, validation loss, accuracy y las normas del gradiente y del desplazamiento del último update. Estas dos normas son diagnósticos de ese step, no medias de toda la epoch. Una actualización pequeña puede deberse a un gradiente pequeño o a una tasa pequeña; no prueba que se haya encontrado un buen mínimo.

Antes de aumentar η revisaría valores no finitos, reducción de la loss, escala de entradas y si los pesos realmente cambian. Después compararía varias tasas con el mismo presupuesto. Una loss train descendente tampoco garantiza generalización: podemos estar aprendiendo propiedades que no se mantienen fuera de los datos de entrenamiento.

## Ejercicio: diferencia estabilidad y velocidad de progreso

En el visor elige la comparación de tasas. Inspecciona epoch 0, 10 y 80. Explica qué evidencia permite decir que el run lento progresa poco y cuál faltaría para afirmar que nunca convergerá. Calcula además las cinco primeras iteraciones de la parábola con η=0,21 y contrástalas con `comparison.json`.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [laboratorio del monorepo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/training-dynamics) incluye [optimizadores](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/training-dynamics/optimizers.py), [loop y partición de batches](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/training-dynamics/training.py), protocolo y observaciones. Reutiliza el [modelo NumPy de la serie anterior](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py), sin reemplazar sus resultados originales.

Desde la raíz del repositorio de ejemplos, con Docker y la image CPU fijada en `runtime.json`:

```bash
pnpm --dir packages/training-dynamics test:container
pnpm --dir packages/training-dynamics exercise
pnpm --dir packages/training-dynamics verify
pnpm --dir packages/training-dynamics test
```

Si la image no está preparada, `pnpm --dir packages/training-dynamics runtime:fetch` descarga el digest declarado. No hace falta instalar paquetes Python en el equipo. `verify` vuelve a entrenar y recalcula controles; no se limita a revisar hashes.

## Explorar las curvas observadas

<iframe src="/assets/interactive/training-dynamics/explorer.html" title="Comparar entrenamientos, presupuestos y acumulación con observaciones reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor en una página completa](/assets/interactive/training-dynamics/explorer.html). Las tablas conservan los números de cada checkpoint. Las ablations usan seed 7; la comparación principal permite elegir tres inicializaciones.

## Garantías y límites

Trabajamos con 256 puntos train y 128 validation, generados por separado alrededor de cuatro centros XOR, sin test evaluado. Las curvas se entrenan con **NumPy** en float64. Las reglas de actualización se contrastan con **PyTorch** CPU en tests de varios pasos y gradientes controlados. No hay benchmark de tiempo, medidas de memoria ni evidencia para elegir un optimizador en cualquier tarea.

El informe fija datos, orden, inicializaciones y configuración; publica también resultados que no mejoran la baseline. Las tolerancias numéricas permiten pequeñas diferencias de redondeo. Una curva descendente en este juguete no demuestra calibración, robustez o rendimiento en producción.

## Referencias

- [Deep Learning: métodos de optimización](https://www.deeplearningbook.org/contents/optimization.html).
- [Referencia de SGD](https://docs.pytorch.org/docs/2.14/generated/torch.optim.SGD.html).

Continúa con [Momentum: qué recuerda el optimizador entre dos batches](/posts/momentum-gradientes-estado-optimizador).
