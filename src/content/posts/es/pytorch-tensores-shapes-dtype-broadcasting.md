---
id: "P099"
title: "Tensores en PyTorch: una shape incorrecta puede cambiar el problema"
published: "2026-10-25T21:00:00Z"
locale: "es"
translationKey: "pytorch-training-p099"
slug: "pytorch-tensores-shapes-dtype-broadcasting"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ACCUMULATION", "DL-AUTODIFF"]
description: "Cómo controlar shape, dtype, device y broadcasting antes de entrenar. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Restar dos tensores puede producir una matriz de 4×4 cuando esperabas cuatro errores independientes. PyTorch no tiene por qué lanzar una excepción: las dimensiones son compatibles con **broadcasting**, aunque la operación ya no represente lo que querías calcular.

Después de [verificar las actualizaciones y la acumulación](/posts/gradient-accumulation-microbatches-media-ponderada), empezamos un entrenamiento completo con **PyTorch**. El primer contrato no es el optimizador: es el significado de los datos que entran y salen de cada operación.

## Un tensor tiene forma, tipo y ubicación

Un **tensor** puede representar un escalar, un vector, una matriz o datos con más ejes. Su **shape** describe las dimensiones; el significado de cada eje lo pone el programa. `(30,2)` podría ser un batch de 30 puntos con dos coordenadas, pero esos números por sí solos no explican qué contienen.

El **dtype** determina el tipo de sus elementos. El **device** indica dónde reside el tensor. En nuestro laboratorio todas las entradas, targets y capas usan `torch.float64` y CPU para facilitar el contraste numérico con la MLP NumPy anterior. PyTorch no exige float64 en todos los proyectos.

Las capas y los datos deben ser compatibles. Un tensor creado sin dtype explícito puede acabar en float32, mientras nuestro modelo está en float64. El test provoca esa incompatibilidad y comprueba que `Linear` la rechaza. No probamos GPU: cambiar el dispositivo plantea otras condiciones de ejecución y reproducibilidad.

## Broadcasting alinea dimensiones desde la derecha

Algunas operaciones permiten combinar ejes iguales o de tamaño uno, expandiendo lógicamente estos últimos. Es útil al sumar un bias de shape `(4,)` a activaciones `(30,4)`: el mismo vector contribuye a cada fila.

El problema aparece cuando esa expansión tiene otro significado. En `packages/pytorch-training/probes.py`:

```python
    logits = torch.tensor([[-2.],[-.5],[.5],[2.]], dtype=torch.float64)
    flat = torch.tensor([0.,1.,0.,1.], dtype=torch.float64)
    bad = logits - flat
    good = logits - flat[:, None]
```

`logits` tiene shape `(4,1)` y `flat`, `(4,)`. Al alinearlos, la resta combina cada logit con todos los targets y produce `(4,4)`. Convertir los targets en columna con `[:, None]` conserva el emparejamiento por muestra y produce `(4,1)`.

<img src="/assets/visuals/pytorch-training/P099.svg" alt="Cómo controlar shape, dtype, device y broadcasting antes de entrenar. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="354" height="596" loading="lazy" style="width:100%;max-width:354px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/P099.svg).

La media de los cuadrados de esos residuos es 2,625 en el caso expandido y 1,875 en el emparejado. Son dos funciones distintas. Un número finito y una shape aceptada por la resta no prueban que se esté resolviendo el problema correcto.

## BCE con logits no acepta ese desajuste de targets

El control anterior usa una resta y un error cuadrático para hacer visible el broadcasting. No debemos atribuir ese comportamiento a todas las losses. La función **binary cross entropy con logits** que empleamos rechaza los targets `(4,)` frente a logits `(4,1)`; el laboratorio comprueba también esa excepción real.

Nuestro helper `checked_loss` añade un contrato explícito: mismos ejes, dtype float64, valores finitos, targets binarios y una salida por muestra. Esto permite fallar cerca del origen del problema y no varias operaciones después.

No conviene arreglar una shape con `reshape` hasta que el programa deje de quejarse. Primero hay que identificar qué representa cada elemento. Eliminar una dimensión de tamaño uno podría ser correcto para una API y romper otra que espera una columna.

## Copiar NumPy o compartir su memoria es una decisión

El mismo archivo contiene este control independiente del dataset:

```python
    source = np.zeros((2, 2), dtype=np.float64)
    shared = torch.from_numpy(source)
    copied = torch.tensor(source)
    source[0, 0] = 9
```

Después del cambio, `shared[0,0]` vale 9 y `copied[0,0]` sigue en 0. **torch.from_numpy** comparte almacenamiento con ese array; **torch.tensor** crea aquí una copia.

Compartir puede evitar una copia, pero también permite que una modificación posterior del array cambie los datos que lee el modelo. Para este dataset pequeño preferimos una copia inicial: hace más fácil razonar sobre quién puede modificar las entradas originales. No estamos midiendo el coste de memoria de ninguna de las dos opciones.

## Los contratos deben comprobar datos, no solo ejemplos felices

Los tests ejecutan el forward con entradas `(4,2)`, verifican salida `(4,1)`, provocan el broadcasting de la resta y comprueban el rechazo de la loss. Además contrastan el forward inicial contra el modelo NumPy con los mismos pesos.

Una prueba con una sola muestra habría ocultado parte del error: `(1,1)` y `(1,)` se expanden sin crear una matriz mayor. Usamos varias filas para que el fallo sea observable.

El visor permite alternar entre los residuos expandidos y los emparejados. Son valores archivados de esas operaciones, no un entrenamiento nuevo dentro del navegador.

## Ejercicio: dibuja los ejes antes de operar

Escribe qué shapes producirían `(30,4) + (4,)` y `(30,1) - (30,)`. Identifica qué expansión es deseada y cuál mezcla muestras. Después cambia el selector del visor y señala qué celdas del caso 4×4 comparan un logit con el target de otra fila.

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

- [Broadcasting semantics](https://docs.pytorch.org/docs/2.14/notes/broadcasting.html).
- [torch.from_numpy y almacenamiento compartido](https://docs.pytorch.org/docs/2.14/generated/torch.from_numpy.html).

Continúa con [Dataset y DataLoader: quién decide qué muestras llegan al modelo](/posts/pytorch-dataset-dataloader-orden-batches).
