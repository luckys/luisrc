---
id: "P102"
title: "Embeddings: convertir símbolos en vectores sin inventar un orden entre sus IDs"
published: "2026-10-26T01:00:00Z"
locale: "es"
translationKey: "recurrent-sequences-p102"
slug: "embeddings-tokens-tabla-vectores-padding"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P099", "P100"]
description: "Qué aprende una tabla de embeddings y qué significa seleccionar una fila. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

Pasar un ID entero a una red como si fuera una medida introduce una relación que quizá no existe. El símbolo 6 no tiene por qué ser el doble de importante que el 3, ni estar más cerca del 7 en el sentido que necesita la tarea.

Un **embedding** asigna un vector aprendido a cada símbolo. En esta serie lo usaremos para alimentar redes recurrentes, seguir su estado y entrenar dos tareas pequeñas: recordar un símbolo y continuar una secuencia. Empezamos por comprobar qué hace esa tabla, antes de atribuir significado a sus vectores.

## Un ID identifica una categoría, no una magnitud

Nuestro vocabulario tiene diez IDs. Reservamos 0 para **PAD**, 8 para **BOS** y 9 para **EOS**. Los demás representan símbolos de tareas sintéticas; sus números permiten indexar la tabla, no medir una propiedad física.

La tabla de embeddings tiene shape 10 × 8. Cada fila contiene ocho parámetros. Si la entrada tiene shape `(batch, tiempo)`, seleccionar sus filas produce `(batch, tiempo, 8)`.

El tamaño ocho es una decisión de arquitectura. Con más dimensiones aumentaría la cantidad de parámetros y cambiaría la representación disponible. No obtendríamos automáticamente ocho conceptos humanos ni una dimensión por cada significado del símbolo.

<img src="/assets/visuals/recurrent-sequences/P102.svg" alt="Qué aprende una tabla de embeddings y qué significa seleccionar una fila. Relación de entradas, estados y decisiones del cálculo contrastado." width="382" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La tabla del clasificador de memoria tiene ochenta parámetros, incluidos los ocho de la fila PAD registrada en el módulo. Esa fila se conserva a cero en nuestro entrenamiento. Contar parámetros registrados y contar valores que reciben actualizaciones son preguntas diferentes.

## Seleccionar una fila equivale en el forward a multiplicar un one-hot

Para ID 2, un vector **one-hot** contiene un 1 en la posición 2 y ceros en las demás. Multiplicarlo por la matriz de embeddings recupera su tercera fila, contando desde cero.

El test contrasta ambas operaciones:

```python
        expected=nn.functional.one_hot(ids,10).float()@e.weight
        torch.testing.assert_close(e(ids),expected)
```

La selección directa evita construir explícitamente ese vector grande. Lo que aprendemos es la matriz, no el ID entero ni el vector one-hot. Las derivadas llegan a las filas consultadas por la tarea.

Esta equivalencia describe los valores del forward. `padding_idx` añade una regla especial al gradiente que no debemos atribuir sin más a una multiplicación one-hot corriente.

## Las repeticiones acumulan contribuciones en la misma fila

El test usa IDs `[1, 2, 1, 0]` y suma todos los componentes de sus embeddings. La fila 1 aparece dos veces, así que cada uno de sus componentes recibe gradiente 2. La fila 2 recibe una contribución. PAD no recibe gradiente por el lookup configurado para omitirlo.

En una red entrenada el gradiente será otro: dependerá de cómo cada vector afecta a la loss. La acumulación sigue siendo relevante. Repetir un símbolo no crea parámetros nuevos para cada aparición; se reutiliza la misma fila y se suman sus contribuciones.

La tabla se aprende junto con el resto de la red. No descargamos vectores de otro modelo ni aplicamos un tokenizer de lenguaje natural: el generador ya produce los IDs de nuestro vocabulario cerrado.

## La inicialización no trae similitud semántica incorporada

Inicializamos las filas con valores normales de desviación 0,2 usando un generador dedicado. Después fijamos PAD a cero. El estado de entrenamiento de una GRU produce esta tabla:

<img src="/assets/interactive/recurrent-sequences/embedding-table.svg" alt="Tabla de embeddings entrenada de GRU seed 7, diez IDs por ocho dimensiones, con una escala simétrica que conserva valores negativos, cero y positivos." width="380" height="396" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El color representa el valor de cada componente. No permite concluir que una fila «significa memoria» o que dos símbolos cercanos formen una categoría útil fuera del entrenamiento.

En nuestra tarea solo algunos IDs aparecen como entradas del clasificador. BOS y EOS se usan en el otro modelo, que tiene su propia tabla. Una fila que no participa en esa tarea no puede interpretarse como una representación aprendida de su función.

Las distancias entre embeddings pueden estudiarse, pero su utilidad depende del objetivo, los datos y cómo se consume la representación. No tenemos aquí un sistema de búsqueda semántica ni evidencia sobre palabras de un idioma.

## Padding cero no impide que el estado recurrente cambie

La documentación de [Embedding](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Embedding.html) describe el tratamiento de `padding_idx`. En nuestro modelo, además, inicializamos explícitamente esa fila a cero y no aplicamos weight decay.

Un vector cero reduce una contribución de entrada. La celda recurrente todavía puede combinar el estado anterior con pesos y biases. Por tanto, procesar cuatro pasos PAD puede alterar el estado aunque todos sus embeddings sean cero.

Usaremos longitudes reales y **packed sequences** para omitir esos pasos. Es una responsabilidad distinta de decidir qué gradiente recibe la fila PAD.

## Garantías y límites

Los tests contrastan lookup y one-hot, gradientes de símbolos repetidos y la fila de padding. Otro test comprueba que PAD sigue a cero después de entrenar. El verificador vuelve a entrenar todos los modelos y compara sus tablas y observaciones.

El ejemplo tiene un vocabulario fijo. No implementa subword tokenization, símbolos desconocidos ni crecimiento de la tabla al servir un modelo. En un sistema real, el mapeo entre símbolos e IDs forma parte del artefacto: cambiarlo sin adaptar los pesos cambia qué vector recibe cada entrada.

## Ejercicio: cambia los IDs conservando lo que representan

Intercambia los IDs de dos símbolos y explica qué filas tendrías que intercambiar también para conservar el forward. Después predice qué ocurriría si solo cambiases el mapeo de entrada y dejaras la tabla igual. Usa esa diferencia para justificar por qué vocabulario y pesos deben viajar juntos.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/networks.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Referencias

- [Embedding](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Embedding.html).

## Continuar la serie

Siguiente: [Hidden state: qué conserva una red entre símbolos y qué aprende entre batches](/posts/hidden-state-recurrencia-estado-pesos).
