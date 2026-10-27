---
id: "DL-GPU-DETERMINISM"
title: "Determinism en GPU: reproducir cálculos sin prometer tiempos idénticos"
published: "2026-10-27T01:07:00Z"
locale: "es"
translationKey: "gpu-training-dl-gpu-determinism"
slug: "gpu-determinism-seeds-tiempos-reproducibles"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GPU-PROFILER"]
description: "Qué controla una seed y qué debe mantenerse fijo para interpretar una repetición. Código, medidas reales y límites de una captura CPU/CUDA."
author: "Luis Ramírez Calle"
series: "Entrenar en GPU: cómputo, memoria y mediciones fiables"
tags: ["deep-learning", "gpu", "pytorch", "performance"]
---

Fijar una seed puede hacer que dos entrenamientos produzcan los mismos pesos y, aun así, tarden distinto. **Determinism** del cálculo y estabilidad del tiempo son requisitos diferentes.

Después de [leer una traza CPU y CUDA](/posts/pytorch-profiler-cpu-kernels-tiempo-wall), cerramos el bloque preguntando qué se reproduce y qué variación debe seguir visible.

## La seed controla generadores, no todo el sistema

El modelo se construye en CPU con seed 17 antes de copiarse al dispositivo. Los datos usan un generador independiente con seed 223. Así partimos de los mismos valores.

Eso no fuerza el mismo orden de reducción, la misma biblioteca o el mismo kernel entre hardware y versiones. Tampoco fija el estado de un optimizer que ya recibió updates.

Continuar un entrenamiento real exige más que pesos: optimizer, scaler, scheduler, estado RNG y posición en los datos pueden afectar a los siguientes pasos. El checkpoint debe describir qué continuación permite.

<img src="/assets/visuals/gpu-training/DL-GPU-DETERMINISM.svg" alt="Qué controla una seed y qué debe mantenerse fijo para interpretar una repetición. El diagrama sigue las operaciones y decisiones concretas del laboratorio." width="457" height="836" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Las opciones deterministas forman parte del protocolo

Fragmento del [laboratorio ejecutado](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/gpu-training), con imports y contexto completos en las fuentes enlazadas al final:

```python
def configure(protocol):
    torch.set_num_threads(protocol['cpuThreads'])
    torch.use_deterministic_algorithms(protocol['determinism']['algorithms'])
    torch.backends.cuda.matmul.fp32_precision = 'ieee'
    torch.backends.cudnn.conv.fp32_precision = 'ieee'
    if torch.cuda.is_available():
        torch.cuda.set_per_process_memory_fraction(protocol['memoryFraction'])
```

Pedimos algoritmos deterministas cuando PyTorch puede proporcionarlos y deshabilitamos TF32 para el FP32 comparado. El runner fija `CUBLAS_WORKSPACE_CONFIG=:4096:8` antes de importar y ejecutar el programa.

No garantiza determinismo de cualquier operación futura. Algunas requieren restricciones adicionales o fallan si no hay una implementación compatible. La [nota de reproducibilidad de PyTorch](https://docs.pytorch.org/docs/2.14/notes/randomness.html) delimita garantías entre ejecuciones y entornos.

Limitar el allocator al 25% es una decisión de recursos, no una condición matemática de determinismo. Tampoco limita lo que ocupen otros procesos.

## Qué repetición se comprobó

El control construye dos veces el modelo CUDA con los mismos inputs y hace tres updates FP32 en el mismo proceso y runtime. Las losses coinciden exactamente y el máximo cambio entre pesos finales es cero.

<div role="region" aria-label="Repetición breve en el mismo proceso" tabindex="0" style="overflow-x:auto;max-width:100%">

| Update | Loss en ambas repeticiones |
| --- | --- |
| 1 | 2,795145 |
| 2 | 1,922281 |
| 3 | 1,192404 |

</div>

Es evidencia acotada. No prueba igualdad bit a bit entre CPU y GPU ni después de actualizar PyTorch o CUDA. Pequeñas diferencias de redondeo pueden propagarse durante un entrenamiento largo.

No buscamos una seed que dé un resultado conveniente: se fija antes de observar el benchmark. Para estudiar variación estadística de calidad usaríamos varias inicializaciones y splits adecuados. Aquí no medimos calidad.

## El reloj también observa el entorno

Frecuencias, temperatura, procesos concurrentes y planificación del sistema cambian los tiempos aunque coincidan los valores calculados. Hacer deterministas los kernels no fija esas condiciones.

Conservamos cinco muestras por configuración y una mediana declarada. El visor muestra las muestras en su orden original. No eliminamos las más lentas para mejorar el número.

El orden de configuraciones se baraja con una seed fijada para que las variantes de una precisión no ocupen siempre la misma posición. Una pasada no es un estudio completo de deriva térmica o variación entre sesiones.

## Auditar no equivale a ejecutar otra captura

`verify` comprueba hashes, medianas, throughput, controles y traza original. No entrena otra vez ni exige repetir los mismos segundos.

`reobserve` ejecuta otra captura real y la guarda separada bajo `/tmp`, sin sustituir automáticamente la referencia. Permite contrastar otra ejecución sin reescribir la historia de la anterior.

Si una repetición contradice la conclusión, hay que conservarla y revisar protocolo o interpretación. Repetir hasta conseguir el número deseado es selección de resultados.

## Garantías y límites

Se fijan fuentes, digest, configuración y datos. El control prueba repetición numérica breve en el mismo entorno. Los tiempos siguen siendo observaciones sujetas a variación, no constantes del programa.

## Ejercicio: decidir qué debe repetir un test

Clasifica igualdad de hashes, proximidad de logits y tiempo por update. Explica en cuál exigirías igualdad exacta, en cuál tolerancia numérica y en cuál conservarías una distribución de muestras.

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

- [nota de reproducibilidad de PyTorch](https://docs.pytorch.org/docs/2.14/notes/randomness.html).

Conserva esta captura como referencia y fija otro protocolo que incluya las fases y métricas de tu sistema antes de trasladar sus conclusiones.
