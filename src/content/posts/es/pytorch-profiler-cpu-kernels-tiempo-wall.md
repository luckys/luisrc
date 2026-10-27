---
id: "DL-GPU-PROFILER"
title: "PyTorch Profiler: leer CPU y kernels sin sumar tiempos que se solapan"
published: "2026-10-27T01:06:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-profiler"
slug: "pytorch-profiler-cpu-kernels-tiempo-wall"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GPU-ACCUMULATION"]
description: "Qué pregunta responde una traza instrumentada y cómo contrastarla con wall time. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Un cronómetro dice cuánto tardó un bloque, pero no muestra sus operaciones. El **profiler** permite localizar trabajo y esperas; sus tablas también pueden engañar si sumamos tiempos anidados o confundimos CPU y GPU.

Tras [comprobar acumulación de gradientes](/posts/gradient-accumulation-gpu-microbatches-desiguales), abrimos una captura real de tres updates. Es una observación instrumentada, separada del benchmark sin profiler.

## Hay eventos de coordinación y de ejecución

La CPU registra llamadas, prepara argumentos y lanza trabajo. La GPU ejecuta kernels en streams. Una llamada CPU puede terminar antes que sus kernels y distintos intervalos pueden solaparse.

**Self time** intenta atribuir tiempo propio excluyendo trabajo hijo dentro de su jerarquía. **Total time** incluye trabajo asociado o anidado según el evento. Ninguna columna permite sumar todas las filas sin más para obtener wall time.

La tabla agregada puede contener operaciones, kernels y rangos de usuario. Incluso puede haber entradas con el mismo nombre procedentes de eventos distintos. El nombre no garantiza tiempos independientes.

<img src="/assets/visuals/gpu-training/DL-GPU-PROFILER.svg" alt="Qué pregunta responde una traza instrumentada y cómo contrastarla con wall time. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="482" height="1061" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Se solicita CPU y CUDA explícitamente

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA], record_shapes=True, profile_memory=True) as profiler:
        for _ in range(config['steps']):
            with record_function('training_update'):
                training_step(model, optimizer, scaler, x, y, 'cuda', 'fp32')
        torch.cuda.synchronize()
```

`record_function('training_update')` etiqueta una región para orientarnos. `record_shapes=True` conserva formas y `profile_memory=True` añade memoria. Estas opciones introducen trabajo extra.

Hacemos warmup antes y sincronizamos al cerrar. Después exportamos Chrome trace. La [API de torch.profiler](https://docs.pytorch.org/docs/2.14/profiler.html) documenta estas opciones.

No basta un título que diga «CUDA»: exigimos eventos de categoría `kernel` en la traza. Solo actividad CPU no demostraría ejecución GPU.

## Qué contiene la traza

Hay **219 eventos kernel** en tres updates instrumentados de batch 128 y FP32. Suman 1064,807 microsegundos. El visor ordena filas por self CPU o self device y conserva el índice original para distinguir entradas repetidas.

La suma no equivale al tiempo total: puede excluir esperas, huecos entre kernels, copias y trabajo CPU. Con kernels concurrentes, sumar duraciones tampoco daría tiempo transcurrido en GPU.

No sumamos `training_update` a las operaciones que contiene: contaríamos parte del trabajo dos veces. La traza original permite examinar la cronología, además de la tabla resumida.

## De la observación a una hipótesis

Muchas llamadas pequeñas y huecos justificarían investigar lanzamiento o sincronización. Si dominan multiplicaciones grandes, revisaría shapes, precisión y kernels. Si dominan copias, miraría el pipeline.

Son hipótesis, no causas demostradas por un nombre. Cambiaría una decisión y mediría sin instrumentación para comprobar si mejora la métrica relevante.

AMP no mejoró el MLP. El profiler permite ver que las multiplicaciones no son todo el update, pero no cuantifica causalmente qué fracción de la diferencia entre precisiones procede de cada coste.

## La instrumentación también altera el tiempo

Registrar shapes, memoria y eventos consume recursos. Una traza corta puede incluir preparación de la instrumentación. Sus cifras no se convierten automáticamente en rendimiento representativo de ejecución normal.

Conservamos cinco muestras sin profiler por configuración para comparar tiempos y una traza para estudiar mecanismos. Tienen objetivos e intervalos distintos.

En entrenamientos largos elegiría un tramo representativo y un calendario de captura. Registrar todo puede consumir recursos y dificultar encontrar una pregunta concreta que responder.

## Garantías y límites

Conservamos la traza y verificamos kernels y duraciones. No capturamos hardware counters ni demostramos saturación de GPU. El ranking ayuda a investigar; no son porcentajes independientes que deban sumar cien.

## Ejercicio: evitar contar dos veces

Busca un rango y una operación que pertenezca a él. Explica por qué no sumarías ambas duraciones para obtener el total. Propón un cambio que medirías sin profiler para contrastar una hipótesis de la traza.

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

- [API de torch.profiler](https://docs.pytorch.org/docs/2.14/profiler.html).

Siguiente: [Determinism en GPU: reproducir cálculos sin prometer tiempos idénticos](/posts/gpu-determinism-seeds-tiempos-reproducibles).
