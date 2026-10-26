---
id: "DL-CNN-TRAIN"
title: "Entrenar una CNN pequeña: datos, logits y un protocolo que se puede repetir"
published: "2026-10-26T00:05:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-cnn-train"
slug: "cnn-pequena-entrenamiento-protocolo-logits"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-CONV-CHANNELS", "DL-TORCH-LOOP"]
description: "Cómo pasar de operadores aislados a un clasificador entrenado verificable. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Una CNN que acierta cuatro dibujos no demuestra que pueda reconocer objetos en una fotografía. Sí puede servir para comprobar un pipeline completo si sabemos cómo se generaron las imágenes, qué pesos se entrenaron y con qué datos se evaluaron.

Después de [contar canales y parámetros](/posts/cnn-canales-filtros-parametros-compartidos), entrenaremos la red de 372 parámetros. La tarea consiste en distinguir cuatro orientaciones de un trazo: horizontal, vertical y las dos diagonales.

## Las imágenes varían aunque compartan orientación

El generador produce imágenes de un canal, 24 × 24, con intensidades en [0, 1]. Para cada trazo varía el centro hasta cuatro píxeles alrededor de la zona central, la semilongitud entre 6 y 10, que da longitudes totales de 12 a 20 píxeles y el grosor entre 1 y 2. Añade fondo 0,05, contraste 0,85 y ruido gaussiano de desviación 0,035 antes de limitar el rango.

Las cuatro clases usan el mismo mecanismo de variación. No añadimos una marca distinta en una esquina para identificar la etiqueta. El protocolo y el generador permiten inspeccionar qué información correlaciona con la clase.

Separamos 256 imágenes de **train**, 64 por orientación, y 128 de **validation**, 32 por orientación. Sus generadores NumPy usan seeds 101 y 102. Se crean una vez por split; recorrer más epochs no genera nuevas imágenes ni nuevas muestras independientes.

Las imágenes sintéticas evitan una descarga y permiten controlar el experimento. También limitan lo aprendido: validar en el mismo generador no evalúa fotografías, otros estilos de trazo ni condiciones de captura.

## El backbone transforma mapas; la head produce logits

El recorrido para un batch de tamaño N es:

<div role="region" aria-label="Tabla 1: Entrenar una CNN pequeña: datos, logits y un protocolo que se puede repetir" tabindex="0" style="overflow-x:auto;max-width:100%">

| Operación | Shape de salida |
| --- | --- |
| Entrada | N × 1 × 24 × 24 |
| Conv1 y ReLU | N × 4 × 24 × 24 |
| Max pooling 2 × 2 | N × 4 × 12 × 12 |
| Conv2 y ReLU | N × 8 × 12 × 12 |
| Global average pooling y flatten | N × 8 |
| Linear | N × 4 |

</div>

El padding de las convolutions mantiene su resolución. Pooling la reduce una vez. La media global reúne las posiciones de cada canal y deja ocho valores para la head. **ReLU** añade las no linealidades entre transformaciones aprendidas.

<img src="/assets/visuals/convolutional-networks/DL-CNN-TRAIN.svg" alt="Cómo pasar de operadores aislados a un clasificador entrenado verificable. Flujo de cálculo del laboratorio." width="391" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La head entrega **logits**, cuatro puntuaciones sin normalizar. **CrossEntropyLoss** recibe esos logits y un target entero por imagen, con valores de 0 a 3. No aplicamos softmax antes de la loss; para presentar probabilidades en el visor sí lo aplicamos a los logits ya capturados.

## El presupuesto se fija antes de observar la curva

Usamos float32 en CPU, tres inicializaciones 7, 19 y 31, cuarenta epochs, batch 32 y Adam con learning rate 0,01. La inicialización de las convolutions sigue He y la head Xavier, con bias cero.

Cada epoch recorre ocho batches: son 320 updates y 10 240 presentaciones de muestras por run. Las tres seeds comparten los mismos datasets y orden de batches, generado con una seed dedicada 420. Cambia la inicialización de los pesos.

