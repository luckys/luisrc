---
id: "DL-LSTM"
title: "LSTM: seguir qué se conserva, qué se escribe y qué se expone"
published: "2026-10-26T01:04:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-lstm"
slug: "lstm-cell-state-input-forget-output-gates"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-RNN"]
description: "Qué cambia al separar cell state y hidden state con puertas aprendidas. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

Conservar información y exponerla a la siguiente capa no siempre deberían ser la misma operación. **LSTM** separa una cell state interna de la hidden state visible y aprende cómo modificar y consultar esa memoria.

Tras [reconstruir una RNN con tanh](/posts/rnn-tanh-unroll-bptt-memoria), seguiremos la variante moderna de LSTM que ejecuta PyTorch. Sus puertas ofrecen caminos para conservar información, pero no garantizan recordar cualquier cosa durante cualquier cantidad de pasos.

## La cell state tiene un camino de actualización aditivo

Una celda recibe $x_t$, $h_{t-1}$ y $c_{t-1}$. Primero construye cuatro vectores a partir de transformaciones de entrada y hidden state. Tres pasan por sigmoid; la propuesta de contenido pasa por tanh.

Usando $a_i,a_f,a_g,a_o$ para las cuatro preactivaciones:

$$
\begin{aligned}
i_t &= \sigma(a_i),\\
f_t &= \sigma(a_f),\\
g_t &= \tanh(a_g),\\
o_t &= \sigma(a_o).
\end{aligned}
$$

La actualización combina conservar y escribir:

$$
\begin{aligned}
c_t &= f_t\odot c_{t-1}+i_t\odot g_t,\\
h_t &= o_t\odot\tanh(c_t).
\end{aligned}
$$

$\odot$ significa multiplicación elemento a elemento. Cada puerta tiene un valor por componente; no es una única decisión para toda la secuencia.

<img src="/assets/visuals/recurrent-sequences/DL-LSTM.svg" alt="Qué cambia al separar cell state y hidden state con puertas aprendidas. Relación de entradas, estados y decisiones del cálculo contrastado." width="397" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

En `cells.py`, las cuatro partes se extraen en orden input, forget, candidate y output:

```python
        i,f,g,o=(xi+hh).chunk(4,-1)
        i,f,g,o=i.sigmoid(),f.sigmoid(),g.tanh(),o.sigmoid()
        next_c=f*c+i*g
        next_h=o*next_c.tanh()
```

Las transformaciones `xi` y `hh` contienen las contribuciones de entrada y estado anterior, incluidos sus biases. El código usa exactamente los pesos de la celda que contrasta con PyTorch; no dibuja unas puertas desvinculadas del forward.

## Forget conserva una fracción; input regula la escritura

Si un componente de forget está cerca de 1, ese camino conserva buena parte del componente anterior de cell state. Cerca de 0 lo reduce mucho. Input controla cuánto se incorpora de la propuesta con signo $g_t$.

No son puertas booleanas que un programador abre con un `if`. Sus valores son continuos y dependen de las entradas y estados. Se aprenden sus pesos, mientras las activaciones de las puertas se recalculan en cada paso.

La metáfora de memoria ayuda si conservamos ese matiz: no tenemos celdas de una base de datos con campos asignados a conceptos. El modelo puede distribuir información entre componentes y usar combinaciones difíciles de interpretar por separado.

## Output decide qué parte se expone en hidden state

La cell state se transforma con tanh y se multiplica por output para producir hidden state. Eso permite separar el contenido interno de la respuesta que llega a la head y al cálculo de las próximas puertas.

La API devuelve ambos estados finales. Nuestra head clasifica usando $h_n$, no $c_n$. Al inspeccionar una LSTM en el visor puedes consultar los dos y seguir cómo cambian junto con sus puertas.

En una secuencia rellenada seguimos necesitando las longitudes válidas. Tener cell state no convierte PAD en una instrucción automática de mantener el estado sin cambios.

## Una puerta cercana a uno no demuestra gradiente total constante

Si fijamos las puertas y miramos solo el camino directo de $c_{t-1}$ a $c_t$, aparece el factor $f_t$. Un producto de factores próximos a uno puede conservar mejor esa contribución que otro que se contrae rápidamente.

Pero las puertas también dependen de hidden states anteriores, que dependen de cell states. La derivada total incluye esos caminos adicionales. No podemos sustituir toda la red por $\prod f_t$ y garantizar que ningún gradiente se pierda o explote.

El control posterior `c_t=0,99·c_{t-1}` fija deliberadamente el coeficiente para aislar ese camino. No se presenta como la derivada completa de una LSTM entrenada.

## Más mecanismos implican más parámetros

Con entrada 8 y hidden size 16, la parte recurrente de esta variante tiene cuatro veces los parámetros de la transición simple: 1 664. Embedding y head añaden 114, con **1 778 parámetros registrados** en total.

La RNN del laboratorio tiene 530 y la GRU 1 362. Mantener hidden size igual facilita comparar interfaces, pero no iguala capacidad ni operaciones. No hemos medido que una sea más rápida o más eficiente con un presupuesto de memoria fijo.

Nuestra LSTM obtiene accuracy 1 en las tres inicializaciones y en los seis probes de longitud. También lo hacen RNN y GRU. Por tanto, esta tarea no respalda un ranking de calidad entre ellas.

## La fórmula moderna y la primera publicación no son idénticas

El trabajo de **Hochreiter y Schmidhuber** de 1997 introdujo LSTM para abordar el aprendizaje a distancia. La arquitectura evolucionó después; no atribuimos sin matices la forget gate moderna a esa primera formulación.

Aquí la referencia operativa es la [LSTM de PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.LSTM.html), que especifica las ecuaciones que contrastamos. El [artículo de 1997](https://people.idsia.ch/~juergen/lstm1997-2024head.pdf) aporta el contexto histórico, no un benchmark que nuestro código haya reproducido.

## Garantías y límites

Los tests contrastan hidden state y cell state paso a paso con LSTMCell, verifican rangos de puertas y comparan packed batches con ejecuciones individuales. El entrenamiento usa una capa unidireccional sin peepholes ni proyecciones.

No se estudia aquí olvido entre tareas ni memoria de documentos completos. El resultado corresponde a un bit sintético y no elimina la necesidad de diseñar una evaluación representativa para otra tarea.

## Ejercicio: conserva contenido sin exponerlo todavía

Escoge un componente con cell state anterior 0,8. Propón valores de forget, input, candidate y output que conserven aproximadamente ese contenido y produzcan una hidden state pequeña. Calcula ambas salidas y explica por qué conservar y exponer requieren variables distintas.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/cells.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Consultar estados y predicciones

<iframe src="/assets/interactive/recurrent-sequences/explorer.html" title="Explorar embeddings, celdas, memoria y generación con resultados reales" loading="lazy" style="width:100%;height:1200px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor de secuencias](/assets/interactive/recurrent-sequences/explorer.html).

## Referencias

- [LSTM, ecuaciones de PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.LSTM.html).
- [Long Short-Term Memory, 1997](https://people.idsia.ch/~juergen/lstm1997-2024head.pdf).

## Continuar la serie

Anterior: [RNN con tanh: compartir una transición y entrenarla a través del tiempo](/posts/rnn-tanh-unroll-bptt-memoria). Siguiente: [GRU: combinar estado y candidato sin una cell state separada](/posts/gru-reset-update-candidato-convencion-pytorch).
