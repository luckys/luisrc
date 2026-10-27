---
id: "P105"
title: "CPU, GPU y CUDA: medir el entrenamiento sin confundir envío y ejecución"
published: "2026-10-27T01:00:00Z"
locale: "es"
translationKey: "gpu-training-p105"
slug: "cpu-gpu-cuda-medir-entrenamiento-sincronizacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P099", "P104"]
description: "Qué cambia al enviar operaciones a GPU y cómo medir un update completo. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Un entrenamiento puede parecer rápido si el cronómetro se detiene antes de que la GPU termine. La llamada desde Python y la ejecución en el dispositivo no son el mismo intervalo; medir bien exige decidir cuál nos interesa.

Después de [medir qué conserva una adaptación de modelos](/posts/forgetting-evaluar-tarea-anterior-despues-fine-tuning), abrimos un bloque sobre cómputo y memoria. Usaremos un MLP y una GPU real para seguir un update completo, sin atribuir al hardware tiempos que corresponden a preparación de datos u otros procesos.

## CPU, GPU y CUDA participan en partes distintas del trabajo

La **CPU**, o **host**, ejecuta Python, prepara estructuras y coordina el entrenamiento. La **GPU**, o **device**, puede ejecutar en paralelo operaciones numéricas como multiplicaciones de matrices. **CUDA** es la plataforma de NVIDIA que permite programar y ejecutar ese trabajo en sus dispositivos; PyTorch llama a kernels y bibliotecas sin que tengamos que escribirlos a mano.

Eso no convierte todo el programa Python en código GPU. Leer archivos, construir batches o ejecutar lógica de control puede seguir ocupando la CPU. Una operación pequeña también puede costar más en envío y coordinación de lo que ahorra al calcularla en otro dispositivo.

Modelo e inputs deben estar en dispositivos compatibles. Mover el modelo con `.to('cuda')` no mueve automáticamente los tensores que creamos después. Tampoco convierte la RAM del host en VRAM.

<img src="/assets/visuals/gpu-training/P105.svg" alt="Qué cambia al enviar operaciones a GPU y cómo medir un update completo. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="432" height="1104" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## El envío asíncrono obliga a cerrar el intervalo medido

En el camino CUDA habitual, la CPU puede encolar operaciones y continuar antes de que terminen. Si medimos solo el tiempo de llamar a una función, podemos obtener principalmente su coste de lanzamiento. La [documentación de CUDA en PyTorch](https://docs.pytorch.org/docs/2.14/notes/cuda.html) describe esta ejecución y la sincronización necesaria para medirla.

Queremos **wall time**: tiempo transcurrido de un bloque de diez updates completos con sus esperas. Antes de empezar retiramos trabajo pendiente del dispositivo; antes de parar esperamos a que termine el bloque.

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
def sample_updates(step, count, device):
    synchronise(device)
    started = time.perf_counter()
    for _ in range(count):
        loss = step()
    synchronise(device)
    elapsed = time.perf_counter() - started
    return elapsed, loss
```

`step()` incluye poner gradientes a cero, forward, loss, backward y optimizer. Los datos ya están en el dispositivo. No incluimos su generación, lectura desde disco ni transferencia inicial.

En CPU, `synchronise` no hace nada adicional. En CUDA llama a `torch.cuda.synchronize()`. Esa espera resulta útil para este experimento aislado, pero puede incluir trabajo de otros streams del mismo proceso. Introducirla en cada iteración de una aplicación concurrente puede cambiar el comportamiento que intentamos medir.

## Warmup y repeticiones responden a preguntas concretas

Cada configuración empieza en un proceso Python nuevo, con los mismos pesos iniciales y un orden de ejecución fijado de antemano. Realiza ocho updates de **warmup** y después guarda cinco muestras de diez updates.

El warmup evita mezclar costes iniciales de preparación con el comportamiento de un entrenamiento ya en marcha. No elimina variación térmica, de frecuencia o del sistema operativo. No hemos bloqueado relojes ni aislado toda la máquina.

La mediana de las cinco duraciones, dividida entre diez, da milisegundos por update. Es una mediana de bloques, no un percentil de latencias individuales. El visor conserva las cinco muestras para comprobar esa agregación.

## Qué se observó con batch 128

<div role="region" aria-label="FP32 con batch 128 y CPU un thread" tabindex="0" style="overflow-x:auto;max-width:100%">

| Dispositivo | ms/update | Filas/s |
| --- | --- | --- |
| CPU | 30,186068 | 4240,366795 |
| CUDA | 2,018505 | 63413,271835 |

</div>

<img src="/assets/interactive/gpu-training/cpu-gpu.svg" alt="Milisegundos por update FP32 de batch 128 con datos residentes. CPU usa un thread; no es una comparación contra todos los cores ni de un pipeline completo." width="380" height="168" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La captura usa una NVIDIA GeForce RTX 5070 Laptop GPU, PyTorch 2.14.0+cu130 y CUDA 13.0. El MLP tiene 1.591.312 parámetros: 512 entradas, dos capas ocultas de 1024 y 16 logits de salida. Usa AdamW y no contiene Dropout ni BatchNorm.

La CPU utiliza **un thread numérico**. Estas cifras no comparan la GPU con la mejor configuración posible de todos los cores del equipo. Son una referencia acotada con el mismo programa y el mismo número de iteraciones.

## El dato residente delimita la conclusión

El batch sintético se reutiliza durante la medición. Su etiqueta es el índice de la mayor de las primeras 16 features. No estamos midiendo un pipeline de datos ni calidad sobre un test nuevo.

Una aplicación puede pasar mucho tiempo esperando I/O o transfiriendo datos aunque sus matrices se calculen rápido. Si esas partes dominan, nuestra tabla no predice la mejora de mover toda la aplicación a GPU. Por eso mediremos transferencias por separado.

## Garantías y límites

Se observan updates reales en CPU y CUDA, con muestras archivadas y sincronización explícita. No se simulan tiempos ni se declara una aceleración universal. El profiler aportará evidencia de kernels ejecutados, pero pertenece a una captura instrumentada diferente.

## Ejercicio: definir el intervalo antes de optimizar

Dibuja las fases de tu entrenamiento: preparar batch, copiarlo, forward, backward y step. Decide si quieres medir el update residente o el tiempo total desde que pides los datos. Sitúa el inicio y final del cronómetro antes de elegir una GPU más potente.

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

- [documentación de CUDA en PyTorch](https://docs.pytorch.org/docs/2.14/notes/cuda.html).

Siguiente: [VRAM en PyTorch: por qué los parámetros no explican toda la memoria](/posts/vram-pytorch-allocated-reserved-activaciones).
