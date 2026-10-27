---
id: "DL-GPU-TRANSFER"
title: "Transferencias a GPU: qué cambian pinned memory y non_blocking"
published: "2026-10-27T01:02:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-transfer"
slug: "gpu-transferencias-pinned-memory-non-blocking"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GPU-MEMORY"]
description: "Cómo medir copias H2D y qué falta para demostrar overlap. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Un kernel rápido puede quedarse esperando sus inputs. Antes de optimizar el cálculo conviene comprobar cuánto tarda en llevar los datos de RAM a GPU y qué parte de ese coste dejamos fuera del cronómetro.

Después de [separar allocated y reserved](/posts/vram-pytorch-allocated-reserved-activaciones), medimos copias **H2D**, de host a device. Sin cómputo concurrente, estos resultados no prueban overlap entre copia y entrenamiento.

## Pinned memory permite una ruta diferente

La memoria **pageable** del host usa páginas que gestiona el sistema operativo. La memoria **pinned** se mantiene fijada para permitir transferencias directas mediante mecanismos de DMA. Fijarla también tiene coste y consume un recurso limitado del host.

`non_blocking=True` permite evitar ciertas esperas de la llamada desde CPU cuando la ruta lo admite. No significa que el dato haya llegado al retornar la función. Tampoco crea automáticamente otro stream ni trabajo con el que solapar la copia.

La [guía de pinned memory y non_blocking de PyTorch](https://docs.pytorch.org/tutorials/intermediate/pinmem_nonblock.html) desarrolla estas interacciones. Comparamos dos estrategias completas: pageable con copia bloqueante y pinned con copia no bloqueante.

<img src="/assets/visuals/gpu-training/DL-GPU-TRANSFER.svg" alt="Cómo medir copias H2D y qué falta para demostrar overlap. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="441" height="934" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La preparación queda fuera del intervalo

Creamos la fuente, la fijamos si procede y reservamos el destino antes de medir. Reutilizamos ambos buffers. Hacemos cuatro copias de warmup y cinco muestras de diez copias.

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
            for _ in range(protocol['transfer']['samples']):
                torch.cuda.synchronize()
                start = time.perf_counter()
                for _ in range(protocol['transfer']['copiesPerSample']):
                    destination.copy_(source, non_blocking=pinned)
                torch.cuda.synchronize()
                samples.append(time.perf_counter() - start)
```

La estrategia bloqueante puede esperar durante cada `copy_`. La no bloqueante encola las copias y espera al final de la muestra. El tiempo wall incluye esa política completa, incluido el bucle Python y la sincronización final.

Cambiamos **dos decisiones a la vez**, pinning y bloqueo. No podemos atribuir toda diferencia exclusivamente a pinned memory. Para separar cada factor haría falta un diseño con combinaciones adicionales.

## Qué se observó con 1 y 16 MiB

<div role="region" aria-label="Transferencias H2D con preparación excluida" tabindex="0" style="overflow-x:auto;max-width:100%">

| MiB | Estrategia | ms/copia | GB/s |
| --- | --- | --- | --- |
| 1 | pageable_blocking | 0,184708 | 5,676926 |
| 1 | pinned_nonblocking | 0,152675 | 6,868009 |
| 16 | pageable_blocking | 2,471665 | 6,787821 |
| 16 | pinned_nonblocking | 2,313582 | 7,251619 |

</div>

<img src="/assets/interactive/gpu-training/transfer.svg" alt="Throughput efectivo decimal de copias H2D de 1 y 16 MiB, pageable/bloqueante o pinned/no bloqueante. Preparación excluida; sin prueba de overlap con cálculo." width="380" height="236" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Los GB/s usan unidades decimales: bytes divididos por segundos y mil millones. Los tamaños de buffers usan MiB, potencias de dos. Nombrar ambas unidades evita comparar números que parecen equivalentes pero no lo son.

Medimos **throughput efectivo de la estrategia de copia**, no el ancho de banda máximo teórico de PCIe. Quedan fuera leer un archivo, decodificar una imagen, construir el batch y fijar memoria desde cero.

Si un pipeline llama a `pin_memory()` para cada tensor pequeño justo antes de copiarlo, ese coste puede reducir o anular el beneficio de una comparación que lo excluya. La decisión debe probarse en el flujo que queremos acelerar.

## Qué haría falta para demostrar overlap

Necesitamos trabajo independiente, una política de streams adecuada y una traza que muestre intervalos superpuestos. Si copiamos y esperamos antes de iniciar cualquier cálculo, no hay nada que solapar.

Un pipeline puede preparar y copiar el próximo batch mientras entrena con el actual. Exige separar buffers y respetar dependencias. Reutilizar un destino que la GPU todavía está leyendo puede corromper el cálculo.

También debemos mantener válida la fuente de una copia asíncrona y no modificar sus datos antes de que termine. El laboratorio mantiene buffers estables y comprueba el contenido del destino después de sincronizar. No usa el retorno de la llamada como prueba de completitud.

## Copiar un escalar al host también puede introducir esperas

Convertir un tensor CUDA en un número Python con `.item()` puede esperar a obtener el valor. Hacerlo en cada step cambia la ejecución que medimos.

Por eso el benchmark de entrenamiento lee la loss final fuera del intervalo de cada bloque. En una aplicación real quizá necesitemos métricas frecuentes; su coste debería incluirse si queremos medir ese flujo real.

## Garantías y límites

Las copias se ejecutan en GPU y se comprueba el destino. No se demuestra overlap, escalabilidad de DataLoader ni rendimiento end-to-end. Los buffers son sintéticos, se reutilizan y su preparación queda fuera de los tiempos.

## Ejercicio: encontrar el coste excluido

Un pipeline tarda más en decodificar y fijar memoria que en copiarla. Explica qué medirías para decidir si merece la pena cambiar de estrategia y qué conclusión no podrías sacar solo con nuestra tabla H2D.

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

- [guía de pinned memory y non_blocking de PyTorch](https://docs.pytorch.org/tutorials/intermediate/pinmem_nonblock.html).

Siguiente: [Batching en GPU: procesar más ejemplos no equivale a aprender mejor](/posts/gpu-batching-throughput-latencia-memoria).