En `training.py`, el núcleo conserva el contrato de [nuestro loop PyTorch](/posts/pytorch-training-loop-zero-grad-backward-step):

```python
            optimizer.zero_grad(set_to_none=True)
            loss=nn.functional.cross_entropy(model(x),y)
            loss.backward()
            optimizer.step();updates+=1
```

Limpiar el gradiente evita acumulaciones involuntarias. La derivada se calcula respecto a la loss del batch y `step` modifica los parámetros. La historia se evalúa después a pesos fijos: no mezclamos losses online de estados distintos como si correspondieran a un único checkpoint.

## Validation observa el modelo y no elige el checkpoint

Antes de entrenar y después de cada epoch, `metrics` activa eval y desactiva el registro de gradientes. Calcula loss media y accuracy en los splits completos.

Aquí guardamos el último estado de la epoch 40 sin elegir el mínimo de validation. No usamos test final ni buscamos hiperparámetros después de ver resultados. Para comparar generalización en una aplicación necesitaríamos otro diseño de evaluación y datos representativos del uso.

El informe archiva hashes de ambos datasets, fuentes, protocolo y runtime. Eso ayuda a detectar cambios, pero el verificador también vuelve a entrenar: un hash no prueba por sí solo que la implementación calcula lo correcto.

## Qué observamos en las tres inicializaciones

<div role="region" aria-label="Tabla 2: Entrenar una CNN pequeña: datos, logits y un protocolo que se puede repetir" tabindex="0" style="overflow-x:auto;max-width:100%">

| Seed | Train loss final | Validation loss final | Validation accuracy |
| --- | --- | --- | --- |
| 7 | 0,004931 | 0,006117 | 1 |
| 19 | 0,006091 | 0,006876 | 1 |
| 31 | 0,006370 | 0,007919 | 1 |

</div>

<img src="/assets/interactive/convolutional-networks/source-curves.svg" alt="Train y validation loss de las cuarenta epochs del modelo source con seed 7. Ambas usan pesos fijos en cada evaluación." width="380" height="310" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La accuracy perfecta corresponde a estas 128 imágenes de validation. No establece calibración de probabilidades, resistencia a perturbaciones o dominio de la visión artificial. La siguiente tarea cambiará aspecto y etiquetas, y mostrará que este éxito no garantiza transferir bien.

La loss distingue además entre acertar una clase y asignar una puntuación relativa más separada. Dos modelos con la misma accuracy pueden tener losses diferentes. Ninguna de esas métricas explica todavía qué hace un canal concreto.

## Garantías y límites

Los tests comprueban shapes, tipos, rango de entrada, separación de datasets, registro de parámetros y contrato de la loss. El verificador reproduce los quince entrenamientos del laboratorio completo, incluidos estos tres source, con tolerancias numéricas declaradas.

No se mide latencia, memoria ni rendimiento de GPU. Fijar seeds y runtime reduce variación, pero no promete igualdad bit a bit entre equipos. Tampoco se convierte este resultado pequeño en una comparación con otras arquitecturas que no entrenamos.

## Ejercicio: distingue más trabajo de más información

Duplica las epochs sin cambiar el generador ni los splits en un experimento nuevo. Antes de ejecutarlo, escribe qué aumenta: ¿updates, muestras distintas o ambas cosas? Define qué resultado aceptarías como evidencia de mejora y con qué datos lo comprobarías.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/training.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Referencias

- [CrossEntropyLoss](https://docs.pytorch.org/docs/2.14/generated/torch.nn.CrossEntropyLoss.html).
- [Adam](https://docs.pytorch.org/docs/2.14/generated/torch.optim.Adam.html).

## Continuar la serie

Anterior: [Canales y filtros: cómo una convolution combina varios mapas](/posts/cnn-canales-filtros-parametros-compartidos). Siguiente: [Feature maps: inspeccionar una CNN sin inventar lo que ha aprendido](/posts/cnn-feature-maps-activaciones-interpretacion).
