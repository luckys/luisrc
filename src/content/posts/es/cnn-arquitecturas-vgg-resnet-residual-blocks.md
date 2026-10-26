---
id: "DL-CNN-ARCHITECTURES"
title: "Arquitecturas CNN: qué cambia al apilar kernels o añadir un residual block"
published: "2026-10-26T00:07:00Z"
locale: "es"
translationKey: "convolutional-networks-dl-cnn-architectures"
slug: "cnn-arquitecturas-vgg-resnet-residual-blocks"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-FEATURE-MAPS", "DL-BATCHNORM"]
description: "Qué decisiones estructurales hay detrás de distintas familias de CNN. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Añadir más capas a una CNN no especifica cómo se reducirá la resolución, cómo viajarán los gradientes ni qué tensores podrán sumarse. Esas decisiones explican más de una arquitectura que memorizar su nombre.

Después de [inspeccionar feature maps](/posts/cnn-feature-maps-activaciones-interpretacion), compararemos tres ideas: encadenar operadores locales, apilar kernels pequeños y añadir conexiones residuales. El laboratorio mantiene su TinyCNN para los entrenamientos y añade un **residual block** ejecutable para comprobar shapes y suma.

## Una cadena local deja claro qué aporta cada etapa

Nuestra TinyCNN alterna convolution, ReLU y una reducción espacial. La segunda convolution combina regiones de las respuestas anteriores. Global average pooling deja una descripción de ocho valores y la head los transforma en logits.

Este diseño pequeño permite seguir cada transformación. Tiene un único camino y un único punto de reducción antes de la agregación global. Eso facilita el diagnóstico, pero no lo convierte en una elección universal: la resolución restante, el número de canales y el alcance deben adecuarse al patrón que necesitamos reconocer.

