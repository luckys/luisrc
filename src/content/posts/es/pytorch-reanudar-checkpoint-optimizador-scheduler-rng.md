---
id: "DL-RESUME"
title: "Reanudar un entrenamiento PyTorch: por qué guardar los pesos no basta"
published: "2026-10-25T21:06:00Z"
locale: "es"
translationKey: "pytorch-training-dl-resume"
slug: "pytorch-reanudar-checkpoint-optimizador-scheduler-rng"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-CHECKPOINT"]
description: "Cómo reproducir una continuación de entrenamiento en un límite de epoch. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Recuperar los mismos pesos no garantiza que el siguiente update sea el mismo. Momentum conserva historia, el scheduler conserva un reloj y el loader conserva un generador que ya ha avanzado. Reiniciar cualquiera de ellos crea una continuación distinta.

Después de [guardar para inferencia](/posts/pytorch-guardar-cargar-state-dict-predicciones), el objetivo cambia: queremos interrumpir tras la epoch 30 y llegar al mismo estado que un entrenamiento continuo de 60 epochs.

## Elegimos un límite de epoch que podemos reproducir

El checkpoint se toma después de consumir el loader entero y avanzar el scheduler. En ese punto conocemos la epoch completada, el número de updates y la tasa preparada para el siguiente recorrido.

Con 256 muestras y batch 30, la epoch 30 deja 270 updates ejecutados. No queda un minibatch parcialmente procesado ni un grupo de acumulación abierto. La función rechaza guardar si la sesión está marcada dentro de una epoch.

Esto acota la garantía. Reanudar a mitad de recorrido necesitaría además representar qué muestras quedan, el estado pertinente del sampler, posibles colas de workers y cualquier otra fuente de trabajo en curso. No se ha probado ese caso.

## Qué guardamos además del modelo

En `packages/pytorch-training/checkpoints.py`, el payload incluye:

```python
                      'optimizer':copy.deepcopy(session.optimizer.state_dict()),
                      'scheduler':copy.deepcopy(session.scheduler.state_dict()),
                      'loaderRng':session.generator.get_state(), 'torchRng':torch.get_rng_state(),
                      'history':session.history,'trace':session.trace})
```

El estado del optimizador conserva los buffers de momentum. El scheduler conserva la fase del calendario. El generador del loader permite continuar el orden aleatorio; la seed inicial sola no describe cuánto ha avanzado.

También guardamos esquema, protocolo, seed de inicialización, epoch, updates y estado del modelo. Historial y traza sirven para verificar y visualizar la ejecución, no son necesarios por sí mismos para calcular el próximo gradiente.

La MLP no usa aleatoriedad en el forward. Aun así se captura y verifica el RNG de CPU de PyTorch. El control que cambia el orden muestra la fuente aleatoria que afecta a este entrenamiento. No afirmamos haber probado la restauración de dropout, GPU, augmentations o RNG externos.

<img src="/assets/visuals/pytorch-training/DL-RESUME.svg" alt="Cómo reproducir una continuación de entrenamiento en un límite de epoch. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="288" height="1008" loading="lazy" style="width:100%;max-width:288px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/DL-RESUME.svg).

## Restauramos después de construir los objetos

Primero creamos modelo, optimizador, scheduler y loader con el mismo protocolo. Después aplicamos sus estados. Crear capas consume aleatoriedad; restaurar el RNG antes de construirlas dejaría de representar el punto guardado.

La rama completa restaura el scheduler ya construido y el optimizador, luego el generador del loader y finalmente el RNG global de CPU:

```python
        if variant != 'order_reset':
            session.generator.set_state(payload['loaderRng'])
        # Restore after constructing and loading objects that could consume RNG.
        torch.set_rng_state(payload['torchRng'])
```

Las variantes del código son controles deliberados del experimento, no recuperaciones automáticas cuando falta estado. Un checkpoint con tipo o protocolo incompatible provoca error. También cargamos este diccionario con `weights_only=True`: esa opción de deserialización es distinta del control llamado `weights_only`, que omite restaurar estado de entrenamiento.

## La prueba importante compara trayectorias, no solo una cifra final

Ejecutamos un run continuo, otro que se detiene y guarda, y cuatro continuaciones desde el archivo. La completa reproduce exactamente historial, órdenes y parámetros en este runtime. Las incompletas muestran:

<div role="region" aria-label="Controles de reanudación" tabindex="0" style="overflow-x:auto">

| Continuación | Qué se reinicia | Máximo error final de parámetros frente al continuo |
| --- | --- | ---: |
| Completa | Nada de lo declarado | 0 |
| `optimizer_reset` | Buffers, conservando tasa y reloj | 0,014657 |
| `order_reset` | Generador del orden | 0,003181 |
| `weights_only` | Estado de entrenamiento salvo modelo e historial | 0,340889 |

</div>

<img src="/assets/interactive/pytorch-training/resume-errors.svg" alt="Máximo error final de parámetros respecto al entrenamiento continuo. La reanudación completa tiene error0; reiniciar momentum,orden o estado de entrenamiento produce desviaciones. Esto mide fidelidad,no calidad predictiva." width="380" height="350" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/pytorch-training/resume-errors.svg).

La variante que carga solo el modelo termina con validation BCE 0,005949, frente a 0,008309 del continuo. No es un error de la tabla: durante su continuación usa otro estado y otro calendario efectivo. Una loss menor no demuestra fidelidad a la trayectoria que se pretendía reanudar.

Por eso el test exige igualdad con el continuo para la rama completa y una desviación observable para los controles incompletos. Una prueba que solo exigiera «la loss baja después de cargar» dejaría pasar esos fallos.

## La igualdad observada tiene un entorno concreto

El experimento usa CPU, float64, un thread, cero workers, datos sintéticos fijos y algoritmos deterministas habilitados. Se fijan las versiones y la image del runtime. La reproducción vuelve a ejecutar entrenamiento y archivos, no se limita a comparar hashes.

No se promete igualdad bit a bit entre versiones de PyTorch, equipos, CPU y GPU o implementaciones distribuidas. Tampoco basta con activar una opción determinista para capturar fuentes de estado que el programa no haya incluido.

Los loaders de evaluación no barajan y no tienen transformaciones aleatorias. Sus generadores no influyen en las actualizaciones en esta configuración. Ampliar el pipeline obligaría a revisar de nuevo qué estado necesita viajar en el checkpoint.

## Ejercicio: diseña una prueba que rechace una falsa reanudación

Elige el control de orden en el visor y compara epochs 30 y 31 con el continuo. Explica por qué coinciden hasta el punto guardado y empiezan a diferir después. Después decide qué compararías, además de la loss, si añadieras un scheduler distinto o acumulación de gradientes.

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

- [Reproducibilidad y fuentes de aleatoriedad](https://docs.pytorch.org/docs/2.14/notes/randomness.html).
- [Serialización y weights_only](https://docs.pytorch.org/docs/2.14/notes/serialization.html#torch-load-with-weights-only-true).
- [Estado de DataLoader y generadores](https://docs.pytorch.org/docs/2.14/data.html).

El [bloque de overfitting e inestabilidad](/posts/overfitting-underfitting-curvas-error-generalizacion) continúa la serie. Este pipeline deja preparadas curvas, splits y checkpoints para que esos diagnósticos se apoyen en experimentos verificables.
