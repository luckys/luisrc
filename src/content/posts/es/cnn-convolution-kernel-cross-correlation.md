---
id: "P101"
title: "Convolution y kernels: calcular una CNN ventana a ventana"
published: "2026-10-26T00:00:00Z"
locale: "es"
translationKey: "convolutional-networks-p101"
slug: "cnn-convolution-kernel-cross-correlation"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P085", "P099", "P100"]
description: "Qué se multiplica en una convolution y qué se comparte al recorrer la imagen. Cálculos, código ejecutado y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cómo trabaja una CNN: de la ventana a la representación aprendida"
tags: ["deep-learning", "cnn", "pytorch", "computer-vision"]
---

Una red puede recibir una imagen de 24 × 24 píxeles y acertar su orientación sin que sepamos qué operaciones está haciendo. Antes de entrenarla, conviene poder explicar una sola celda de su salida con una calculadora.

En esta serie construiremos una **CNN**, una red que aplica operaciones locales compartidas sobre imágenes. Empezamos por un kernel fijo y terminamos entrenando sus pesos, inspeccionando activaciones y comparando estrategias de **transfer learning**. Cada paso conserva un cálculo o una prueba que podemos revisar.

Si necesitas repasar la convolution de señales, está en [Fourier, FFT y convolution](/posts/fourier-fft-convolucion-errores-numericos). Aquí trabajaremos con dos ejes espaciales y con la convención usada por **PyTorch**.

## Un kernel combina una región pequeña de la imagen

Una imagen en escala de grises puede representarse como una matriz. Cada número describe la intensidad de un píxel. El **kernel** es otra matriz, normalmente más pequeña, cuyos valores multiplicamos por una región de la imagen antes de sumar los productos.

Usaremos esta entrada:

```text
 1   2   3   4   5
 6   7   8   9  10
11  12  13  14  15
16  17  18  19  20
21  22  23  24  25
```

Y este kernel deliberadamente asimétrico:

```text
 1   0
-1   2
```

La primera ventana contiene 1, 2, 6 y 7. Su salida es:

$$
y_{0,0}=1\cdot1+2\cdot0+6\cdot(-1)+7\cdot2=9.
$$

El cero también es un peso: su producto aporta cero. El −1 resta intensidad en una posición y el 2 duplica otra. Este ejemplo permite reconstruir la operación; sus números no son un filtro entrenado ni prometen detectar bordes.

## El mismo kernel se aplica en varias posiciones

Desplazamos la ventana una columna. Ahora usamos 2, 3, 7 y 8, conservando exactamente los mismos cuatro pesos. La salida pasa a ser 11. Repetimos el proceso por las filas y columnas donde cabe la ventana.

Con entrada 5 × 5, kernel 2 × 2, avance de un píxel y sin relleno, obtenemos un mapa 4 × 4. Ese mapa reúne respuestas del mismo operador en posiciones distintas. Un número de salida no es otro kernel: es el resultado de aplicar el kernel a una ventana concreta.

<img src="/assets/visuals/convolutional-networks/P101.svg" alt="Qué se multiplica en una convolution y qué se comparte al recorrer la imagen. Flujo de cálculo del laboratorio." width="407" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Este **weight sharing** limita cuántos parámetros aprendemos. El kernel conserva cuatro valores aunque cambiemos de una imagen 5 × 5 a otra mayor. El trabajo computacional y el tamaño del mapa sí aumentan al haber más posiciones.

La decisión supone que una misma relación local puede ser útil en varias zonas. En una fotografía suele ser razonable buscar un contraste local independientemente de dónde aparezca. Si cada coordenada tiene un significado completamente diferente, compartir de esa forma puede resultar una restricción poco adecuada.

## Por qué el laboratorio calcula cross-correlation

La convolution matemática invierte espacialmente el kernel. **Conv2d** aplica **cross-correlation**, que mantiene su orientación. La documentación de [Conv2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html) declara esa convención.

El nombre convolution se conserva en las CNN. Para contrastar cálculos necesitamos acordar la operación exacta: si inviertes nuestro kernel asimétrico, la primera salida ya no es 9. Un kernel simétrico habría ocultado ese error.

En `geometry.py`, cada término conserva coordenada, valor, peso y producto. El cálculo de la salida reúne esos términos:

```python
    return np.array([[sum(t['product'] for t in contributions(x,k,r,c,stride,padding,dilation)) for c in range(w)] for r in range(h)])
```

El código completo define también `h` y `w`, valida el tamaño y trata el padding. Separar la localización de las muestras de su suma permite comprobar dos preguntas diferentes: si usamos los píxeles correctos y si los combinamos correctamente.

## Aprender un kernel significa ajustar sus pesos con datos

Hasta aquí hemos elegido los pesos manualmente. En una CNN entrenada son parámetros: la **loss** depende de sus valores, **autograd** calcula derivadas y el optimizador los actualiza. La arquitectura sigue fijando el tamaño del kernel y cómo se mueve.

Al reutilizar un peso en muchas ventanas, su gradiente acumula contribuciones de esas aplicaciones. No se aprende un peso independiente para cada píxel de salida. En los artículos siguientes añadiremos varios canales y varios kernels para formar un banco de respuestas.

Una respuesta alta indica que una combinación numérica es alta. Para afirmar que detecta una orientación, textura o clase necesitamos observar cómo responde ante distintas entradas y cómo participa en el modelo completo. Una imagen atractiva de un filtro no sustituye esa comprobación.

## Garantías y límites del cálculo de referencia

Los tests comparan todas las celdas producidas por ocho combinaciones de stride, padding y dilation con `torch.nn.functional.conv2d`. Los cálculos de este probe usan **float64** y números que permiten una coincidencia exacta. También suman los términos de cada ventana y comprueban el resultado conocido 9.

Esta implementación con bucles prioriza que podamos inspeccionar los índices. No es una alternativa de rendimiento a los kernels optimizados de una biblioteca. El entrenamiento posterior utiliza Conv2d y float32; no extrapolamos una igualdad exacta de este probe a cualquier entrenamiento o hardware.

## Preguntas frecuentes sobre el kernel

**¿El kernel siempre es 3 × 3?** No. Ese tamaño será una decisión de nuestra CNN, no una propiedad de la operación.

**¿Hace falta asignarle un significado antes de entrenar?** No. Podemos inicializarlo y aprender sus pesos a partir de la tarea.

**¿Compartir pesos garantiza reconocer un objeto en cualquier posición?** No. Bordes, reducciones espaciales y capas posteriores también afectan al resultado.

## Ejercicio: descubre una inversión que no debería pasar inadvertida

Calcula la primera salida después de girar el kernel 180 grados. Explica por qué un test con todos los pesos iguales no habría detectado la inversión. Después desplaza una ventana y conserva sus cuatro contribuciones, antes de consultar el laboratorio.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [código de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/geometry.py), [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/convolutional-networks/protocol.json), tests y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/convolutional-networks test:container
pnpm --dir packages/convolutional-networks verify
pnpm --dir packages/convolutional-networks test
```

`verify` vuelve a entrenar los quince runs y recalcula mapas y controles; comprueba sus valores con tolerancias declaradas. `exercise` regenera el informe y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread, sin instalar Python en el host. El README documenta versiones y límites.

## Referencias

- [Conv2d: definición y convención](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html).

## Continuar la serie

Siguiente: [Padding, stride y dilation: calcular el tamaño y la posición de cada salida](/posts/cnn-padding-stride-dilation-shapes).
