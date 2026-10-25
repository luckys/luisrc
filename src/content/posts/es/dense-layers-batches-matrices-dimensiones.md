---
id: "DL-DENSE"
title: "Dense layers: leer una red neuronal como operaciones entre matrices"
published: "2026-10-25T18:01:00Z"
locale: "es"
translationKey: "neural-foundations-dl-dense"
slug: "dense-layers-batches-matrices-dimensiones"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P096"]
description: "Cómo seguir shapes, broadcasting y parámetros sin esconder errores de dimensiones. Ejemplos NumPy probados, diagramas y límites explícitos."
author: "Luis Ramírez Calle"
series: "Redes neuronales desde sus fundamentos: representar y aprender"
tags: ["deep-learning", "numpy", "redes-neuronales", "machine-learning"]
---

Una red devuelve un array con el tamaño esperado y, aun así, está calculando una loss equivocada. En NumPy, un broadcasting válido puede ocultar que hemos comparado cada predicción con todas las etiquetas del batch.

Después del [perceptrón y XOR](/posts/perceptron-neurona-pesos-bias-xor), vamos a seguir las dimensiones de una MLP. Queremos poder leer un forward pass, contar parámetros y provocar errores de shape antes de que aparezcan como un entrenamiento extraño.

## Una dense layer produce varias combinaciones de las mismas features

En nuestra convención, cada fila de **X** es una muestra y cada columna una feature. Un batch de 256 puntos con dos coordenadas tiene shape `(256, 2)`.

La primera **dense layer** tiene cuatro unidades. Su matriz **W1** tiene shape `(2, 4)` y su bias **b1**, `(4,)`. Calculamos `Z1 = X @ W1 + b1`, con resultado `(256, 4)`.

Cada columna de W1 contiene los pesos de una unidad. Dense significa que cada unidad recibe todas las features de la capa anterior. No significa que todos los pesos tengan el mismo valor.

En `packages/neural-foundations/neural.py`, una capa guarda esos dos arrays:

```python
@dataclass
class Layer:
    weight: Array
    bias: Array
```

El archivo importa `dataclass` desde la biblioteca estándar y define `Array` como un `NDArray[np.float64]`. La anotación documenta la intención; las dimensiones se validan en ejecución porque ese alias no expresa por sí solo `(batch, in)` o `(in, out)`.

## El producto matricial conserva las filas de muestras

La [documentación de matmul](https://numpy.org/doc/stable/reference/generated/numpy.matmul.html) define el producto que expresamos con `@`. Para nuestras matrices 2D, la dimensión interior debe coincidir: `(batch, in) @ (in, out) → (batch, out)`.

Usar `*` haría una multiplicación elemento a elemento con reglas de broadcasting. No es una alternativa abreviada al producto matricial.

Este es el helper completo de `packages/neural-foundations/neural.py`:

```python
def dense(x: Array, layer: Layer) -> Array:
    if (x.ndim != 2 or layer.weight.ndim != 2
            or x.shape[1] != layer.weight.shape[0]
            or layer.bias.shape != (layer.weight.shape[1],)):
        raise ValueError("dense requires (batch,in) @ (in,out) + (out,)")
    if not all(np.all(np.isfinite(a)) for a in (x, layer.weight, layer.bias)):
        raise ValueError("finite arrays required")
    return x @ layer.weight + layer.bias
```

Exigimos bias con shape `(out,)` y arrays finitos. NumPy expande ese bias sobre las filas sin aprender un bias distinto por muestra. La [guía de broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) explica cómo se alinean las dimensiones desde la derecha.

La validación evita aceptar por accidente un bias `(out, 1)` o una matriz W transpuesta. Una API de biblioteca podría admitir más layouts; este ejemplo elige uno y rechaza el resto para poder razonar sobre él.

<img src="/assets/visuals/neural-foundations/DL-DENSE.svg" alt="Cómo seguir shapes, broadcasting y parámetros sin esconder errores de dimensiones. El diagrama separa entradas, representación y decisión, indicando límites para no confundir una cuenta o un entrenamiento sintético con una garantía general." width="277" height="829" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/neural-foundations/DL-DENSE.svg).

## Una MLP de dos entradas y cuatro unidades tiene diecisiete parámetros

