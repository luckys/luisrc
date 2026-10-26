---
id: "DL-RNN"
title: "RNN con tanh: compartir una transición y entrenarla a través del tiempo"
published: "2026-10-26T01:03:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-rnn"
slug: "rnn-tanh-unroll-bptt-memoria"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-SEQUENCE-LENGTHS"]
description: "Cómo funciona una recurrencia simple y qué demuestra un predictor de memoria. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

Una RNN reutiliza la misma transición en cada instante. Desplegarla en un dibujo con muchos bloques puede hacer pensar que aprendemos una red distinta para cada posición, pero sus pesos siguen siendo compartidos.

Después de [respetar las longitudes reales](/posts/secuencias-longitudes-variables-padding-packed), podemos entrenar una **RNN con tanh** y seguir tanto el forward como el gradiente. La tarea será recordar un único bit tras varios distractores, no reconstruir toda la secuencia.

## La transición combina entrada y estado anterior

Nuestra RNN calcula:

$$
h_t=\tanh(W_{ih}x_t+b_{ih}+W_{hh}h_{t-1}+b_{hh}).
$$

$x_t$ tiene ocho componentes del embedding; $h_t$ tiene dieciséis. La matriz de entrada transforma 8→16 y la recurrente transforma 16→16. PyTorch registra dos biases, cuyas contribuciones se suman.

En `cells.py` reconstruimos las dos transformaciones antes de aplicar tanh:

```python
    xi=F.linear(x,weights(module,'weight_ih'),weights(module,'bias_ih'))
    hh=F.linear(h,weights(module,'weight_hh'),weights(module,'bias_hh'))
```

El caso RNN aplica `torch.tanh(xi+hh)`. El helper admite pesos de una celda y de una capa de una sola dirección para contrastar ambos recorridos. No hay una matriz nueva al pasar de $t=1$ a $t=2$.

**Tanh** mantiene cada componente entre −1 y 1. Eso no acota por sí solo toda derivada del entrenamiento: también interviene la matriz recurrente al propagar cambios a través del tiempo.

## Unroll hace visibles las dependencias temporales

Desplegar la recurrencia muestra una aplicación de la misma función por cada símbolo. El estado calculado en un paso alimenta al siguiente. Para producir el estado final, los pasos de esta implementación dependen de los anteriores.

<img src="/assets/visuals/recurrent-sequences/DL-RNN.svg" alt="Cómo funciona una recurrencia simple y qué demuestra un predictor de memoria. Relación de entradas, estados y decisiones del cálculo contrastado." width="340" height="676" loading="lazy" style="width:100%;max-width:340px;height:auto" />

Durante **backpropagation through time**, la derivada recorre ese grafo desplegado. Un peso compartido puede haber influido en varias posiciones, así que su gradiente reúne esas contribuciones. No hacemos un update independiente que borre el estado entre cada símbolo.

En el laboratorio procesamos cada secuencia válida completa dentro de un batch, calculamos una loss final y hacemos un step del optimizador. Se reinicia el estado entre muestras independientes. No truncamos el gradiente dentro de las longitudes de entrenamiento.

## El predictor tiene una pista inicial y un final marcado

Cada secuencia comienza por 1 o 2, que determina la etiqueta binaria. En medio aparecen distractores de IDs 3 a 6. El último símbolo real es QUERY=7. El modelo debe decidir qué símbolo vio al principio.

Train contiene 512 secuencias equilibradas de longitudes 4 a 12; validation, 256 generadas con otra seed. Los interiores y longitudes se generan sin usar la etiqueta. Un clasificador que solo viera QUERY recibiría siempre el mismo símbolo y no podría distinguir las dos clases equilibradas en los probes.

Usamos embedding 8, hidden size 16 y una head lineal de dos logits. Los parámetros registrados suman:

$$
80+(16\cdot8+16\cdot16+32)+(16\cdot2+2)=530.
$$

La fila PAD de la tabla está incluida en esa cuenta, aunque el lookup no la actualiza. La loss es CrossEntropyLoss sobre los logits finales; no aplicamos softmax antes.

## El presupuesto permite comparar sin igualar la capacidad

Entrenamos ochenta epochs, batch 64, ocho updates por epoch: **640 updates** por modelo. Adam usa learning rate 0,01 y clipping de norma global 1, con error ante valores no finitos.

Hay tres inicializaciones, 7, 19 y 31. RNN, LSTM y GRU comparten los datasets y el orden de batches. Sus embeddings y heads iniciales se igualan por seed; sus parámetros recurrentes tienen formas distintas y no se presentan como idénticos.

Igualar updates no iguala cantidad de parámetros, tiempo o el mejor ajuste de hiperparámetros. No hemos medido rendimiento de hardware ni buscado la mejor configuración de cada arquitectura.

## La RNN resuelve también las longitudes mayores de este control

Las tres inicializaciones terminan con accuracy 1 en validation. Después evaluamos 128 secuencias equilibradas por longitud 4, 8, 12, 24, 48 y 96. La RNN también obtiene accuracy 1 en todos esos probes.

<img src="/assets/interactive/recurrent-sequences/memory-curves.svg" alt="Accuracy de validation durante ochenta epochs para RNN, LSTM y GRU con seed 7, usando los mismos datos y presupuesto de updates." width="380" height="336" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Este resultado impide usar el laboratorio para afirmar que toda RNN olvida al aumentar la longitud. Guardar dos estados distinguibles puede bastar para conservar un bit. No exige representar una historia arbitraria ni discriminar cientos de contenidos diferentes.

Eso no elimina el problema de gradientes que se contraen al aprender dependencias largas. Veremos que la sensibilidad local del logit respecto al primer embedding puede ser muy pequeña mientras la predicción final sigue siendo correcta.

## Garantías y límites

Los tests contrastan tres pasos de la celda manual con RNNCell y comprueban que las trazas con los pesos entrenados coinciden con la capa nativa dentro de tolerancias. El verificador vuelve a entrenar y recalcula métricas, estados y gradientes.

La evaluación a longitudes no usadas en train es un diagnóstico de extrapolación para este generador. No es un benchmark de comprensión, lenguaje o memoria universal. Tampoco se usa para escoger el checkpoint: conservamos la epoch 80 fijada de antemano.

## Ejercicio: cambia qué información debe sobrevivir

Compara recordar un bit con reconstruir los diez primeros símbolos de una secuencia. Explica qué cambia en el contenido que necesita conservar el estado, aunque la separación temporal sea la misma. Propón una baseline y una evaluación antes de ejecutar ese nuevo experimento.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/cells.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Referencias

- [RNN](https://docs.pytorch.org/docs/2.14/generated/torch.nn.RNN.html).

## Continuar la serie

Anterior: [Longitudes variables: evitar que padding se convierta en parte de la secuencia](/posts/secuencias-longitudes-variables-padding-packed). Siguiente: [LSTM: seguir qué se conserva, qué se escribe y qué se expone](/posts/lstm-cell-state-input-forget-output-gates).
