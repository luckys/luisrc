---
id: "DL-CONV-GEOMETRY"
title: "Padding, stride y dilation: calcular el tamaño y la posición de cada salida"
published: "2026-10-26T00:01:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-conv-geometry"
slug: "cnn-padding-stride-dilation-shapes"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P101"]
description: "Cómo anticipar el tamaño y las coordenadas sin ensayar tensores al azar. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Cambiar el stride puede romper la capa siguiente aunque el código de la convolution siga siendo válido. Añadir padding hasta que desaparece el error tampoco explica qué píxeles acaba usando cada salida.

Después de [calcular una convolution](/posts/cnn-convolution-kernel-cross-correlation), necesitamos anticipar dos cosas: cuántas ventanas caben y dónde cae cada una. Eso permite diseñar la red y detectar un desplazamiento que una comprobación de shapes por sí sola no encontraría.

## Stride es el avance entre ventanas

El **stride**, que llamaremos $s$, indica cuánto se mueve el origen de la ventana para calcular la siguiente salida. Con stride 1 examinamos orígenes consecutivos. Con stride 2 saltamos dos posiciones de entrada entre orígenes.

Ese salto reduce normalmente la resolución del mapa. No significa que cada ventana contenga la mitad de pesos ni que hagamos una media de dos salidas. Seguimos aplicando el mismo kernel en menos posiciones.

Para nuestra entrada 5 × 5 y kernel 2 × 2, sin padding, stride 1 produce 4 × 4 y stride 2 produce 2 × 2. En el segundo caso los orígenes válidos por eje son 0 y 2. Un origen en 4 necesitaría otra muestra fuera de la entrada.

## Padding define qué ocurre fuera de la imagen

El **padding** incorpora valores alrededor de la entrada. Aquí usamos ceros. Con padding simétrico $p=1$, el eje de longitud 5 dispone de una extensión de longitud 7 para colocar ventanas.

Los ceros no son píxeles observados. Son una hipótesis sobre el borde. Una ventana que los toca mezcla datos reales con ese valor añadido. Por eso conservar el tamaño de un mapa no implica que las posiciones interiores y las de borde se hayan tratado de la misma manera.

<img src="/assets/visuals/convolutional-networks/DL-CONV-GEOMETRY.svg" alt="Cómo anticipar el tamaño y las coordenadas sin ensayar tensores al azar. Flujo de cálculo del laboratorio." width="376" height="676" loading="lazy" style="width:100%;max-width:376px;height:auto" />

El padding puede ayudar a conservar resolución y a incluir zonas de borde en más ventanas. Otra decisión sería usar un modo de relleno distinto o aceptar que la salida se reduzca. Conviene elegirlo según qué representa la entrada, no como un arreglo automático de dimensiones.

## Dilation separa las muestras dentro de una ventana

La **dilation**, $d$, indica la distancia entre posiciones vecinas del kernel sobre la entrada. Un kernel de tamaño 2 y dilation 2 consulta los offsets 0 y 2. Deja un hueco entre ambas muestras.

El alcance efectivo del kernel en un eje es:

$$
E=d(k-1)+1.
$$

Para $k=2,d=2$, ese alcance es 3. Seguimos teniendo dos pesos en ese eje, no tres. En dos dimensiones, un kernel 2 × 2 mantiene cuatro pesos aunque sus cuatro muestras ocupen las esquinas de una región 3 × 3.

Dilation amplía alcance sin añadir esos pesos intermedios. También cambia qué posiciones se muestrean. Un soporte más amplio con huecos no equivale a aplicar un kernel denso de mayor tamaño.

## El tamaño de salida cuenta los orígenes válidos

Con padding simétrico y sin redondeo hacia arriba, por cada eje:

$$
H_{out}=\left\lfloor\frac{H+2p-d(k-1)-1}{s}\right\rfloor+1.
$$

Primero descontamos el alcance efectivo de la longitud disponible. Después contamos los avances completos de stride que caben y añadimos el origen inicial. La misma cuenta se hace para el ancho; no exige que la imagen sea cuadrada.

Ejemplos del laboratorio:

<div role="region" aria-label="Tabla 1: Padding, stride y dilation: calcular el tamaño y la posición de cada salida" tabindex="0" style="overflow-x:auto;max-width:100%">

| Entrada | Kernel | Stride | Padding | Dilation | Salida |
| --- | --- | --- | --- | --- | --- |
| 5 × 5 | 2 × 2 | 1 | 0 | 1 | 4 × 4 |
| 5 × 5 | 2 × 2 | 2 | 0 | 1 | 2 × 2 |
| 5 × 5 | 2 × 2 | 1 | 1 | 1 | 6 × 6 |
| 5 × 5 | 2 × 2 | 1 | 0 | 2 | 3 × 3 |

</div>

`output_size` rechaza una ventana que no cabe. Evitamos que una salida vacía parezca una configuración aceptable.

## Las coordenadas permiten comprobar la alineación

Para una salida de fila `row` y columna `col`, las coordenadas de una muestra del kernel son:

```python
            r=row*stride-padding+kr*dilation
            c=col*stride-padding+kc*dilation
```

`kr` y `kc` recorren los índices del kernel. Restar padding vuelve de la entrada extendida a las coordenadas originales. Si `r` o `c` quedan fuera, la contribución usa cero y queda marcada como padding en el informe del visor.

La fórmula separa tres mecanismos que suelen confundirse: el stride mueve el origen, la dilation separa las muestras y el padding desplaza la referencia de coordenadas. El visor resalta solo los píxeles consultados, incluidos los huecos que deja dilation.

## Same no siempre significa padding simétrico

Con kernel 3, dilation 1 y stride 1, añadir un píxel por lado conserva tamaño. Con kernel 2 necesitamos una extensión total de un píxel por eje: repartirla por igual entre ambos lados no es posible con cantidades enteras.

El probe añade un cero solo a la derecha y abajo antes de aplicar nuestro kernel 2 × 2. Obtiene una salida 5 × 5 y deja explícita la alineación elegida. Añadir uno a cada lado habría producido 6 × 6.

**PyTorch** documenta que `padding='same'` en [Conv2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html) conserva la forma espacial y solo admite stride 1. No traslademos una convención de otra biblioteca sin comprobarla.

## Garantías y límites

Ocho configuraciones se contrastan con PyTorch celda a celda. Los tests comprueban también los términos que originan cada valor; acertar el tamaño no bastaría para aprobar un desplazamiento incorrecto.

El laboratorio utiliza el mismo entero para ambos ejes y padding simétrico en la fórmula general. Conv2d admite más configuraciones. El caso asimétrico se construye explícitamente y no se hace pasar por esa fórmula simétrica.

## Ejercicio: conserva tamaño sin perder la referencia

Para entrada 5 × 5 y kernel 2 × 2, calcula cuánto padding total necesitas con stride 1. Compara repartirlo a izquierda/arriba o a derecha/abajo. Las shapes coinciden: ¿coinciden también las regiones asociadas a cada coordenada?

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/geometry.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

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

- [Conv2d: shapes, stride, padding y dilation](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html).

## Continuar la serie

Anterior: [Convolution y kernels: calcular una CNN ventana a ventana](/posts/cnn-convolution-kernel-cross-correlation). Siguiente: [Pooling: qué información conserva y qué pierde una CNN al reducir un mapa](/posts/cnn-pooling-downsampling-gradientes-aliasing).