Aplicamos tanh a Z1 sin cambiar su shape: H sigue siendo `(256, 4)`. La segunda capa usa W2 `(4, 1)` y b2 `(1,)`, produciendo logits `(256, 1)`.

La cuenta es `(2 × 4 + 4) + (4 × 1 + 1) = 17`. El tamaño del batch no aparece en esa cuenta: los mismos parámetros se comparten entre las 256 muestras.

Las activaciones intermedias sí crecen con el batch. Distinguir parámetros y activaciones será importante para memoria, aunque este laboratorio pequeño no mide VRAM ni compara tamaños de batch.

## Una etiqueta por fila necesita una shape compatible

Si logits tiene `(256, 1)` y targets tiene `(256,)`, ciertas operaciones entre ambos producen `(256, 256)`. La dimensión final de uno y la del otro se expanden; hemos dejado de comparar únicamente parejas predicción-etiqueta.

Por eso `binary_loss` exige targets con la misma shape `(batch, 1)`. La prueba pasa deliberadamente un vector `(batch,)` y comprueba que se rechaza. También se comprueban valores binarios y logits finitos.

Que una operación no lance una excepción no demuestra que haga la cuenta deseada. Conviene escribir shapes junto a las fórmulas y probar un batch con más de una muestra; un ejemplo de una sola fila puede esconder el error.

## Apilar capas afines sin activation no crea otra familia no lineal

Si eliminamos tanh, las dos capas calculan:

`(XW1 + b1)W2 + b2 = X(W1W2) + (b1W2 + b2)`

Podemos reemplazarlas por una sola capa afín con W igual a W1W2 y bias igual a b1W2+b2. En `packages/neural-foundations/neural.py`:

```python
def compose_affine(first: Layer, second: Layer) -> Layer:
    if first.weight.shape[1] != second.weight.shape[0]:
        raise ValueError("incompatible layers")
    return Layer(first.weight @ second.weight,
                 first.bias @ second.weight + second.bias)
```

El test compara ambos recorridos sobre dos muestras. La equivalencia es algebraica; con floats verificamos cercanía numérica, no exigimos igualdad bit a bit para cualquier matriz.

La activation entre capas impide ese colapso general. Añadir capas afines puede cambiar la parametrización y la dinámica de optimización, pero no basta para representar una frontera no lineal en las entradas.

## Alternativas y límites del layout elegido

Se podrían usar vectores columna para cada muestra o transponer pesos según la convención de otra biblioteca. Ambas opciones son válidas si todas las fórmulas y operaciones coinciden con ella.

Mantendremos filas de muestras porque permite leer batches como tablas y encadenar productos 2D sencillos. No hemos construido una librería de tensores con broadcasting arbitrario, GPU o capas de profundidad variable.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [modelo NumPy](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py), los [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/tests/test_neural.py) y el [protocolo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/protocol.json). Las fuentes y el runtime están fijados para reproducir las observaciones.

Desde la raíz del monorepo, con Docker y la image de `runtime.json` disponible:

```bash
pnpm --dir packages/neural-foundations test:container
pnpm --dir packages/neural-foundations exercise
pnpm --dir packages/neural-foundations verify
pnpm --dir packages/neural-foundations test
pnpm --dir packages/neural-foundations render
```

No requiere credenciales, servicios de pago ni instalar paquetes Python en el host. El README explica el runtime y las tolerancias de verificación.

## Garantías y límites

Los tests detectan shapes inválidas del ejemplo, valores no finitos y errores de composición. No garantizan buen entrenamiento ni generalización. Una red con dimensiones correctas puede aprender una relación equivocada, memorizar datos o quedarse en una solución inútil.

## Ejercicio: ampliar una capa sin ampliar el batch

Cambia en papel la capa oculta de cuatro a ocho unidades. Escribe cada shape y el nuevo número de parámetros. Después explica por qué targets debe seguir siendo `(batch, 1)`. La siguiente entrega introduce las funciones que colocaremos entre estas operaciones afines.

Continúa con [Activations: qué cambia tanh, sigmoid o ReLU dentro de una red](/posts/activations-tanh-sigmoid-relu-no-linealidad).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026; documentación NumPy 2.5 y runtime exacto NumPy 2.5.3. Los datos y resultados numéricos del juguete proceden de nuestro laboratorio.

- [NumPy matmul](https://numpy.org/doc/stable/reference/generated/numpy.matmul.html).
- [NumPy broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html).
