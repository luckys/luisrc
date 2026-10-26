---
id: "DL-CONV-CHANNELS"
title: "Canales y filtros: cómo una convolution combina varios mapas"
published: "2026-10-26T00:04:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-conv-channels"
slug: "cnn-canales-filtros-parametros-compartidos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-RECEPTIVE-FIELD"]
description: "Qué significa un banco de filtros y de dónde salen sus parámetros. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Configurar `Conv2d(4, 8, 3)` suele generar una duda: ¿se aplica un kernel a cada uno de los cuatro canales para obtener ocho mapas? Para entender sus parámetros necesitamos separar el kernel espacial de todo el banco de pesos.

Tras [seguir el receptive field](/posts/cnn-receptive-field-soporte-gradientes), mantendremos las mismas coordenadas espaciales y añadiremos el eje de canales. Esta es la parte que permite combinar respuestas de capas anteriores.

## Cada canal de salida combina todos los canales de entrada

En una convolution densa, con `groups=1`, un canal de salida usa un kernel espacial distinto para cada canal de entrada. Calcula las respuestas de esas parejas, las suma y añade su bias.

Con dos entradas y tres salidas, un kernel espacial 2 × 2 y bias, los pesos tienen shape `(3, 2, 2, 2)`. El primer eje elige el canal de salida. El segundo elige cuál de los canales de entrada estamos consultando.

Para salida $o$ en posición $(r,c)$:

$$
y_{o,r,c}=b_o+\sum_{i=0}^{C_{in}-1}\sum_{u,v}W_{o,i,u,v}\,x_{i,r+u,c+v}.
$$

La fórmula está escrita para stride 1, sin padding ni dilation, y omite el eje batch. El artículo anterior explica cómo cambiar los índices espaciales. El principio de sumar sobre canales se mantiene.

<img src="/assets/visuals/convolutional-networks/DL-CONV-CHANNELS.svg" alt="Qué significa un banco de filtros y de dónde salen sus parámetros. Flujo de cálculo del laboratorio." width="382" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

No salen seis canales por tener dos entradas y tres kernels de salida. Las dos contribuciones de entrada se suman dentro de cada salida. En el laboratorio se calculan por separado con nuestro operador de referencia y se contrastan con el tensor completo de PyTorch.

## El bias se comparte entre posiciones del mismo mapa

El número de parámetros, con bias y grupos 1, es:

$$
C_{out}\left(C_{in}k_Hk_W+1\right).
$$

Nuestro ejemplo tiene $3(2\cdot2\cdot2+1)=27$: veinticuatro pesos y tres biases. No añadimos un bias independiente para cada fila y columna. Eso rompería la forma de compartir parámetros que estamos describiendo.

La resolución de entrada cambia el número de aplicaciones, no el número de pesos de esta capa. El tamaño de sus activaciones, sus operaciones y la memoria durante entrenamiento sí dependen de esa resolución y del batch.

Esto también explica por qué reducir canales y reducir resolución son decisiones diferentes. Ambas pueden reducir trabajo, pero una cambia cuántas respuestas aprendemos y la otra cuántas posiciones representamos.

## NCHW permite seguir cada eje sin adivinar

En el laboratorio usamos el orden lógico **NCHW**:

<div role="region" aria-label="Tabla 1: Canales y filtros: cómo una convolution combina varios mapas" tabindex="0" style="overflow-x:auto;max-width:100%">

| Eje | Qué representa | Ejemplo en la entrada |
| --- | --- | --- |
| N | Muestras del batch | 32 |
| C | Canales | 1 |
| H | Filas | 24 |
| W | Columnas | 24 |

</div>

El canal inicial es intensidad en escala de grises. Después de la primera convolution, los cuatro canales son respuestas aprendidas; no son rojo, verde, azul y otro color. El significado depende de sus pesos y de las entradas.

Los tests pasan una entrada en orden NHWC para comprobar que la red no la acepta como si fuera correcta. Una permutación de ejes puede ser necesaria al integrar otro sistema, pero debe ser deliberada. El formato de memoria de un tensor es una cuestión adicional; no lo inferimos solo de esta notación de ejes.

## Nuestra CNN pasa de uno a cuatro y después a ocho canales

El backbone registra sus capas en `networks.py`:

```python
        self.conv1=nn.Conv2d(1,4,3,padding=1)
        self.pool=nn.MaxPool2d(2)
        self.conv2=nn.Conv2d(4,8,3,padding=1)
        self.gap=nn.AdaptiveAvgPool2d(1)
```

Conv1 tiene $4(1\cdot9+1)=40$ parámetros. Conv2 tiene $8(4\cdot9+1)=296$. El backbone suma 336. Pooling y global average pooling no añaden parámetros aprendidos.

Después de reducir espacialmente cada canal a una media, quedan ocho valores por imagen. La **head** lineal que predice cuatro orientaciones añade $8\cdot4+4=36$. La red source completa tiene **372 parámetros**.

Cuando cambiemos a dos clases, la misma representación de ocho valores alimentará una head de 18 parámetros. El total será 354. Cambiar el número de clases no obliga a cambiar los kernels del backbone; sí cambia el contrato de la salida y de los targets.

## Los canales profundos pueden combinar respuestas anteriores

La segunda convolution consulta regiones locales de cuatro mapas. Puede construir combinaciones que la primera capa no representaba directamente. Esto da una forma concreta a la idea de extracción jerárquica: cada capa recibe respuestas ya transformadas, con otro alcance espacial.

No asignamos un concepto humano fijo a cada canal por su posición en el tensor. Tampoco garantizamos que una red pequeña produzca una jerarquía de bordes, partes y objetos claramente separable. Inspeccionaremos los mapas aprendidos para describir qué valores aparecen, sin inventar esa interpretación.

**Groups** y **depthwise convolution** cambian qué canales se conectan. La fórmula anterior corresponde a la convolution densa que ejecutamos, no a todas esas variantes. La documentación de [Conv2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html) distingue sus configuraciones.

## Garantías y límites

El probe multicanal usa entradas, pesos y biases conocidos. Suma las contribuciones de cada canal con nuestra referencia y obtiene exactamente la salida PyTorch en float64. Los tests verifican también los 27 parámetros del probe y los totales 372 y 354 de los modelos.

Compartir pesos es una restricción útil cuando las relaciones locales se repiten en el espacio. No vuelve idénticas todas las posiciones: el contenido, los bordes y la agregación posterior siguen afectando a cada resultado.

## Ejercicio: cambia resolución y clases por separado

Calcula qué parámetros cambiarían al pasar de imágenes 24 × 24 a 32 × 32 sin alterar canales ni head. Después cambia solo las clases de cuatro a seis. Explica por qué global average pooling evita depender directamente de cuántas posiciones espaciales llegan a la head.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/networks.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Referencias

- [Conv2d: pesos, bias y grupos](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html).

## Continuar la serie

Anterior: [Receptive field: qué parte de la imagen puede afectar a una activación](/posts/cnn-receptive-field-soporte-gradientes). Siguiente: [Entrenar una CNN pequeña: datos, logits y un protocolo que se puede repetir](/posts/cnn-pequena-entrenamiento-protocolo-logits).