Las arquitecturas clásicas de clasificación, como la familia **LeNet**, ayudan a situar la idea de combinar operaciones locales y agregación antes de clasificar. Nuestra red no reproduce su arquitectura exacta, sus capas históricas ni sus resultados. La descripción original está en [Gradient-Based Learning Applied to Document Recognition](https://proceedingsoftheieee.ieee.org/gradient-based-learning-applied-to-document-recognition/).

## Apilar 3 × 3 cambia alcance y composición

Dos convolutions 3 × 3 con stride 1 producen un alcance espacial de 5 × 5. La primera reúne tres posiciones por eje; la segunda añade dos al alcance anterior.

Si ambas conservan C canales, ignorando biases, tienen $18C^2$ pesos frente a $25C^2$ de una sola convolution 5 × 5 con C entradas y C salidas. Es una comparación bajo esos supuestos: si cambia el ancho intermedio, también cambia la cuenta.

No calculan la misma función por tener el mismo alcance. Entre las dos podemos insertar una no linealidad y aprender una composición con una estructura de parámetros distinta. El campo receptivo por sí solo no determina capacidad, coste total o facilidad de optimización.

**VGG** estudió redes profundas basadas en kernels 3 × 3. El [artículo original](https://arxiv.org/abs/1409.1556) describe sus arquitecturas y evaluación; aquí usamos la idea de apilamiento y una cuenta de parámetros, sin atribuir sus resultados a nuestra TinyCNN.

## Un residual block combina una rama con un shortcut

Un bloque residual construye una transformación $F(x)$ y la suma a un camino que conserva o adapta la entrada. En el bloque post-activation del laboratorio:

$$
y=\operatorname{ReLU}\big(F(x)+S(x)\big).
$$

La rama contiene convolution, BatchNorm, ReLU, convolution y BatchNorm. El **shortcut** $S$ es identidad cuando coinciden resolución y canales. Cuando no coinciden, usa una proyección 1 × 1 con stride y BatchNorm para adaptar la forma.

<img src="/assets/visuals/convolutional-networks/DL-CNN-ARCHITECTURES.svg" alt="Qué decisiones estructurales hay detrás de distintas familias de CNN. Flujo de cálculo del laboratorio." width="367" height="696" loading="lazy" style="width:100%;max-width:367px;height:auto" />

El código de `networks.py` hace visible la suma:

```python
    def forward(self,x):
        return torch.relu(self.branch(x)+self.skip(x))
```

Esta suma exige tensores compatibles. Para entrada N × 4 × 12 × 12 y rama N × 8 × 6 × 6, una identidad no sirve. La proyección produce la misma shape N × 8 × 6 × 6 antes de sumar.

No aplicamos broadcasting para esconder el problema. El test provoca una suma incompatible y exige su rechazo. Otro test ejecuta la proyección y comprueba el tamaño real.

## El shortcut ofrece un camino adicional, con condiciones

La formulación residual facilita expresar un cambio respecto a una entrada o a su proyección. Si la rama residual produce cero y el shortcut es identidad, nuestro bloque devuelve ReLU(x).

Eso coincide con x para entradas no negativas. Para entradas negativas devuelve cero. El test usa valores de ambos signos para evitar afirmar que el bloque completo siempre es identidad cuando su rama vale cero.

Por la misma razón, añadir un shortcut no garantiza que cualquier gradiente sea 1 o que toda red profunda entrene bien. Hay activaciones, normalizaciones, proyecciones y composiciones que considerar. La derivada del bloque depende de ellas y de la entrada.

**ResNet** propuso el aprendizaje residual para facilitar la optimización de redes profundas. El [trabajo original](https://arxiv.org/abs/1512.03385) aporta sus experimentos. Nuestro bloque comprueba un mecanismo, no reproduce ese benchmark ni demuestra por sí solo una mejora de accuracy.

## BatchNorm introduce estado aunque no cambie la shape

La rama y la proyección tienen BatchNorm. Sus estadísticas de entrenamiento y evaluación importan además de sus parámetros aprendidos. La suma puede tener el tamaño correcto y, aun así, cambiar por un modo incorrecto de ejecución.

Eso será relevante al congelar un backbone: desactivar sus gradientes no fija automáticamente las estadísticas de una BatchNorm. En los tests del bloque usamos eval cuando queremos aislar el caso de rama cero. El artículo de [BatchNorm](/posts/batchnorm-estadisticas-batch-running-train-eval) detalla ese contrato.

TinyCNN no incluye BatchNorm ni estos shortcuts. Mantenerlo explícito evita presentar un probe de bloque como si fuera el modelo que produjo las curvas de entrenamiento.

## Garantías y límites

Los tests cubren identidad de shape, reducción con proyección, suma incompatible y el caso de rama cero tras ReLU. No se entrena una ResNet completa, no se descarga una arquitectura preentrenada y no se comparan tiempos entre familias.

Para elegir una arquitectura real habría que considerar tarea, resolución, datos, memoria y mediciones con un protocolo común. El número de capas o el nombre de una familia no reemplaza esas comprobaciones.

## Ejercicio: decide qué tendría que hacer el shortcut

Diseña las shapes de un bloque que recibe N × 16 × 32 × 32 y debe producir N × 32 × 16 × 16. Indica el stride de la rama y la proyección. Antes de programarlo, explica qué fallaría si conservaras una identidad en el shortcut.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/networks.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Referencias

- [VGG, trabajo original](https://arxiv.org/abs/1409.1556).
- [ResNet, trabajo original](https://arxiv.org/abs/1512.03385).
- [Gradient-based Learning Applied to Document Recognition](https://proceedingsoftheieee.ieee.org/gradient-based-learning-applied-to-document-recognition/).

## Continuar la serie

Anterior: [Feature maps: inspeccionar una CNN sin inventar lo que ha aprendido](/posts/cnn-feature-maps-activaciones-interpretacion). Siguiente: [Transfer learning en una CNN: comparar freeze, fine-tuning y empezar de cero](/posts/cnn-transfer-learning-freeze-fine-tuning-controles).
