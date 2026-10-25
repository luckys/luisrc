---
id: "DL-EVALUATION"
title: "train, eval y no_grad: tres decisiones que no hacen lo mismo"
published: "2026-10-25T21:04:00Z"
locale: "es"
translationKey: "pytorch-training-dl-evaluation"
slug: "pytorch-train-eval-no-grad-validacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-TORCH-LOOP"]
description: "Cómo evaluar sin actualizar pesos ni confundir el modo del módulo con autograd. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Llamar a `model.eval()` no impide que PyTorch registre operaciones para autograd. Usar `torch.no_grad()` tampoco pone Dropout en modo de evaluación. Son controles diferentes y confundirlos puede cambiar las predicciones o mantener un grafo que no necesitamos.

Después de [construir el loop](/posts/pytorch-training-loop-zero-grad-backward-step), separamos el comportamiento de las capas, el cálculo de gradientes y la agregación de métricas.

## Train y eval cambian el modo de los módulos

**model.train()** activa el modo de entrenamiento; **model.eval()** equivale a `model.train(False)`. Su efecto numérico depende de las capas. En nuestra MLP dense/tanh el forward no cambia por alternar ese modo.

En **Dropout**, por ejemplo, el modo train aplica su transformación aleatoria y el modo eval devuelve la entrada sin esa eliminación. El laboratorio lo comprueba con un módulo independiente y una entrada de unos: dos llamadas en train difieren y la llamada en eval coincide con la entrada.

Este probe no introduce Dropout en los entrenamientos de la MLP ni demuestra una mejora de regularización. Solo hace observable el interruptor de modo. El estudio de regularización y BatchNorm queda para el siguiente bloque del roadmap.

## No_grad controla el registro de gradientes

En `packages/pytorch-training/probes.py` evaluamos otro modelo con parámetros entrenables:

```python
        model = XorMLP(4).eval()
        inputs = torch.ones(2,2,dtype=torch.float64)
        eval_requires_grad = model(inputs).requires_grad
        model.train()
        with torch.no_grad():
            disabled = model(inputs)
```

La primera salida sigue requiriendo gradiente. La segunda no lo requiere, pero el modelo permanece en modo train. El test comprueba las dos cosas, además del comportamiento de Dropout.

Para nuestra evaluación ordinaria queremos ambas decisiones: comportamiento de evaluación y ausencia de registro del grafo. Existen otros contextos de PyTorch con contratos diferentes, pero no hace falta introducirlos para entender esta separación.

<img src="/assets/visuals/pytorch-training/DL-EVALUATION.svg" alt="Cómo evaluar sin actualizar pesos ni confundir el modo del módulo con autograd. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="324" height="1008" loading="lazy" style="width:100%;max-width:324px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/DL-EVALUATION.svg).

## La evaluación conserva y restaura el modo general

El helper `evaluate`, en `packages/pytorch-training/pipeline.py`, recuerda `model.training`, activa eval y usa `no_grad` mientras recorre el loader. Un bloque `finally` restaura el modo general anterior.

Esto evita que una evaluación intermedia deje el modelo en eval antes de continuar. Nuestra red usa un modo uniforme; el helper no pretende conservar configuraciones mixtas donde ciertos submódulos se mantengan deliberadamente en otro modo.

Tampoco llama al optimizador ni a backward. Los tests comparan el vector de parámetros antes y después, repiten la evaluación y comprueban que el modo general vuelve a ser train cuando ese era el inicial.

## La cola del loader también cuenta al calcular la media

Validation tiene 128 muestras y usa batch size 50: los grupos tienen tamaños 50, 50 y 28. Sumar sus losses medias y dividir por tres daría al grupo pequeño demasiado peso.

El código acumula pérdidas sumadas y divide al final por la cantidad real de muestras:

```python
                loss_sum = float(checked_loss(logits, y, reduction='sum'))
                total_loss += loss_sum
                correct += int(((logits >= 0) == y).sum())
                count += len(x)
                batch_means.append(loss_sum / len(x))
```

Con el modelo inicial de seed 7, la BCE correcta de validation es 0,709423. La media ingenua de las tres medias da 0,713554. Guardamos esta última como control de diagnóstico, no como métrica que use el entrenamiento.

La accuracy también se agrega mediante conteos: aciertos totales entre muestras totales. Promediar accuracies por batch sin ponderar repetiría el mismo problema.

## Poner eval no convierte validation en test

El nombre de una llamada no decide cómo se usa el split. Validation sirve aquí para observar el entrenamiento; no afirmamos una evaluación final ni hemos usado un test para seleccionar configuraciones.

Si se comparan muchas decisiones sobre validation, esas observaciones influyen en el desarrollo del modelo. No dejan de hacerlo por ejecutar las predicciones dentro de `no_grad`.

En esta serie fijamos el protocolo antes de capturar las curvas y publicamos las tres inicializaciones. El objetivo es verificar el pipeline, no estimar el rendimiento de un producto real con este dataset fácil.

## Ejercicio: completa las dos casillas por separado

Para cada situación decide el modo del módulo y si necesitas autograd: validación ordinaria, un backward de entrenamiento y una inspección de gradientes de un modelo en eval. Después explica por qué una prueba que solo comprobara «no cambian los pesos» no detectaría haber dejado Dropout en train durante la validación.

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

- [Modos de nn.Module](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Module.html#torch.nn.Module.eval).
- [torch.no_grad](https://docs.pytorch.org/docs/2.14/generated/torch.no_grad.html).

Continúa con [Guardar un modelo PyTorch: recuperar las mismas predicciones](/posts/pytorch-guardar-cargar-state-dict-predicciones).
