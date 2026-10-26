---
id: "DL-RECEPTIVE-FIELD"
title: "Receptive field: qué parte de la imagen puede afectar a una activación"
published: "2026-10-26T00:03:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-receptive-field"
slug: "cnn-receptive-field-soporte-gradientes"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-POOLING"]
description: "Cómo relacionar una celda profunda con coordenadas de la imagen original. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Una activación en un mapa 12 × 12 no corresponde a un único píxel de la imagen original. Después de encadenar convolutions y pooling, puede depender de una región bastante mayor. Si esa región es demasiado pequeña para el patrón que buscamos, añadir canales no cambia por sí solo su alcance espacial.

Después de [reducir mapas con pooling](/posts/cnn-pooling-downsampling-gradientes-aliasing), vamos a seguir las coordenadas hacia atrás. El **receptive field** describe qué región de entrada puede influir en una activación por la estructura de la red.

## Tamaño, salto y centro describen cosas diferentes

Para una cadena de operadores locales mantendremos tres cantidades por eje:

- **Size**, $r$: alcance del soporte en coordenadas de entrada.
- **Jump**, $j$: distancia entre los centros asociados a dos salidas vecinas.
- **Start**, $a$: centro de la primera salida, usando centros de píxel en 0,5; 1,5; 2,5…

Al inicio $r=1,j=1,a=0,5$. Para una capa de kernel $k$, stride $s$ y padding izquierdo $p$, sin dilation:

$$
r'=r+(k-1)j,\qquad j'=sj,\qquad a'=a+\left(\frac{k-1}{2}-p\right)j.
$$

El factor $j$ importa: una ventana sobre un mapa reducido recorre posiciones que ya están separadas en la imagen original. Sumamos el alcance nuevo usando el salto anterior, antes de actualizarlo.

## El cálculo de nuestra CNN llega a un soporte de 8 × 8

Nuestra secuencia espacial es convolution 3 × 3 con padding 1, pooling 2 × 2 con stride 2 y otra convolution 3 × 3 con padding 1.

<div role="region" aria-label="Tabla 1: Receptive field: qué parte de la imagen puede afectar a una activación" tabindex="0" style="overflow-x:auto;max-width:100%">

| Etapa | Size | Jump | Start |
| --- | --- | --- | --- |
| Entrada | 1 | 1 | 0,5 |
| Conv1 | 3 | 1 | 0,5 |
| Pool | 4 | 2 | 1 |
| Conv2 | 8 | 2 | 1 |

</div>

La convolution inicial amplía soporte sin cambiar resolución. Pooling reduce resolución y cambia el salto. La segunda convolution reúne tres posiciones por eje de ese mapa reducido: añade cuatro píxeles al alcance anterior.

En `geometry.py` se conserva el orden de las actualizaciones:

```python
        start+=((kernel-1)/2-padding)*jump
        size+=(kernel-1)*jump
        jump*=stride
```

Este helper está limitado a la cadena sin dilation que acabamos de describir. Para incorporarla habría que usar el kernel efectivo. En redes con varias ramas también hay que comprobar cómo se alinean los caminos antes de combinarlos.

<img src="/assets/visuals/convolutional-networks/DL-RECEPTIVE-FIELD.svg" alt="Cómo relacionar una celda profunda con coordenadas de la imagen original. Flujo de cálculo del laboratorio." width="402" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La salida (6, 6) consulta filas y columnas 9 a 16

En conv2, el centro de la salida de índice 6 está en $1+6\cdot2=13$ por eje. Su región de tamaño 8 abarca los píxeles cuyos índices van de 9 a 16, ambos incluidos.

Podemos comprobarlo recorriendo ventanas hacia atrás: conv2 usa posiciones 5 a 7 del mapa de pooling. Estas reúnen posiciones 10 a 15 de conv1. Cada una de ellas agrega un entorno de radio 1 en la entrada, así que llegamos a 9…16.

En la salida (0, 0), parte del soporte teórico cae fuera de la imagen. Su extensión corresponde a índices −3…4; solo 0…4 son píxeles reales. El padding permite calcular la salida, pero no aporta nuevas observaciones.

## Un test de gradiente contrasta la geometría

El laboratorio construye una cadena de referencia con kernels de unos y **average pooling**. Todas las rutas hacia las entradas de una ventana tienen contribuciones positivas. Al derivar la salida central, aparecen derivadas no nulas exactamente en el cuadrado 8 × 8 calculado.

Se comprueba también la esquina: el soporte no nulo real es 5 × 5. El test rechazaría un desplazamiento incorrecto aunque el tamaño total fuera el esperado.

Esta cadena de referencia usa average pooling para que todo el soporte resulte visible en el gradiente. La CNN entrenada usa max pooling y ReLU. Su geometría teórica es la misma, pero una derivada local puede recorrer menos posiciones: los máximos seleccionan rutas y ReLU puede anularlas.

## Soporte posible y sensibilidad local no son equivalentes

El visor muestra ambos para una activación real de conv2, antes de ReLU, en (6, 6). El cuadrado sobre la entrada indica las posiciones permitidas por la arquitectura. El mapa de gradiente muestra la derivada de esa activación respecto a cada píxel en esa entrada concreta.

Una derivada cero no elimina una ruta de la arquitectura para todas las entradas posibles. Cambiar suficientemente la imagen podría modificar máximos o activar otra región de ReLU. Una derivada grande tampoco demuestra que ese píxel explique la clase final: estamos derivando una activación intermedia, no la decisión completa.

El análisis de [receptive fields de Araujo, Norris y Sim](https://distill.pub/2019/computing-receptive-fields/) permite situar estas cuentas dentro de cadenas y grafos más generales. Aquí contrastamos una cadena pequeña que podemos recorrer manualmente.

## Global average pooling reúne posiciones de todo el mapa

Después de conv2, nuestra red promedia las 12 × 12 posiciones de cada canal. Ya no estamos hablando del alcance de una única celda local. La agregación reúne toda la cuadrícula, incluidas posiciones cuyos soportes llegan a los bordes.

El alcance teórico conjunto por eje es $8+(12-1)\cdot2=30$, parte del cual corresponde a padding. La entrada real solo mide 24. Esto describe alcance estructural, no garantiza que todos sus píxeles tengan derivada no nula ni contribución útil a cada predicción.

## Garantías y límites

Los tests comprueban la recurrencia, el soporte central y el de esquina en el operador de referencia. También comprueban que los gradientes archivados de la CNN no salen del soporte esperado.

No llamamos a este dibujo una explicación causal ni una medida empírica completa del **effective receptive field**. Este último estudia cómo se distribuye la influencia dentro del soporte y requiere precisar entradas, salidas y medida.

## Ejercicio: no confundas una reducción con una ampliación uniforme

Sustituye el stride de pooling por 1 en la cuenta manual. Recalcula size, jump y start antes de tocar código. Explica qué cambia en el alcance de conv2 y por qué conocer solo el número de capas no permite responderlo.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/geometry.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Referencias

- [Computing Receptive Fields of Convolutional Neural Networks](https://distill.pub/2019/computing-receptive-fields/).

## Continuar la serie

Anterior: [Pooling: qué información conserva y qué pierde una CNN al reducir un mapa](/posts/cnn-pooling-downsampling-gradientes-aliasing). Siguiente: [Canales y filtros: cómo una convolution combina varios mapas](/posts/cnn-canales-filtros-parametros-compartidos).
