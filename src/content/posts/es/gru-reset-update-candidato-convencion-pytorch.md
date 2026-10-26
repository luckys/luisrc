---
id: "DL-GRU"
title: "GRU: combinar estado y candidato sin una cell state separada"
published: "2026-10-26T01:05:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-gru"
slug: "gru-reset-update-candidato-convencion-pytorch"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-LSTM"]
description: "Cómo actúan reset y update y por qué importa la convención del candidato. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

La **GRU** regula cuánto conserva del estado anterior y cuánto incorpora de una propuesta nueva, usando un único estado recurrente. Tiene menos bloques de parámetros que nuestra LSTM, pero eso no decide por sí solo cuál conviene a una tarea.

Después de [seguir las puertas de LSTM](/posts/lstm-cell-state-input-forget-output-gates), reconstruiremos reset, update y candidate. También comprobaremos una diferencia entre formulaciones que puede romper un cálculo manual aparentemente razonable.

## Update mezcla el estado anterior con una propuesta

La GRU del laboratorio calcula dos puertas sigmoid, $r_t$ y $z_t$, y una propuesta $n_t$. Su combinación final es:

$$
h_t=(1-z_t)\odot n_t+z_t\odot h_{t-1}.
$$

En esta convención, update cercano a 1 conserva más del estado anterior. Cerca de 0 incorpora más del candidato. Algunos textos eligen nombres o coeficientes complementarios: conviene leer la ecuación antes de traducir «abrir update» a una acción concreta.

No hay una cell state separada que viaje junto a hidden state. Eso simplifica la interfaz de estados y reduce parámetros frente a la LSTM de nuestro ejemplo. No implica que exista una relación uno a uno entre sus componentes internos.

<img src="/assets/visuals/recurrent-sequences/DL-GRU.svg" alt="Cómo actúan reset y update y por qué importa la convención del candidato. Relación de entradas, estados y decisiones del cálculo contrastado." width="429" height="696" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Reset regula la contribución recurrente al candidato

Nuestra implementación sigue la convención de PyTorch:

$$
r_t=\sigma(W_{ir}x_t+b_{ir}+W_{hr}h_{t-1}+b_{hr}),
$$

$$
z_t=\sigma(W_{iz}x_t+b_{iz}+W_{hz}h_{t-1}+b_{hz}),
$$

$$
n_t=\tanh\left(W_{in}x_t+b_{in}+r_t\odot(W_{hn}h_{t-1}+b_{hn})\right).
$$

Reset cercano a cero reduce esa contribución recurrente a la propuesta. La combinación final todavía puede conservar estado anterior a través de update. Por eso «reset borra toda la memoria» no describe correctamente el bloque completo.

En `cells.py`, `xi` y `hh` reúnen las transformaciones de entrada y estado. Después se separan sus tres bloques:

```python
        reset=torch.sigmoid(ir+hr);update=torch.sigmoid(iz+hz)
        candidate=torch.tanh(inn+reset*hn)
        next_h=(1-update)*candidate+update*h;next_c=None
```

Los nombres `inn` y `hn` corresponden a las contribuciones al candidato. `hn` ya incluye su bias recurrente antes de multiplicarse por reset.

## Aplicar reset antes o después de una matriz no es intercambiable

Otra formulación construye la contribución como $W_{hn}(r_t\odot h_{t-1})+b_{hn}$. En general no coincide con $r_t\odot(W_{hn}h_{t-1}+b_{hn})$.

Una matriz mezcla componentes. Multiplicar cada componente antes de mezclarlos no equivale a multiplicar los resultados después. Además, el bias queda afectado de forma distinta.

El probe usa dos componentes, una matriz con entradas fuera de la diagonal y puertas diferentes por componente. El resultado de la fórmula manual coincide con GRUCell. La alternativa intercambiada produce un error máximo aproximado **0,078622**.

Una sola unidad o una matriz especialmente elegida podría ocultar esa diferencia. El test está diseñado para distinguir las dos operaciones. La documentación de [GRU](https://docs.pytorch.org/docs/2.14/generated/torch.nn.GRU.html) señala la diferencia respecto a la formulación original y otros frameworks.

## Compartir interfaz no iguala el coste

Con input size 8 y hidden size 16 tenemos tres bloques recurrentes de 416 parámetros: 1 248. Sumamos ochenta del embedding y treinta y cuatro de la head para obtener **1 362 parámetros registrados**.

La LSTM del laboratorio tiene 1 778 y la RNN 530. Esas cuentas se prueban sobre los módulos, no se deducen de una gráfica de accuracy. Tampoco sustituyen una medición de tiempo, memoria o throughput en el entorno de uso.

Las tres arquitecturas reciben los mismos datasets y orden de batches. Entrenan ochenta epochs y se conserva el último estado. No se busca el mejor learning rate de cada una ni se iguala su cantidad de parámetros.

## La GRU resuelve el control, sin convertirlo en una victoria universal

Las tres inicializaciones GRU obtienen accuracy 1 en validation y en longitudes de 4 a 96. RNN y LSTM también aciertan todos esos probes.

La GRU permite consultar sus puertas a lo largo de las secuencias de longitud 12 y 48. Un valor grande de update en un ejemplo es una activación concreta, no una regla global del modelo ni una prueba de que ese componente tenga un significado humano estable.

El [trabajo de Cho y colaboradores](https://arxiv.org/abs/1406.1078) sitúa estas unidades en un modelo encoder-decoder. Nuestro clasificador de memoria no reproduce su traducción automática ni su comparación experimental.

## Garantías y límites

Los tests contrastan cada paso del cálculo manual, la convención del candidato, las shapes y el tratamiento de padding. El verificador vuelve a entrenar y reconstruye estados y gradientes de las tres seeds.

No hemos concluido que GRU sea siempre una opción intermedia entre RNN y LSTM. La decisión real depende de la tarea, sus dependencias, los datos disponibles y mediciones con presupuestos adecuados.

## Ejercicio: construye un caso que revele la diferencia

Elige dos componentes con reset distinto y una matriz que intercambie sus posiciones. Compara aplicar reset antes o después de esa matriz, primero sin bias y después con él. Explica por qué un test con reset uniforme y matriz identidad habría sido menos útil.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/cells.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Referencias

- [GRU, convención de PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.GRU.html).
- [Cho et al., 2014](https://arxiv.org/abs/1406.1078).

## Continuar la serie

Anterior: [LSTM: seguir qué se conserva, qué se escribe y qué se expone](/posts/lstm-cell-state-input-forget-output-gates). Siguiente: [Gradientes a través del tiempo: perder sensibilidad no equivale a olvidar al predecir](/posts/rnn-vanishing-exploding-gradients-dependencias-largas).
