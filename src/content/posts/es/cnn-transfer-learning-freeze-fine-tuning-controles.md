---
id: "DL-TRANSFER-LEARNING"
title: "Transfer learning en una CNN: comparar freeze, fine-tuning y empezar de cero"
published: "2026-10-26T00:08:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-transfer-learning"
slug: "cnn-transfer-learning-freeze-fine-tuning-controles"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-CNN-ARCHITECTURES", "DL-CHECKPOINT"]
description: "Cuándo una representación aprendida ayuda en otra tarea y cómo comprobarlo. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Una red puede clasificar bien sus imágenes originales y aportar poco al reutilizarla en otra tarea. Para decidir si **transfer learning** ayuda, necesitamos comparar resultados con empezar de cero y precisar qué parte de la red se actualiza.

Tras [estudiar arquitecturas y shortcuts](/posts/cnn-arquitecturas-vgg-resnet-residual-blocks), retomamos la TinyCNN entrenada. Guardaremos su backbone, añadiremos una head nueva y mediremos cuatro alternativas sobre una tarea relacionada, con apariencia diferente.

## Qué se transfiere cuando cambiamos la head

El modelo source predice cuatro orientaciones. Su backbone produce ocho medias de activación y su head las combina en cuatro logits.

La tarea **target** distingue trazos alineados con los ejes frente a diagonales. Horizontal y vertical pasan a etiqueta 0; las dos diagonales pasan a etiqueta 1. También cambiamos el generador: fondo 0,25, contraste 0,5, ruido de desviación 0,08 y grosor entre 2 y 3. El resto de la geometría mantiene su protocolo.

Hay 32 imágenes train, ocho por orientación original, y 128 de validation, con seeds independientes 201 y 202. Las etiquetas binarias quedan equilibradas. La tarea es sintética y relacionada con source; no usamos pesos de ImageNet ni imágenes naturales.

Reutilizar el backbone conserva 336 parámetros. La nueva head 8→2 añade 18. El modelo target tiene 354 en total. Cargar estrictamente el state_dict de todo el modelo source fallaría por el tamaño diferente de la head. Por eso serializamos y cargamos solo el backbone.

<img src="/assets/visuals/convolutional-networks/DL-TRANSFER-LEARNING.svg" alt="Cuándo una representación aprendida ayuda en otra tarea y cómo comprobarlo. Flujo de cálculo del laboratorio." width="368" height="676" loading="lazy" style="width:100%;max-width:368px;height:auto" />

## Por qué reutilizar una representación puede ahorrar trabajo

Si source aprendió respuestas útiles para target, empezar con esos filtros puede requerir menos aprendizaje que construirlos otra vez. Congelar el backbone limita el ajuste a una head pequeña; resulta una alternativa cuando hay pocos datos, aunque la representación fija puede no conservar la información necesaria.

**Fine-tuning** permite adaptar esos filtros al nuevo problema, con más parámetros que optimizar y riesgo de sobreajustar o deteriorar respuestas útiles. Por eso comparamos ambas opciones con scratch: la afinidad entre tareas es una hipótesis que debemos comprobar.

## Cuatro controles separan decisiones distintas

<div role="region" aria-label="Tabla 1: Transfer learning en una CNN: comparar freeze, fine-tuning y empezar de cero" tabindex="0" style="overflow-x:auto;max-width:100%">

| Modo | Backbone inicial | Qué se actualiza |
| --- | --- | --- |
| Scratch | Aleatorio | Backbone y head |
| Random frozen | Aleatorio | Solo head |
| Frozen | Entrenado en source | Solo head |
| Fine-tune | Entrenado en source | Backbone y head |

</div>

**Random frozen** es un control útil: una representación aleatoria puede conservar información suficiente para entrenar alguna separación. Si solo comparáramos una head entrenada con no tener modelo, no sabríamos qué aporta haber entrenado previamente los filtros.

Para cada seed, los cuatro modos comparten exactamente la head inicial. Scratch y random frozen comparten su backbone aleatorio. Frozen y fine-tune reciben los pesos del mismo source de esa seed. El informe conserva cambios máximos de parámetros para comprobar qué se actualizó realmente.

## Freeze, eval y no_grad resuelven preguntas diferentes

`requires_grad_(False)` desactiva el cálculo de gradientes para los parámetros del backbone. El optimizador del modo frozen recibe solo los parámetros entrenables de la head.

```python
    model.frozen=mode in ['frozen','random_frozen']
    model.backbone.requires_grad_(not model.frozen)
```

En cada epoch del modo congelado, el loop activa train para el modelo y vuelve a poner su backbone en eval. Su forward se ejecuta dentro de no_grad; la head conserva el grafo necesario para aprender.

