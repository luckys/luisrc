---
id: "DL-GPU-ACCUMULATION"
title: "Gradient accumulation: un batch lógico, varios backward y un solo step"
published: "2026-10-27T01:05:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-accumulation"
slug: "gradient-accumulation-gpu-microbatches-desiguales"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GPU-AMP", "DL-ACCUMULATION"]
description: "Cómo ponderar microbatches desiguales sin cambiar el objetivo. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Dividir un batch en varios trozos no basta para obtener el mismo update. Si cada trozo calcula una media y promediamos esas medias por igual, el más pequeño puede recibir demasiado peso.

Después de [entender autocast y GradScaler](/posts/mixed-precision-autocast-fp16-bf16-gradscaler), aislamos **gradient accumulation** con FP32 y un solo step SGD. Usaremos 21 ejemplos repartidos en 8, 8 y 5 para hacer visible el problema del último microbatch.

La [entrega anterior sobre acumulación](/posts/gradient-accumulation-microbatches-media-ponderada) derivó esta ponderación y la comprobó en NumPy. Aquí la seguimos con autograd, FP32 y ejecución CUDA para contrastar un update real y sus diferencias de redondeo.

## El batch lógico define la media que queremos

La media sobre 21 ejemplos tiene denominador 21. Un microbatch de ocho calcula su propia media con denominador ocho. Para contribuir al promedio global debe multiplicarse por `8/21`; el último aporta `5/21`.

Con microbatches iguales, dividir cada loss media entre el número de microbatches funciona porque los pesos coinciden. Con tamaños distintos, cambia el objetivo.

Los gradientes se suman en los parámetros cuando hacemos varios backward sin ponerlos a cero entre ellos. Calculamos cada parte, liberamos su grafo cuando deja de ser necesario y aplicamos un único update al terminar el batch lógico.

<img src="/assets/visuals/gpu-training/DL-GPU-ACCUMULATION.svg" alt="Cómo ponderar microbatches desiguales sin cambiar el objetivo. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="440" height="958" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Zero_grad y step ocurren una sola vez

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
def one_update(model, features, labels, sizes, learning_rate, wrong_weights=False):
    optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate)
    optimizer.zero_grad(set_to_none=True)
    start = 0
    for count in sizes:
        stop = start + count
        loss = F.cross_entropy(model(features[start:stop]), labels[start:stop], reduction='mean')
        weight = 1 / len(sizes) if wrong_weights else count / len(features)
        (loss * weight).backward()
        start = stop
    if start != len(features):
        raise ValueError('microbatches must cover the complete logical batch')
    optimizer.step()
```

`count / len(features)` es el peso de una loss media por ejemplo. `start` y `stop` recorren las filas sin repetirlas ni saltarlas. El control exige cubrir todo el batch.

Poner `zero_grad` dentro del bucle borraría lo acumulado. Hacer `optimizer.step()` por microbatch cambiaría los pesos antes de calcular los siguientes gradientes; ya no corresponderían al único update que comparamos.

El control negativo usa `1 / len(sizes)`. Da un tercio de la loss global al último microbatch en vez de `5/21`: cada uno de sus cinco ejemplos pesa más de lo que debería.

## Qué se comparó en GPU

Partimos de tres copias idénticas. Una procesa 21 filas juntas. Otra acumula correctamente. La tercera usa medias mal ponderadas. Las tres hacen un único step SGD con learning rate 0,01.

<div role="region" aria-label="Un update SGD con microbatches desiguales" tabindex="0" style="overflow-x:auto;max-width:100%">

| Variante | Error máx. respecto a batch completo |
| --- | --- |
| Ponderación por ejemplos | 3.725290298e-09 |
| Promedio de medias | 3.273934126e-04 |

</div>

El error correcto ronda 3,7e-9, compatible con redondeo por diferente orden de cálculo. La versión incorrecta difiere aproximadamente 3,27e-4 en la componente más distinta del update.

No exigimos igualdad bit a bit. Combinamos tolerancia para la versión correcta y una diferencia detectable para el control negativo. Así distinguimos una implementación razonable de otra que solo termina sin errores.

## No todos los modelos conservan la equivalencia

El MLP no tiene **BatchNorm**, cuyas estadísticas cambian al partir un batch. Tampoco tiene **Dropout**: varias llamadas pueden consumir aleatoriedad de otra manera y generar una trayectoria distinta.

También importa la reducción. En secuencias con padding quizá queramos ponderar por tokens válidos, no por secuencias. Si tienen longitudes distintas, usar solo el número de secuencias puede optimizar otra media.

Scheduler, weight decay y acciones por step deben corresponder al nivel lógico deseado. Acumular no convierte varias actualizaciones completas de AdamW en una sola por sumar sus resultados al final.

## Cómo encaja con AMP

La escala debe mantenerse coherente durante el batch lógico. Desescalamos para clipping o comprobaciones cuando corresponda y hacemos step/update del scaler al terminar ese batch.

La [guía de AMP para acumulación](https://docs.pytorch.org/docs/2.14/notes/amp_examples.html) concreta el orden. Nuestro control usa FP32 y SGD para no atribuir a la ponderación diferencias de otras decisiones.

Los microbatches pueden reducir memoria de activaciones, pero añaden llamadas y pueden perder throughput frente a un batch físico que cabe. Aquí comprobamos el update; no publicamos un ahorro de memoria de accumulation que no hayamos medido.

## Garantías y límites

Se comprueba CPU y CUDA con un control incorrecto que debe diferir. No se declara equivalencia universal con BatchNorm, Dropout, padding u otro optimizer. Los pesos se derivan de la reducción de loss.

## Ejercicio: un último microbatch incompleto

Divide 19 ejemplos en 8, 8 y 3. Escribe los pesos para preservar una media por ejemplo. Después cambia a secuencias con distintos tokens válidos y explica el denominador de una media por token.

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

- [guía de AMP para acumulación](https://docs.pytorch.org/docs/2.14/notes/amp_examples.html).

Siguiente: [PyTorch Profiler: leer CPU y kernels sin sumar tiempos que se solapan](/posts/pytorch-profiler-cpu-kernels-tiempo-wall).
