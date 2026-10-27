---
id: "DL-GPU-AMP"
title: "Mixed precision: qué hace autocast y por qué FP16 puede necesitar GradScaler"
published: "2026-10-27T01:04:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-amp"
slug: "mixed-precision-autocast-fp16-bf16-gradscaler"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GPU-BATCHING"]
description: "Cómo combinar precisiones en operaciones sin convertir todos los pesos. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Usar FP16 no significa que todo el modelo pase a ocupar la mitad ni que cada update termine antes. **Mixed precision** elige formatos para operaciones concretas y añade decisiones de estabilidad que también tienen coste.

Tras [separar batch, throughput y calidad](/posts/gpu-batching-throughput-latencia-memoria), comparamos FP32, FP16 y BF16 en la misma GPU. El resultado es útil precisamente porque AMP no acelera este MLP.

## Autocast cambia operaciones, no todos los parámetros

Con **autocast**, PyTorch selecciona la precisión de operaciones elegibles dentro de una región. Algunas multiplicaciones pueden usar formatos reducidos y otras operaciones conservar FP32. Nuestros parámetros siguen almacenados en FP32.

Eso es distinto de llamar a `.half()` sobre todo el modelo. Convertir el dtype de sus parámetros no expresa una política equivalente de operaciones y estabilidad.

**FP16** tiene menos rango de exponente que FP32. **BF16** conserva un rango de exponente similar al de FP32 con menos bits de fracción. Ambos introducen redondeo; BF16 no significa «más preciso que FP16» para cualquier magnitud.

La [documentación de AMP](https://docs.pytorch.org/docs/2.14/amp.html) describe sus políticas por operación. El probe registra el dtype de logits y loss para comprobar qué sucedió aquí.

<img src="/assets/visuals/gpu-training/DL-GPU-AMP.svg" alt="Cómo combinar precisiones en operaciones sin convertir todos los pesos. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="439" height="1104" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## GradScaler protege una parte del cálculo

Los gradientes pequeños pueden perderse por **underflow** durante un backward FP16. Escalar la loss antes de backward aumenta su escala. Antes del step, el scaler deshace esa escala y comprueba valores no finitos.

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
def training_step(model, optimizer, scaler, features, labels, device, precision):
    optimizer.zero_grad(set_to_none=True)
    with amp_context(device, precision):
        logits = model(features)
        loss = F.cross_entropy(logits, labels)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
    return loss.detach()
```

Aquí el scaler se habilita para FP16 y queda deshabilitado en FP32 y BF16. Sus métodos permiten conservar la estructura del loop en todos los modos.

Un overflow detectado puede omitir un step y ajustar la escala. Cada llamada no garantiza una actualización efectiva. La escala FP16 permanece en 65536 entre el final del warmup y el final medido; el reporte no contiene una traza por step de todos los posibles overflows.

Escalar no recupera información perdida en el forward ni corrige cualquier NaN. El gradiente debe generarse a la escala adecuada durante el cálculo que intentamos proteger.

## Diferencias iniciales frente a FP32

<div role="region" aria-label="Forward inicial comparado con FP32" tabindex="0" style="overflow-x:auto;max-width:100%">

| Modo | Output / loss | Error máx. logit | Predicciones iguales |
| --- | --- | --- | --- |
| fp32 | float32 / float32 | 0,000000 | 64/64 |
| fp16 | float16 / float32 | 0,000272 | 63/64 |
| bf16 | bfloat16 / float32 | 0,002286 | 63/64 |

</div>

Se usan los mismos pesos e inputs en 64 ejemplos. FP16 y BF16 cambian una de las 64 predicciones respecto a FP32, aunque los errores de logits sean pequeños.

Esto no mide calidad entrenada. Cerca de un empate, una diferencia pequeña cambia el argmax. Validar una política de precisión exige evaluar la tarea después de entrenar, además de comprobar proximidad inicial.

## En este workload, AMP tardó más

<div role="region" aria-label="Tiempos CUDA sin selección de resultados" tabindex="0" style="overflow-x:auto;max-width:100%">

| Batch | FP32 ms | FP16 ms | BF16 ms |
| --- | --- | --- | --- |
| 32 | 1,988277 | 2,644679 | 2,454421 |
| 128 | 2,018505 | 2,719429 | 2,466217 |
| 512 | 2,040094 | 2,651706 | 2,452256 |

</div>

Con batch 128, FP32 ronda 2,019 ms por update; FP16, 2,719; BF16, 2,466. El peak allocated es casi igual. Conservamos esos números en vez de cambiar el workload hasta que mixed precision parezca ganador.

Los parámetros y estados FP32 siguen presentes. Hay lanzamiento de kernels, optimizer, conversiones y otras operaciones además de las multiplicaciones que podrían beneficiarse. La captura no aísla cuánto aporta cada componente; sí muestra que el resultado total no mejoró aquí.

En redes mayores puede suceder lo contrario. Necesita otra medición. Tampoco confundimos nuestro FP32 estricto, con TF32 deshabilitado, con cualquier configuración por defecto de otro entorno.

## Qué comprobar antes de adoptar otra precisión

Revisaría hardware, kernels, operaciones dominantes, estabilidad de loss, escala y calidad de validation. Después mediría tiempo y memoria con el mismo workload.

El clipping debe operar sobre gradientes desescalados. Si acumulamos microbatches, escala y step deben gestionarse al nivel del batch lógico. Los [ejemplos de AMP](https://docs.pytorch.org/docs/2.14/notes/amp_examples.html) detallan esos casos; la siguiente entrega desarrolla la ponderación.

## Garantías y límites

Se ejecutan forward, backward y optimizer reales y se verifican parámetros FP32. El probe es inicial y el batch se repite. No se declara calidad equivalente ni ahorro universal de memoria o tiempo.

## Ejercicio: revisar «la mitad de memoria»

Si pesos, gradientes y estados siguen en FP32, identifica qué partes podrían reducirse con autocast. Decide qué contador medirías para comprobar el ahorro total que necesita tu entrenamiento.

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

- [documentación de AMP](https://docs.pytorch.org/docs/2.14/amp.html).
- [ejemplos de AMP](https://docs.pytorch.org/docs/2.14/notes/amp_examples.html).

Siguiente: [Gradient accumulation: un batch lógico, varios backward y un solo step](/posts/gradient-accumulation-gpu-microbatches-desiguales).
