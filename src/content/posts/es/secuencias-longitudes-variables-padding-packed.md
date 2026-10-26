---
id: "DL-SEQUENCE-LENGTHS"
title: "Longitudes variables: evitar que padding se convierta en parte de la secuencia"
published: "2026-10-26T01:02:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-sequence-lengths"
slug: "secuencias-longitudes-variables-padding-packed"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-HIDDEN-STATE"]
description: "Cómo formar batches sin confundir el final real con el último índice rellenado. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

En un batch rellenado, el último índice del tensor no siempre es el final de una secuencia. Si una muestra termina en el paso 3 y otra en el 5, seleccionar indiscriminadamente `output[:, -1]` puede usar estados que ya han procesado padding.

Tras [distinguir estado y parámetros](/posts/hidden-state-recurrencia-estado-pesos), vamos a conservar el final real de cada ejemplo. La solución empieza por guardar sus longitudes, no por esperar que un embedding cero detenga la celda.

## Padding permite formar un tensor rectangular

Estas secuencias tienen longitudes 3, 5 y 2:

```text
1  3  7  0  0     longitud 3
2  4  5  6  7     longitud 5
1  7  0  0  0     longitud 2
```

Los ceros ocupan posiciones de almacenamiento. No son símbolos observados de las secuencias. Al agruparlas obtenemos un tensor 3 × 5 que podemos convertir en embeddings 3 × 5 × 8.

Cada longitud debe viajar con su muestra. Ordenar las filas sin ordenar también longitudes y targets rompe esa relación aunque todos los tamaños sigan siendo válidos.

<img src="/assets/visuals/recurrent-sequences/DL-SEQUENCE-LENGTHS.svg" alt="Cómo formar batches sin confundir el final real con el último índice rellenado. Relación de entradas, estados y decisiones del cálculo contrastado." width="401" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Nuestro generador produce el último símbolo QUERY en `length - 1` y rellena lo que viene después. El modelo rechaza longitudes cero o superiores al eje temporal. Aceptar una longitud incorrecta desplazaría qué datos considera válidos.

## Una entrada cero puede producir otro estado

La recurrencia combina entrada, estado anterior y biases. En un control de una sola unidad, fijamos pesos y biases a 0,5 y empezamos con estado 0,2. Cuatro entradas cero producen aproximadamente:

<div role="region" aria-label="Tabla 1: Longitudes variables: evitar que padding se convierta en parte de la secuencia" tabindex="0" style="overflow-x:auto;max-width:100%">

| Pasos PAD procesados | Estado |
| --- | --- |
| 0 | 0,200000 |
| 1 | 0,800499 |
| 2 | 0,885406 |
| 3 | 0,894240 |
| 4 | 0,895122 |

</div>

No hay información nueva en la entrada, pero el estado cambia. Este control descarta la idea de que `padding_idx=0` basta para conservar el final real de cualquier red recurrente.

En un clasificador unidireccional también podríamos reunir `output[i, lengths[i]-1]` si solo nos interesa ese punto y los pasos posteriores no afectan hacia atrás en el forward. Eso no evita calcular padding. En otras arquitecturas, como una capa bidireccional sin tratamiento de longitudes, el problema requiere más cuidado.

## Packed sequences describen qué filas siguen activas

Usamos `pack_padded_sequence` para representar únicamente los pasos válidos antes de llamar a la capa recurrente:

```python
        packed=pack_padded_sequence(embedded,lengths.cpu(),batch_first=True,enforce_sorted=False)
        _,state=self.core(packed)
        return last_hidden(state)
```

La función recibe las longitudes en CPU y `batch_first=True` declara el orden lógico de la entrada. `enforce_sorted=False` permite entregar filas sin ordenarlas previamente. La implementación gestiona su orden interno y devuelve el estado final asociado a las muestras originales.

El test no se limita a comprobar el tamaño. Ejecuta el batch desordenado anterior y contrasta sus logits con los de cada secuencia individual. También añade cuatro columnas extra de PAD y exige que el resultado no cambie.

La documentación de [pack_padded_sequence](https://docs.pytorch.org/docs/2.14/generated/torch.nn.utils.rnn.pack_padded_sequence.html) concreta este contrato. No utilizamos una máscara de atención de Transformer; packed sequences y masking son mecanismos diferentes.

## Omitir padding en la loss es otra responsabilidad

La tarea de memoria tiene un target por secuencia. La tarea de continuación tendrá un target por paso. En este segundo caso, si rellenamos targets, PAD no debe aportar una pérdida como si fuera un símbolo real que queremos predecir.

El probe de loss usa dos secuencias con cuatro y tres targets válidos. Se suma la pérdida de los siete elementos y se divide por siete. Promediar primero cada secuencia y después ambas medias asignaría otro peso a cada token.

`ignore_index=PAD` evita contribuir por esas posiciones. No repara por sí solo un estado recurrente que ya haya procesado entradas inadecuadas. Las longitudes y la máscara de loss deben responder a sus respectivos contratos.

## Longitud cero, truncamiento y EOS requieren decisiones explícitas

Aquí no aceptamos secuencias vacías en el clasificador. Al añadir EOS en generación, ese símbolo sí es un target válido: queremos aprender cuándo terminar. PAD solo completa almacenamiento.

Truncar una secuencia larga para que quepa en un límite puede eliminar la información que define su etiqueta. Para nuestra tarea, quitar el primer símbolo destruye la pista necesaria. No basta con ajustar el entero de longitud después de cortar datos.

Para mejorar rendimiento podríamos agrupar muestras por longitud y reducir relleno. No lo medimos ni lo presentamos como una aceleración observada. El laboratorio prioriza comprobar que distintas formas de agrupar conservan el significado de cada secuencia.

## Garantías y límites

Los tests cubren las tres arquitecturas, orden original, comparación individual, padding adicional y longitudes inválidas. Los datos de entrenamiento varían entre 4 y 12 pasos. Las longitudes mayores aparecen después en probes de evaluación separados.

Solo usamos una capa unidireccional. No se han verificado stacks bidireccionales, workers o reanudación a mitad de un batch packed. Ampliar el pipeline obligaría a revisar esos contratos.

## Ejercicio: encuentra un bug que una shape correcta no detecta

Intercambia las longitudes de la primera y la tercera muestra manteniendo iguales sus tokens y targets. Explica qué dato pasaría a tratarse como padding o como símbolo real. Diseña una aserción que detecte el fallo aunque el tensor de logits conserve shape 3 × 2.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/networks.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

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

- [pack_padded_sequence](https://docs.pytorch.org/docs/2.14/generated/torch.nn.utils.rnn.pack_padded_sequence.html).

## Continuar la serie

Anterior: [Hidden state: qué conserva una red entre símbolos y qué aprende entre batches](/posts/hidden-state-recurrencia-estado-pesos). Siguiente: [RNN con tanh: compartir una transición y entrenarla a través del tiempo](/posts/rnn-tanh-unroll-bptt-memoria).
