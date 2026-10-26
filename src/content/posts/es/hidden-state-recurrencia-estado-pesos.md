---
id: "DL-HIDDEN-STATE"
title: "Hidden state: qué conserva una red entre símbolos y qué aprende entre batches"
published: "2026-10-26T01:01:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-hidden-state"
slug: "hidden-state-recurrencia-estado-pesos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P102"]
description: "Cómo distinguir el estado de una secuencia de los parámetros compartidos. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

Un clasificador recurrente puede producir respuestas diferentes si conserva por accidente el estado de la secuencia anterior. El modelo no ha aprendido necesariamente otra regla: puede estar recibiendo un contexto que no pertenece al ejemplo actual.

Después de [convertir símbolos en embeddings](/posts/embeddings-tokens-tabla-vectores-padding), debemos decidir qué información atraviesa los pasos de una misma secuencia y dónde termina su recorrido. Esa información es el **hidden state**, no los pesos del modelo.

## El estado se calcula para una entrada; los pesos se comparten

Una transición recurrente transforma el vector actual $x_t$ y el estado anterior $h_{t-1}$ en un estado nuevo:

$$
h_t=F_\theta(x_t,h_{t-1}).
$$

Los parámetros $\theta$ son los mismos en todos los pasos. El estado cambia al procesar cada símbolo. Durante entrenamiento, el optimizador modifica los parámetros a partir de gradientes; no guarda un estado independiente como parámetro para cada secuencia del dataset.

Un ejemplo sencillo es leer `1, 4, 6, 7`. El primer estado puede conservar información sobre el 1 mientras llegan los distractores. Al recibir QUERY=7, la head intenta recuperar cuál era el primer símbolo.

El estado tiene dieciséis componentes en nuestro laboratorio. No hay un componente asignado de antemano a cada posición ni un registro que conserve la entrada completa. La transición aprende qué información puede representar en ese espacio para la tarea.

<img src="/assets/visuals/recurrent-sequences/DL-HIDDEN-STATE.svg" alt="Cómo distinguir el estado de una secuencia de los parámetros compartidos. Relación de entradas, estados y decisiones del cálculo contrastado." width="433" height="550" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La salida por paso y el estado final resuelven contratos distintos

Para un batch de N secuencias de longitud T, nuestra capa devuelve respuestas por paso con shape N × T × 16. También devuelve un estado final con un eje de capas: 1 × N × 16 en la red unidireccional de una sola capa.

Para clasificar la secuencia nos interesa su estado final real. Para predecir el siguiente símbolo en cada posición, interesa una salida por paso. Elegir un tensor porque sus dimensiones «encajan» puede llevar a resolver una tarea distinta.

LSTM mantiene dos estados: **hidden state** y **cell state**. El helper que alimenta nuestra head selecciona el hidden state de la última capa:

```python
    hidden=state[0] if isinstance(state,tuple) else state
    return hidden[-1]
```

Este código corresponde a una capa y una dirección. En una red bidireccional o con más capas habría que decidir qué estados combinar. No se extiende esa selección por intuición sin revisar los ejes.

## Reiniciamos el estado porque las muestras son independientes

Nuestro modelo llama a la capa sin proporcionar un estado previo. PyTorch inicia ese recorrido con ceros. Cada fila del batch representa una secuencia distinta; no reutilizamos el final del ejemplo anterior.

Eso hace que el orden de evaluación de las muestras no introduzca contexto ajeno. Los tests contrastan un batch de longitudes desordenadas con ejecutar cada muestra por separado.

En un flujo continuo, por ejemplo una señal dividida en fragmentos consecutivos, puede tener sentido conservar estado entre fragmentos del mismo flujo. Entonces hay que mantener su asociación con la secuencia correcta y decidir qué hacer al empezar otro flujo, reordenar el batch o perder un fragmento.

No implementamos ese servicio stateful aquí. El laboratorio trabaja con secuencias independientes y conserva ese contrato durante entrenamiento y evaluación.

## Separar el grafo no borra los valores del estado

Al entrenar con fragmentos largos puede interesar usar **truncated BPTT**. Conservar un estado pero aplicar `detach` corta el camino del gradiente hacia fragmentos anteriores; sus valores siguen llegando al siguiente fragmento.

Reiniciar a cero elimina ese contexto. Son dos decisiones diferentes. Confundirlas puede alterar lo que el modelo recibe o la distancia temporal sobre la que aprende.

Nuestro entrenamiento hace backpropagation a través de cada secuencia válida completa, de longitud 4 a 12. No usa truncated BPTT ni conserva el grafo entre batches. Las pruebas a longitud 96 son recorridos de evaluación, no entrenamientos con un grafo de noventa y seis pasos.

## Una predicción correcta no identifica cómo se distribuye la memoria

El predictor recuerda un bit. Puede hacerlo con una representación que cambia entre pasos o con estados que conservan una separación estable entre dos casos. La accuracy final no permite elegir una explicación concreta de ese mecanismo.

El visor muestra componentes del estado y puertas reconstruidas con los pesos reales. Los logits intermedios se obtienen aplicando la head final a esas respuestas. Esa head solo recibió supervisión en el final de la tarea de memoria: no presentamos cada puntuación intermedia como una predicción entrenada para esa posición.

## Garantías y límites

Los tests comprueban shapes, estado final y coincidencia entre el forward y el recorrido de celdas reconstruido. El control de padding muestra que incluso una entrada cero puede seguir transformando un estado.

No afirmamos que dieciséis números almacenen toda la historia ni que una representación útil en esta tarea sirva para cualquier secuencia. La ventaja práctica de una recurrencia es consumir entradas de forma ordenada manteniendo un estado de tamaño fijo. A cambio, ese estado se convierte en el lugar donde debe sobrevivir la información que la tarea necesita.

## Ejercicio: define el contrato antes de conservar estado

Imagina que llegan fragmentos de dos señales A y B intercalados. Explica qué información necesitas para conservar el estado de cada una sin mezclarlas. Después decide en qué situaciones reiniciarías sus valores y en cuáles cortarías solo el grafo del gradiente.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/networks.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Referencias

- [RNN: outputs y estados](https://docs.pytorch.org/docs/2.14/generated/torch.nn.RNN.html).

## Continuar la serie

Anterior: [Embeddings: convertir símbolos en vectores sin inventar un orden entre sus IDs](/posts/embeddings-tokens-tabla-vectores-padding). Siguiente: [Longitudes variables: evitar que padding se convierta en parte de la secuencia](/posts/secuencias-longitudes-variables-padding-packed).
