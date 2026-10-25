---
id: "DL-TORCH-LOOP"
title: "Un training loop en PyTorch: qué cambia en zero_grad, backward y step"
published: "2026-10-25T21:03:00Z"
locale: "es"
translationKey: "pytorch-training-dl-torch-loop"
slug: "pytorch-training-loop-zero-grad-backward-step"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-MODULE", "DL-SCHEDULES"]
description: "Cómo implementar un loop propio sin mezclar derivación, actualización y métricas. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Un loop puede ejecutar `backward()` sin que los pesos cambien. También puede actualizar pesos usando gradientes de varios batches por accidente. Para depurarlo hay que distinguir qué estado modifica cada llamada, no memorizar cuatro líneas sin su propósito.

Con [el modelo registrado](/posts/pytorch-nn-module-linear-parametros-logits), completamos el entrenamiento. El loop es propio y pequeño; PyTorch deriva las operaciones, pero no toma las decisiones de orden, métricas o checkpoint por nosotros.

## Zero_grad inicia el cálculo del próximo batch

Los parámetros conservan su campo `.grad` entre llamadas. En este experimento cada batch debe producir un update independiente, así que reiniciamos los gradientes antes de calcularlo.

En `train_until`, dentro de `packages/pytorch-training/pipeline.py`, se ejecuta:

```python
            s.optimizer.zero_grad(set_to_none=True)
            loss = checked_loss(s.model(x), y)
            loss.backward()
```

`set_to_none=True` deja los campos sin tensor de gradiente en lugar de llenarlos de ceros. El backward posterior produce los gradientes para los parámetros que participan. Este modelo usa todos sus parámetros; no estamos estudiando aquí actualizaciones de capas sin trayectoria de gradiente.

Si se buscara gradient accumulation, el reinicio y el step se moverían al límite del batch efectivo, como vimos [en su artículo](/posts/gradient-accumulation-microbatches-media-ponderada). Omitir el reinicio sin definir esa estrategia no es una optimización.

## Backward calcula derivadas y step utiliza su resultado

La loss es una media de BCE desde logits. `backward()` calcula gradientes respecto a las hojas entrenables. Los valores de los parámetros permanecen iguales en ese momento.

Después de registrar el diagnóstico del primer batch, el loop llama:

```python
            s.optimizer.step()
```

Usamos SGD con momentum 0,9 y tasa inicial 0,1. El estado de momentum vive en el optimizador, creado antes del loop. Crear uno nuevo en cada batch borraría esa memoria.

El informe conserva parámetros antes del backward, después y tras el step para el primer batch. Los dos primeros vectores son iguales; el tercero cambia. Es una comprobación directa de la separación entre derivar y actualizar.

<img src="/assets/visuals/pytorch-training/DL-TORCH-LOOP.svg" alt="Cómo implementar un loop propio sin mezclar derivación, actualización y métricas. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="318" height="1008" loading="lazy" style="width:100%;max-width:318px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/DL-TORCH-LOOP.svg).

## Una epoch completa produce nueve updates, no uno

El loader entrega 256 muestras en batches de 30 y una cola de 16. Hay nueve steps por epoch y 540 en las 60 epochs declaradas. Los índices permiten comprobar que no se ha repetido o perdido una muestra dentro de cada recorrido.

El loop activa `model.train()` al empezar cada epoch. Eso prepara el comportamiento de las capas que distinguen modos; no ejecuta el entrenamiento por sí solo.

Al terminar el recorrido avanzamos **StepLR** una vez. Su reloj son epochs completadas: cada 20 multiplica la tasa por 0,5. En epoch 20 registramos `lrUsed=0.1` y `lrNext=0.05`. La primera fue usada en sus batches; la segunda queda preparada para la epoch siguiente.

## La loss online y la loss de checkpoint responden preguntas distintas

Para el registro online acumulamos `loss_media_batch × tamaño_batch` y dividimos por las muestras procesadas. Así el grupo de 16 no pesa lo mismo que uno de 30.