Estas decisiones son explícitas aunque nuestro backbone no tenga Dropout ni BatchNorm. En una arquitectura que sí los tuviera, congelar parámetros no desactivaría por sí solo sus cambios de comportamiento o de estadísticas. Los tests observan el modo y el registro de gradientes dentro del forward congelado, además de comprobar que sus pesos no cambian.

En fine-tune todos los parámetros se actualizan. El backbone usa learning rate 0,001 y la head 0,01. En los demás modos entrenables usamos 0,01. Una tasa menor en pesos reutilizados es una decisión del protocolo; no garantiza conservar información útil ni superar otras variantes.

## Un presupuesto igual en updates no iguala toda la dificultad

Cada run target hace cuarenta epochs de batch 16: ochenta updates. Todos usan los mismos datos y orden. Frozen y random frozen entrenan 18 parámetros; scratch y fine-tune, 354.

Igualar el número de updates no iguala el número de parámetros, la condición inicial ni el mejor learning rate de cada estrategia. Tampoco hemos hecho una búsqueda equivalente de hiperparámetros. Presentamos una comparación controlada bajo el protocolo declarado, no una competición exhaustiva entre métodos.

Usamos el último checkpoint, sin escoger después el mínimo de validation. Las tres seeds cambian inicialización, pero comparten los datasets; no son tres muestras independientes de población.

## En este protocolo empezar de cero funciona mejor

Accuracy final en validation target:

<div role="region" aria-label="Tabla 2: Transfer learning en una CNN: comparar freeze, fine-tuning y empezar de cero" tabindex="0" style="overflow-x:auto;max-width:100%">

| Seed | Scratch | Random frozen | Frozen | Fine-tune |
| --- | --- | --- | --- | --- |
| 7 | 0,960938 | 0,789063 | 0,515625 | 0,453125 |
| 19 | 0,960938 | 0,625000 | 0,500000 | 0,492188 |
| 31 | 0,976563 | 0,406250 | 0,539063 | 0,539063 |

</div>

<img src="/assets/interactive/convolutional-networks/transfer-curves.svg" alt="Validation loss target de cuatro estrategias con seed 7 durante cuarenta epochs. La reutilización de pesos no obtiene el mejor resultado en este protocolo." width="380" height="326" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Los tres source habían alcanzado accuracy 1 en su validation. Aun así, reutilizar sus pesos no gana en esta comparación target. En seed 7, por ejemplo, frozen acaba con loss 0,934501 frente a 0,549632 de scratch.

No sabemos cuánto corresponde al cambio de apariencia, a la nueva agrupación de clases, a la inicialización o al presupuesto de optimización. No aislamos cada una de esas causas. Un experimento posterior podría modificar una a la vez, con decisiones y evaluación definidas antes de medir.

El resultado tampoco demuestra que transfer learning sea peor en general. Demuestra que el éxito en source no basta para justificarlo y que aquí la alternativa entrenada desde cero debe conservarse como baseline.

## Garantías y límites

Se escriben y leen archivos reales del backbone dentro de un directorio temporal propio, con carga en CPU y `weights_only=True`. No distribuimos checkpoints ejecutables en el blog ni descargamos pesos externos.

Los tests comprueban inicialización emparejada, shapes, parámetros congelados intactos y head modificada. El verificador repite los quince entrenamientos: tres source y doce target. No exige que transferir mejore, porque eso no define la corrección de su implementación.

Para un uso real necesitamos comprobar el contrato de preprocesado, canales, normalización, tarea de origen, licencia y evaluación independiente. El [tutorial de transfer learning de PyTorch](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html) muestra estrategias de ajuste y extracción de características con modelos preentrenados. Aquí probamos esas decisiones con un backbone propio y dejamos para P104 técnicas de adaptación más amplias, como LoRA.

## Ejercicio: diseña una comparación que aísle una causa

Conserva la tarea target, pero plantea un experimento que cambie solo su apariencia o solo sus etiquetas respecto a source. Escribe qué comparación permitiría atribuir un cambio a ese factor y qué datos reservarías para evaluar la decisión final. No elijas los parámetros después de consultar esa evaluación.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/networks.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Explorar las observaciones

<iframe src="/assets/interactive/convolutional-networks/explorer.html" title="Explorar ventanas, pooling, mapas reales y transferencia de una CNN" loading="lazy" style="width:100%;height:1200px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el laboratorio interactivo](/assets/interactive/convolutional-networks/explorer.html).

## Referencias

- [Transfer Learning for Computer Vision, PyTorch](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html).

## Continuar la serie

Anterior: [Arquitecturas CNN: qué cambia al apilar kernels o añadir un residual block](/posts/cnn-arquitecturas-vgg-resnet-residual-blocks). La siguiente serie empieza por [embeddings y símbolos](/posts/embeddings-tokens-tabla-vectores-padding) antes de desarrollar RNN, LSTM y GRU.
