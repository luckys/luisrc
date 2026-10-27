---
id: "DL-GPU-BATCHING"
title: "Batching en GPU: procesar más ejemplos no equivale a aprender mejor"
published: "2026-10-27T01:03:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-batching"
slug: "gpu-batching-throughput-latencia-memoria"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GPU-TRANSFER"]
description: "Cómo batch cambia tiempo por update, throughput y pico de memoria. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Procesar 512 filas puede tardar casi lo mismo que procesar 32 en una GPU poco ocupada. Eso aumenta el throughput, pero no demuestra que un modelo aprenda mejor ni que una petición individual tarde menos.

Después de [medir transferencias H2D](/posts/gpu-transferencias-pinned-memory-non-blocking), volvemos a los datos residentes para cambiar el número de filas por update.

## Qué trabajo comparte un batch

El MLP transforma matrices `[batch, 512]` en logits `[batch, 16]`. Los pesos son comunes a todas las filas. Al aumentar batch crecen las multiplicaciones y activaciones, mientras ciertos costes de lanzamiento, coordinación y actualización de parámetros no crecen en la misma proporción.

Si esos costes fijos pesan mucho, añadir filas puede aprovechar mejor la GPU. No hay crecimiento ilimitado: llega un punto en que cálculo, memoria o transferencias limitan el throughput.

Un **update** incluye el batch completo y termina en un step del optimizer. Las filas procesadas por segundo son una métrica distinta del tiempo de ese update.

<img src="/assets/visuals/gpu-training/DL-GPU-BATCHING.svg" alt="Cómo batch cambia tiempo por update, throughput y pico de memoria. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="431" height="860" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La misma muestra produce dos métricas

Conservamos cinco muestras de diez updates. A partir de su mediana calculamos tiempo por update y filas por segundo. El código guarda las duraciones antes de resumirlas:

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
    times = []
    scale_before = scaler.get_scale()
    for _ in range(protocol['samples']):
        elapsed, loss = sample_updates(step, protocol['stepsPerSample'], device)
        times.append(elapsed)
    final_loss = loss.item()
    memory = memory_snapshot() if device == 'cuda' else None
    median = statistics.median(times)