Pero esos batches se evaluaron con pesos diferentes: el modelo cambia después de cada uno. Esa media describe el trabajo durante el recorrido, no la loss train de los pesos finales de la epoch.

Por eso recalculamos también train y validation con pesos fijos en cada checkpoint. La gráfica distingue esas tres series. Confundirlas puede hacer que dos implementaciones correctas parezcan registrar losses incompatibles.

<img src="/assets/interactive/pytorch-training/training-curves.svg" alt="BCE de train a pesos fijos, validation y loss online durante el recorrido para seed7. Son540updates PyTorch reales; la loss online usa parámetros distintos entre batches y no equivale a la evaluación de checkpoint." width="380" height="425" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/pytorch-training/training-curves.svg).

## Qué muestran los tres entrenamientos reales

Las inicializaciones 7, 19 y 31 terminan con validation BCE 0,008309, 0,004985 y 0,008063 después de 540 updates. Las tres alcanzan accuracy 1 en las 128 muestras validation. Son datos sintéticos de cuatro grupos XOR y no se ha evaluado un test final.

No comparamos directamente estas curvas con el loop NumPy de P098: aquí cambian el generador de orden, el batch size y el schedule. Reutilizar el problema no convierte automáticamente dos protocolos en un benchmark comparable.

Las pruebas verifican que los pesos cambian, que los contadores encajan y que la evaluación no los modifica. La reproducción vuelve a entrenar y contrasta las observaciones, no solo que los archivos existan.

## Ejercicio: asigna cada cambio a su llamada

Revisa la traza del primer batch. Indica qué llamada puede cambiar `.grad`, cuál los parámetros y cuál el buffer de momentum. Después explica por qué el checkpoint de epoch 60 tiene una tasa preparada para el siguiente recorrido aunque ya no vaya a ejecutarlo.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [pipeline PyTorch](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/pytorch-training/pipeline.py), los [checkpoints](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/pytorch-training/checkpoints.py), probes y tests. Reutiliza el [generador de datos y modelo NumPy anterior](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py) para contrastar la implementación inicial.

Con Docker y la image CPU fijada en `runtime.json`, desde la raíz del monorepo:

```bash
pnpm --dir packages/pytorch-training test:container
pnpm --dir packages/pytorch-training exercise
pnpm --dir packages/pytorch-training verify
pnpm --dir packages/pytorch-training test
```

Si falta la image, `pnpm --dir packages/pytorch-training runtime:fetch` descarga el digest declarado. No requiere instalar paquetes Python en el host. El experimento crea sus archivos de checkpoint en un directorio temporal propio y verifica su carga antes de eliminarlo.

## Explorar la ejecución registrada

<iframe src="/assets/interactive/pytorch-training/explorer.html" title="Inspeccionar entrenamiento PyTorch, broadcasting y reanudación con datos reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor completo](/assets/interactive/pytorch-training/explorer.html). Selecciona seed y checkpoint para las curvas; la comparación de reanudación corresponde siempre a seed 7. El navegador no entrena ni ejecuta PyTorch.

## Garantías y límites

El protocolo usa 256 muestras train y 128 validation, generadas por separado, con una MLP tanh 2→4→1, BCE media, CPU y float64. No se evalúa test, GPU, workers paralelos o reanudación a mitad de epoch. La MLP entrenada no incluye Dropout; el probe de modos lo usa por separado para comprobar su comportamiento.

Las cifras pertenecen a este dataset sintético y runtime. Los tests y `verify` vuelven a ejecutar el pipeline y el guardado/carga. Reproducir aquí una trayectoria no demuestra generalización en producción ni igualdad entre todas las plataformas.

## Referencias

- [Optimización y orden de los schedulers](https://docs.pytorch.org/docs/2.14/optim.html#how-to-adjust-learning-rate).
- [StepLR](https://docs.pytorch.org/docs/2.14/generated/torch.optim.lr_scheduler.StepLR.html).

Continúa con [train, eval y no_grad: tres decisiones que no hacen lo mismo](/posts/pytorch-train-eval-no-grad-validacion).
