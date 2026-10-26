---
id: "DL-POOLING"
title: "Pooling: qué información conserva y qué pierde una CNN al reducir un mapa"
published: "2026-10-26T00:02:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-pooling"
slug: "cnn-pooling-downsampling-gradientes-aliasing"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-CONV-GEOMETRY"]
description: "Qué cambia al sustituir una región por su máximo o su media. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Reducir un mapa de 24 × 24 a 12 × 12 abarata las operaciones posteriores, pero obliga a descartar información. Antes de añadir **pooling**, hay que saber qué resumen conserva y qué cambios de entrada deja de distinguir.

Tras [stride y padding](/posts/cnn-padding-stride-dilation-shapes), estudiaremos dos resúmenes sin pesos aprendidos: el máximo y la media de cada ventana. Ambos reducen resolución con stride 2, pero transmiten valores y gradientes diferentes.

## Max pooling conserva el valor más alto de una región

En una ventana 2 × 2:

```text
1  3
4  6
```

**Max pooling** produce 6. No conserva en su valor de salida si ese 6 estaba arriba o abajo. Tampoco describe el resto de intensidades. Conserva la respuesta más alta dentro de la región, que puede ser útil cuando interesa si aparece una activación fuerte cerca.

Con stride 2 y ventanas 2 × 2 sin padding, una entrada 4 × 4 genera cuatro resúmenes. En el probe completo la salida es:

```text
6  5
7  8
```

No hemos calculado una convolution con un kernel fijo. Elegir el máximo depende de los valores de la entrada y es una operación no lineal. Repetirlo por cada canal conserva el número de canales y reduce sus ejes espaciales.

## Average pooling conserva una media local

**Average pooling** suma los valores de la ventana y los divide por el número correspondiente. Para 1, 3, 4 y 6 obtenemos 3,5. El probe completo da:

```text
3.50  2.00
2.50  4.25
```

La media reparte la contribución entre los valores. Un pico aislado queda diluido. El máximo conserva ese pico, pero ignora cuánto contribuyen los demás valores. La tarea decide qué pérdida de información podemos aceptar.

<img src="/assets/visuals/convolutional-networks/DL-POOLING.svg" alt="Qué cambia al sustituir una región por su máximo o su media. Flujo de cálculo del laboratorio." width="364" height="676" loading="lazy" style="width:100%;max-width:364px;height:auto" />

En nuestra CNN usaremos max pooling para reducir el primer mapa. Más adelante **global average pooling** calculará una media espacial por canal para alimentar la clasificación. Son dos decisiones con posiciones y alcances diferentes en la arquitectura.

## El gradiente refleja cómo se construyó el resumen

En el laboratorio calculamos la derivada de la suma de las cuatro salidas respecto a la entrada. Para max pooling, cada ventana tiene un máximo único: la derivada vale 1 en ese máximo y 0 en las otras tres posiciones.

Para average pooling 2 × 2, cada valor recibe una cuarta parte de la derivada de su salida. Como aquí sumamos las salidas, el gradiente es 0,25 en las dieciséis posiciones.

```python
    a=pool_input[None,None];mx=F.max_pool2d(a,2);avg=F.avg_pool2d(a,2)
    mg=torch.autograd.grad(mx.sum(),pool_input,retain_graph=True)[0]
    ag=torch.autograd.grad(avg.sum(),pool_input)[0]
```

Los ejes añadidos representan batch y canal. Conservamos el grafo al pedir la primera derivada para poder consultar después la otra rama. No estamos entrenando parámetros de pooling: estamos viendo cómo propaga una derivada hacia operaciones anteriores.

Si las ventanas se solaparan, una entrada podría recibir contribuciones de varias salidas. Y si hubiera máximos empatados, necesitaríamos explicar qué posición selecciona la implementación. El test evita empates para aislar este mecanismo.

## Una tolerancia local al movimiento no garantiza invariancia

Colocamos un único píxel brillante en una entrada 8 × 8. Con max pooling 2 × 2, moverlo de columna 0 a 1 mantiene el mismo resumen: sigue dentro de la misma ventana. Moverlo a columna 2 cambia el bloque donde aparece el máximo.

Los tests comprueban ambas situaciones. El operador puede ocultar algunos movimientos pequeños y mostrar otros del mismo tamaño. Influyen la alineación de las ventanas y los bordes. Afirmar que pooling hace al modelo invariante a las traslaciones sería una promesa demasiado amplia.

## Reducir resolución también puede introducir aliasing

Un tablero alterno de ceros y unos permite ver el problema sin entrenar nada. Si tomamos una muestra cada dos columnas y filas, una alineación puede recuperar solo ceros y otra solo unos.

La media 2 × 2 de ese tablero da 0,5 en cada región. En este patrón concreto atenúa la alternancia antes de reducir resolución. Eso no demuestra que cualquier average pooling resuelva todo aliasing, ni que max pooling actúe como un filtro adecuado para cualquier señal.

**Downsampling** implica elegir qué variación queremos conservar. Una convolution con stride aprendido es otra opción, con parámetros y decisiones distintas; no elimina por definición los efectos del muestreo.

## El padding cambia según el operador

La documentación de [MaxPool2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MaxPool2d.html) describe padding implícito con infinito negativo. Si la entrada observada es −2, un borde artificial de ceros podría ganar el máximo: el probe comprueba que eso no ocurre.

En [AvgPool2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.AvgPool2d.html), `count_include_pad` decide si los ceros añadidos cuentan en el divisor. Una entrada de un solo valor 4, con ventana 2 y padding 1, produce 1 al incluirlos y 4 al excluirlos. El mismo relleno visual puede dar dos medias distintas.

## Garantías y límites

Los tests comprueban salidas, gradientes, máximos negativos, divisores y desplazamientos. El visor permite alternar máximo y media sobre los valores reales del probe.

No concluimos cuál de los dos operadores mejora una tarea real: no hemos entrenado una comparación emparejada entre esas arquitecturas. Tampoco medimos ahorro de tiempo a partir de la reducción de shape.

## Ejercicio: cambia la ventana, conserva la pregunta

Dibuja una ventana 2 × 2 con máximo único. Predice el gradiente de la suma de sus salidas. Después imagina ventanas solapadas con stride 1: localiza una entrada que recibiría contribuciones desde varias salidas y explica por qué ya no basta mirar una sola ventana.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/probes.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Referencias

- [MaxPool2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MaxPool2d.html).
- [AvgPool2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.AvgPool2d.html).

## Continuar la serie

Anterior: [Padding, stride y dilation: calcular el tamaño y la posición de cada salida](/posts/cnn-padding-stride-dilation-shapes). Siguiente: [Receptive field: qué parte de la imagen puede afectar a una activación](/posts/cnn-receptive-field-soporte-gradientes).