```

Si diez updates tardan `t` segundos y cada uno contiene `B` filas, el throughput es `10 × B / t`. El tiempo por update es `t / 10`. Dividir además por batch daría tiempo amortizado por fila; no sería la latencia de una petición aislada.

Las filas se repiten en este experimento. «Filas/s» cuenta trabajo procesado, no ejemplos nuevos producidos por un dataset. Esto importa al comparar con un pipeline que debe construir cada batch.

## Qué cambió en CUDA FP32

<div role="region" aria-label="Batching CUDA FP32 con datos residentes" tabindex="0" style="overflow-x:auto;max-width:100%">

| Batch | ms/update | Filas/s | Peak allocated MiB |
| --- | --- | --- | --- |
| 32 | 1,988277 | 16094,339388 | 96,353516 |
| 128 | 2,018505 | 63413,271835 | 96,547363 |
| 512 | 2,040094 | 250968,864734 | 97,323730 |

</div>

<img src="/assets/interactive/gpu-training/training-time.svg" alt="Medianas de cinco muestras CUDA por batch y precisión. FP32 tarda menos que FP16 y BF16 aquí; el eje mide milisegundos por update completo." width="380" height="320" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Entre batch 32 y 512, el tiempo FP32 apenas cambia en esta captura y el throughput aumenta aproximadamente de 16 mil a 251 mil filas/s. El pico de memoria crece, aunque aquí la parte variable es pequeña frente al resto del footprint.

Es una observación de este MLP. No significa que aumentar batch dieciséis veces conserve siempre el tiempo. Otra arquitectura, secuencias más largas o matrices mayores pueden responder de otra manera.

## Igualar updates no iguala el trabajo estadístico

Todas las configuraciones hacen ocho iteraciones de warmup y cincuenta medidas. Un batch de 512 procesa dieciséis veces más filas por iteración que uno de 32.

Cambiar batch también puede alterar la estimación del gradiente, cuántas veces actualizamos pesos al recorrer el dataset y cómo conviene ajustar learning rate o scheduler. Mantener epochs o updates sin describir el presupuesto que queremos igualar puede ocultar diferencias importantes.

El benchmark no elige el batch con mejor generalización. Usa datos repetidos para medir ejecución. Una loss de entrenamiento muy baja puede reflejar memorización de ese batch; no se presenta como calidad en test.

## El batch más grande que cabe puede ser una mala elección

Un servicio de inferencia puede ganar throughput esperando a agrupar peticiones, pero introduce tiempo en cola. Necesita una medición de latencia end-to-end bajo carga; un benchmark de entrenamiento residente no responde esa pregunta.

Al entrenar también necesitamos margen para variación de shapes, casos grandes o estado adicional. Buscar el último batch antes de OOM puede producir una configuración frágil. Aquí limitamos el allocator y no exploramos la capacidad máxima de la GPU.

Si un batch lógico no cabe, **gradient accumulation** permite dividirlo. Veremos las condiciones para preservar el objetivo y por qué no garantiza equivalencia de todos los efectos del entrenamiento.

## Garantías y límites

Se mantienen modelo, precisión y optimizer al comparar batches 32, 128 y 512. Los datos están residentes y CPU usa un thread. No medimos datos nuevos por segundo, calidad downstream ni latencia de servicio.

## Ejercicio: elegir la unidad del presupuesto

Calcula cuántos updates necesitan dos tamaños de batch para procesar el mismo total de filas. Explica qué pregunta respondería mantener el mismo número de updates y cómo registrarías ambos presupuestos.

## Explorar la captura

El [visor interactivo](/assets/interactive/gpu-training/explorer.html) muestra doce configuraciones, cinco muestras originales por caso, memoria, copias, controles y profiler. Los selectores no entrenan ni inventan mediciones.

<iframe src="/assets/interactive/gpu-training/explorer.html" title="Captura interactiva de entrenamiento CPU y CUDA" loading="lazy" width="100%" height="760" style="border:1px solid #475569;border-radius:8px;max-width:100%"></iframe>

## Código completo y pruebas

Las fuentes están en [gpu-training](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), fuera del blog. Reporte y traza original conservan la evidencia; el sitio exporta gráficos y un visor estático.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --filter @luisrc-examples/gpu-training verify
pnpm --filter @luisrc-examples/gpu-training runtime:fetch
pnpm --filter @luisrc-examples/gpu-training preflight
pnpm --filter @luisrc-examples/gpu-training test:container
pnpm --filter @luisrc-examples/gpu-training reobserve
```

`verify` audita la captura guardada. Para ejecutar otra se necesita Docker y una GPU NVIDIA compatible con el runtime fijado por digest. El runner Linux documenta los dispositivos y las bibliotecas del driver que monta en lectura, sin modificar driver ni daemon. `reobserve` guarda otro reporte bajo `/tmp`, sin reemplazar la referencia. No se espera repetir los mismos segundos.

- [workload.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/workload.py)
- [measure.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/measure.py)
- [controls.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/controls.py)
- [profiling.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/profiling.py)
- [protocol.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/protocol.json)
- [tests/test_workload.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/tests/test_workload.py)
- [results/observations.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/results/observations.json)
- [results/profiler-trace.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/gpu-training/results/profiler-trace.json)

## Referencias

- [CUDA y rendimiento, PyTorch](https://docs.pytorch.org/docs/2.14/notes/cuda.html).

Siguiente: [Mixed precision: qué hace autocast y por qué FP16 puede necesitar GradScaler](/posts/mixed-precision-autocast-fp16-bf16-gradscaler).
