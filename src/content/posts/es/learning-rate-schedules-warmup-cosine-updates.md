---
id: "DL-SCHEDULES"
title: "Learning rate schedules: poner un reloj al tamaño del paso"
published: "2026-10-25T20:05:00Z"
locale: "es"
translationKey: "training-dynamics-dl-schedules"
slug: "learning-rate-schedules-warmup-cosine-updates"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ADAMW"]
description: "Cómo definir el reloj y los extremos de un schedule sin errores de un update. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

Un **learning rate schedule** puede estar bien escrito y avanzar ocho veces más rápido de lo previsto. Basta con pensar en epochs mientras el código lo actualiza por batch. El primer requisito de un schedule es declarar qué hace avanzar su reloj.

Después de [AdamW y la escala del decay](/posts/adamw-weight-decay-regularizacion-l2), mantenemos los datos y el optimizador y cambiamos solo la tasa a lo largo de los updates.

## Un schedule devuelve una tasa para un instante definido

Llamamos u al índice de la actualización que se va a ejecutar, empezando en cero. Con 80 epochs, 256 muestras y batch 32 tenemos T=640 updates, índices 0 a 639.

Una tasa constante devuelve siempre η_base. Un schedule por tramos puede multiplicarla al llegar a hitos; un decaimiento continuo la reduce progresivamente. Un schedule basado en una métrica, como reducir ante un plateau, necesita además definir qué se mide, cuándo y con qué paciencia. No comparten todos el mismo contrato.

Aquí elegimos **warmup** seguido de **cosine decay**, con números declarados antes del entrenamiento. El warmup ocupa 40 updates y la tasa mínima es un décimo de la base. No decidimos sus hitos mirando después dónde se dobla la curva de validation.

## El warmup empieza con una fracción y llega a la tasa base

Para `u < W`, usamos `η(u) = η_base·(u+1)/W`. Con base 0,1 y W=40, el primer step usa 0,0025 y el de índice 39 usa 0,1. Empezar con u en lugar de u+1 daría cero en el primer update; sería otra convención.

Warmup limita los pasos iniciales mientras el estado del entrenamiento se forma. Puede resultar útil, pero no arregla automáticamente una mala inicialización, una loss incorrecta o datos mal escalados.

## El cosine necesita extremos sin ambigüedad

Después calculamos un progreso que va de 0 en u=40 a 1 en u=639. El código completo de la tasa, en `packages/training-dynamics/optimizers.py`, incluye comprobación de rango:

```python
    if update < warmup:
        return base * (update + 1) / warmup
    progress = (update - warmup) / (total - warmup - 1)
    factor = min_factor + (1 - min_factor) * (1 + math.cos(math.pi * progress)) / 2
    return base * factor
```

En progreso cero, cosine vale 1 y usamos la base. En progreso uno, vale −1 y queda el factor mínimo. Los índices 39 y 40 comparten la tasa máxima; es una decisión explícita de esta composición, no un off-by-one oculto.

El último step usa 0,01. El test comprueba estos cuatro puntos y rechaza u=640. No necesitamos confiar en que una gráfica visualmente suave tenga los extremos correctos.

<img src="/assets/visuals/training-dynamics/DL-SCHEDULES.svg" alt="Cómo definir el reloj y los extremos de un schedule sin errores de un update. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="323" height="742" loading="lazy" style="width:100%;max-width:323px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/DL-SCHEDULES.svg).

## La tasa que se muestra debe ser la que se usó

Nuestro loop calcula η antes de cada actualización a partir de u y registra la última tasa realmente usada al cerrar cada epoch. En epoch 0 el campo es `None`: todavía no se ha actualizado nada.

<img src="/assets/interactive/training-dynamics/learning-rates.svg" alt="Última tasa realmente usada al cerrar cada epoch de momentum constante y momentum con warmup y cosine. El eje cuenta actualizaciones completadas. No se inventa una tasa cero antes del primer step." width="380" height="425" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/training-dynamics/learning-rates.svg).

La figura une esas observaciones por epoch, no afirma mostrar todos los steps intermedios. En las APIs de schedulers de PyTorch hay que respetar el contrato de llamada: para los schedulers basados en steps, normalmente `optimizer.step()` precede al avance del scheduler. El código de este laboratorio usa una función explícita en lugar de instanciar esa API; no hay que copiar el orden a ciegas entre ambas interfaces.

Cuando añadimos gradient accumulation, u avanzará por actualización efectiva, no por microbatch. Si se cambia batch size, conservar W=40 mantiene la cantidad de updates de warmup, pero cambia el número de muestras procesadas durante esa fase.

## El schedule probado no mejora la loss final de esta baseline

Momentum con tasa constante 0,1 termina en validation BCE 0,004123 para seed 7. Con warmup y cosine obtiene 0,007410 después de los mismos 640 updates. Ambos clasifican correctamente las 128 muestras validation.

Esto no invalida los schedules. Muestra que este calendario concreto no supera la tasa constante en la métrica y presupuesto elegidos. Reducir la tasa también puede frenar el progreso antes de tiempo. No hemos ajustado un calendario óptimo ni probado múltiples arquitecturas.

Para diagnosticarlo miraría juntas la curva de tasas y la de loss. Si se registra solo «cosine» sin horizonte, warmup o mínimo, falta información esencial para reproducir el run.

## Cambiar el horizonte cambia el experimento

Duplicar las epochs sin actualizar T no extiende correctamente esta función: acabará rechazando el índice fuera de rango. Recalcular T, por otro lado, cambia la tasa que habría correspondido a los updates anteriores. Reanudar o extender un entrenamiento requiere decidir si se continúa el calendario original o se define otro.

En un checkpoint real hay que conservar también el estado o los datos necesarios para reconstruir ese reloj. Guardar solo los pesos no basta para repetir la trayectoria con momentum y una tasa variable.

## Ejercicio: traduce el reloj a muestras

Calcula cuántas muestras se procesan durante los 40 updates de warmup con batch 32 y con batch 16. Después inspecciona en el visor epoch 0, 5 y 80 de la comparación de schedules. Explica por qué una tasa no definida antes del primer update no debería dibujarse como cero.

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

- [Orden y contratos de los schedulers](https://docs.pytorch.org/docs/2.14/optim.html#how-to-adjust-learning-rate).
- [CosineAnnealingLR, una implementación con su propio reloj](https://docs.pytorch.org/docs/2.14/generated/torch.optim.lr_scheduler.CosineAnnealingLR.html).

Continúa con [Gradient accumulation: sumar trabajo pequeño sin cambiar el batch que optimizas](/posts/gradient-accumulation-microbatches-media-ponderada).
