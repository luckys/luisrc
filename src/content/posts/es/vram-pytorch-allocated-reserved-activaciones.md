---
id: "DL-GPU-MEMORY"
title: "VRAM en PyTorch: por qué los parámetros no explican toda la memoria"
published: "2026-10-27T01:01:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-memory"
slug: "vram-pytorch-allocated-reserved-activaciones"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P105"]
description: "Qué ocupan pesos, estados y activaciones y qué muestran allocated/reserved. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Un modelo puede ocupar seis MiB en pesos y necesitar bastante más memoria para entrenar. El entrenamiento conserva gradientes, estados del optimizer y resultados intermedios; mirar solo el checkpoint deja fuera parte del problema.

Tras [medir un update completo en CPU y GPU](/posts/cpu-gpu-cuda-medir-entrenamiento-sincronizacion), separaremos una cuenta algebraica de los contadores observados del allocator de PyTorch.

## Cuatro componentes que ayudan a empezar la cuenta

Los **pesos** definen el modelo. Los **gradientes** acumulan las derivadas usadas para actualizarlos. **AdamW** mantiene dos estados por parámetro actualizado, además de detalles de implementación. Las **activaciones** y otros temporales permiten calcular el backward.

Con 1.591.312 parámetros y FP32, solo los pesos suman 6.365.248 bytes. Si contamos también gradientes y dos estados FP32, esos cuatro arrays suman 25.460.992 bytes, unos 24,28 MiB.

Esa cuenta no es una medición de peak VRAM. Omite buffers, workspace de bibliotecas, alineación, tensores de entrada y memoria temporal. Tampoco describe todos los optimizers ni estrategias de precisión.

<img src="/assets/visuals/gpu-training/DL-GPU-MEMORY.svg" alt="Qué ocupan pesos, estados y activaciones y qué muestran allocated/reserved. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="463" height="805" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Allocated y reserved no significan lo mismo

**Allocated** cuenta memoria de tensores gestionada por el allocator que está ocupada. **Reserved** incluye bloques que PyTorch mantiene para reutilizarlos. Una parte puede estar libre para el propio allocator sin haberse devuelto al driver.

Reserved puede ser mayor que allocated sin demostrar una fuga. Tampoco equivale a toda la memoria que `nvidia-smi` atribuye al proceso o al dispositivo: hay componentes fuera del allocator y puede haber otros procesos.

El laboratorio lee cuatro contadores:

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
def memory_snapshot():
    return dict(allocated=torch.cuda.memory_allocated(), reserved=torch.cuda.memory_reserved(),
        peakAllocated=torch.cuda.max_memory_allocated(), peakReserved=torch.cuda.max_memory_reserved())
```

Los dos primeros describen el estado al consultarlos. Los dos últimos son máximos desde el reinicio de peaks. Un valor al terminar el step no captura necesariamente el momento en que convivían más activaciones y gradientes.

## Medimos después de crear el estado del optimizer

Hacemos ocho updates de warmup, esperamos a CUDA y reiniciamos los máximos. Modelo, optimizer y batch siguen vivos; reiniciar estadísticas no libera sus tensores ni los excluye de los máximos nuevos.

Así evitamos presentar una medición anterior al primer step de AdamW como si incluyera su estado ya creado. Cada configuración corre en un proceso nuevo para reducir la influencia del historial de otras configuraciones sobre su allocator.

El [contador max_memory_allocated](https://docs.pytorch.org/docs/2.14/generated/torch.cuda.memory.max_memory_allocated.html) observa el máximo. No identifica qué tensor produjo cada byte. Restar los pesos y llamar «activaciones» a todo lo restante sería una atribución injustificada.

## Qué ocupó este MLP en FP32

<div role="region" aria-label="Picos reales CUDA FP32 después de warmup" tabindex="0" style="overflow-x:auto;max-width:100%">

| Batch | Peak allocated MiB | Peak reserved MiB |
| --- | --- | --- |
| 32 | 96,353516 | 106,000000 |
| 128 | 96,547363 | 108,000000 |
| 512 | 97,323730 | 106,000000 |

</div>

<img src="/assets/interactive/gpu-training/memory.svg" alt="Peak allocated en MiB para batches 32, 128 y 512 por precisión CUDA. Las curvas casi se superponen: mixed precision apenas reduce el pico de este MLP." width="380" height="320" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Las curvas de FP32, FP16 y BF16 casi se superponen. Los pesos y estados del optimizer siguen en FP32; también hay otros costes del runtime. La captura prueba que el ahorro de peak allocated es pequeño aquí, pero no descompone exactamente todos sus componentes.

Entre batch 32 y 512, el pico FP32 aumenta aproximadamente un MiB. Eso no implica que las activaciones de cualquier modelo crezcan tan poco. Arquitectura, shapes y operaciones cambian qué se conserva y qué pico domina.

## Qué revisar antes de llamar a empty_cache

Guardar en una lista tensores conectados al grafo puede mantener memoria viva sin querer. Revisaría qué referencias crecen entre iteraciones y si necesitamos conservar sus gradientes. Para métricas que no necesitan backward suele bastar un valor separado del grafo.

`empty_cache()` devuelve bloques no ocupados de la caché; no elimina tensores vivos ni arregla una referencia que sigue reteniendo el grafo. La [documentación de esta función](https://docs.pytorch.org/docs/2.14/generated/torch.cuda.memory.empty_cache.html) delimita ese comportamiento.

Si el modelo necesita más memoria, podemos reducir batch, acumular gradientes, cambiar precisión o usar checkpointing de activaciones. Cada opción cambia costes o condiciones de equivalencia. Mediría cada efecto antes de aplicar todas a la vez y atribuir el resultado a una sola.

## Garantías y límites

Los valores son bytes reales del allocator durante entrenamiento CUDA, no memoria total del dispositivo. El proceso limita su presupuesto del allocator al 25% de la memoria visible. No se provoca un OOM de toda la GPU para buscar su capacidad máxima.

## Ejercicio: distinguir un máximo de una fotografía

Al acabar un update allocated es 90 MiB y peak allocated es 110 MiB. Explica por qué una captura al final habría ocultado 20 MiB de presión temporal y por qué eso no identifica automáticamente 20 MiB de activaciones.

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

- [contador max_memory_allocated](https://docs.pytorch.org/docs/2.14/generated/torch.cuda.memory.max_memory_allocated.html).
- [documentación de esta función](https://docs.pytorch.org/docs/2.14/generated/torch.cuda.memory.empty_cache.html).

Siguiente: [Transferencias a GPU: qué cambian pinned memory y non_blocking](/posts/gpu-transferencias-pinned-memory-non-blocking).
