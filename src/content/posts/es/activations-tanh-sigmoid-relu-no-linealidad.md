---
id: "DL-ACTIVATIONS"
title: "Activations: qué cambia tanh, sigmoid o ReLU dentro de una red"
published: "2026-10-25T18:02:00Z"
locale: "es"
translationKey: "neural-foundations-dl-activations"
slug: "activations-tanh-sigmoid-relu-no-linealidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-DENSE"]
description: "Por qué las activations cambian la familia de funciones y la sensibilidad del entrenamiento. Ejemplos NumPy probados, diagramas y límites explícitos."
author: "Luis Ramírez Calle"
series: "Redes neuronales desde sus fundamentos: representar y aprender"
tags: ["deep-learning", "numpy", "redes-neuronales", "machine-learning"]
---

Una MLP sin funciones no lineales se puede reducir a una sola transformación afín. Añadir una activation cambia esa limitación, pero también cambia cómo se propagan pequeñas variaciones durante el entrenamiento.

Tras [seguir las matrices](/posts/dense-layers-batches-matrices-dimensiones), veremos **tanh**, **sigmoid** y **ReLU**. Compararemos sus funciones y sus límites, sin deducir de una curva aislada qué red va a entrenar mejor.

## La activation actúa después de la combinación afín

Una capa oculta calcula primero `Z = XW + b` y después `H = g(Z)`. La función g se aplica a cada elemento de Z; mantiene las dimensiones y modifica los valores.

En `packages/neural-foundations/neural.py`, el forward de nuestra red es:

```python
def forward(x: Array, layers: list[Layer]) -> tuple[Array, Array]:
    if len(layers) not in (1, 2):
        raise ValueError("this example supports one or two dense layers")
    hidden = np.tanh(dense(x, layers[0])) if len(layers) == 2 else x
    logits = dense(hidden, layers[-1])
    return logits, hidden
```

Cuando hay dos capas, la primera produce una representación con **tanh** y la última produce logits. Con una sola capa, el recorrido es una regresión logística cuyo logit es afín en las entradas. La sigmoid de salida se aplica después al interpretar probabilidades, no dentro de `forward`.

Esta separación permite calcular la loss directamente desde logits con una fórmula numéricamente estable. También permite inspeccionar la representación oculta sin mezclarla con la decisión final.

## Tanh centra su salida alrededor de cero, pero puede saturarse

**Tanh** devuelve valores entre −1 y 1. Es creciente, vale cero en cero y su derivada se puede expresar como `1 − tanh(z)²`.

Cerca de cero, mover z cambia de forma apreciable la salida. Con valores grandes en magnitud, la función se aplana. Para z=5, tanh está aproximadamente en 0,999909 y su derivada en 0,000182. Existe derivada, pero ese factor transmite un cambio pequeño a través de esa unidad.

El laboratorio usa tanh porque permite una red pequeña con fórmulas y derivadas fáciles de inspeccionar. No la presenta como la activation óptima para cualquier arquitectura. NumPy proporciona [tanh elemento a elemento](https://numpy.org/doc/stable/reference/generated/numpy.tanh.html).

## Sigmoid sirve para una salida binaria, con precauciones

**Sigmoid** transforma un logit en `(0, 1)`. Su derivada es `p × (1 − p)`, como máximo 0,25, y también se reduce en los extremos.

Su uso en la salida binaria responde al modelo probabilístico y la loss elegidos. Eso no obliga a usarla en todas las capas ocultas. La activación oculta y la salida cumplen papeles distintos.

Una implementación ingenua de `1 / (1 + exp(−z))` puede desbordar al calcular `exp(1000)`. El helper de `packages/neural-foundations/neural.py` mantiene la exponencial dentro de un rango seguro:

```python
def sigmoid(logits: Array) -> Array:
    exponential = np.exp(-np.abs(logits))
    return np.where(logits >= 0, 1 / (1 + exponential),
                    exponential / (1 + exponential))
```

`exp(−abs(z))` nunca recibe un argumento positivo. Las dos ramas de `np.where` pueden evaluarse, así que ambas deben ser seguras. Los tests comprueban logits −1000, 0 y 1000 con overflow tratado como error.

## ReLU tiene una región plana distinta

**ReLU** calcula `max(0, z)`. Para z positivo tiene derivada 1; para z negativo, 0. En cero no es diferenciable y una implementación de entrenamiento debe elegir una convención para ese punto.

Una unidad que permanece siempre en la región negativa no transmite gradiente a través de esa activation. El comportamiento depende de pesos, bias, datos y actualizaciones. Tampoco basta con cambiar tanh por ReLU en una línea y conservar sin análisis todos los demás supuestos.

En la construcción manual de XOR del primer artículo, ReLU crea dos features concretas. El experimento entrenado de esta serie usa tanh. La gráfica siguiente compara funciones matemáticas; **no es una comparación de entrenamientos**.

<img src="/assets/visuals/neural-foundations/DL-ACTIVATIONS.svg" alt="Por qué las activations cambian la familia de funciones y la sensibilidad del entrenamiento. El diagrama separa entradas, representación y decisión, indicando límites para no confundir una cuenta o un entrenamiento sintético con una garantía general." width="288" height="813" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/neural-foundations/DL-ACTIVATIONS.svg).

<img src="/assets/interactive/neural-foundations/activations.svg" alt="Curvas de tanh, sigmoid y ReLU calculadas en el mismo rango de ejes. Se observan saturación y región plana, pero no se representan pérdidas de entrenamiento ni se declara una función ganadora." width="380" height="385" loading="lazy" style="width:100%;height:auto" />

[Ampliar las curvas](/assets/interactive/neural-foundations/activations.svg).

## Una loss desde logits evita otro problema numérico

Para targets binarios, usamos `mean(logaddexp(0, z) − y × z)`. Los logaritmos son naturales y la loss media se expresa en nats por muestra. Es una forma estable de la binary cross entropy desde logits. `np.logaddexp` calcula el logaritmo de una suma de exponenciales sin exigir construir primero esa suma de forma ingenua, según su [documentación](https://numpy.org/doc/stable/reference/generated/numpy.logaddexp.html).

Si primero redondeamos una sigmoid a 0 o 1 y después calculamos logaritmos, podemos obtener infinitos evitables. La loss del laboratorio valida shapes y valores; una salida fuera de rango o un target mal formado no se silencia con un clipping arbitrario.

## La escala de los pesos y la activation se influyen mutuamente

Pesos iniciales grandes pueden llevar muchas unidades a saturación antes de aprender. Pesos pequeños o simetrías también pueden limitar el progreso. El trabajo de [Glorot y Bengio](https://proceedings.mlr.press/v9/glorot10a.html) analiza la relación entre inicialización, activaciones y señales a través de las capas.

El siguiente experimento utilizará una inicialización uniforme con un límite que depende de fan-in y fan-out. Mostraremos además qué pasa al poner todos los pesos a cero. Es un contraste acotado, no una evaluación de todas las estrategias de inicialización.

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

Los tests verifican valores, estabilidad numérica y gradientes de nuestra MLP con tanh mediante diferencias finitas. No prueban ausencia de inestabilidad en redes profundas ni comparan ReLU y tanh entrenadas sobre el mismo dataset. El visor permite explorar las funciones por separado y conserva esa distinción.

## Ejercicio: distinguir salida y capa oculta

Explica por qué una clasificación binaria puede usar tanh en la capa oculta y sigmoid al interpretar el logit final. Calcula la derivada de tanh en cero y compárala con la de z=5. Después continúa con el entrenamiento para observar pesos y curvas reales del juguete.

Continúa con [Una MLP con NumPy: entrenar XOR y observar dónde falla](/posts/mlp-numpy-entrenar-xor-pesos-curvas).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026; documentación NumPy 2.5 y runtime exacto NumPy 2.5.3. Los datos y resultados numéricos del juguete proceden de nuestro laboratorio.

- [NumPy tanh](https://numpy.org/doc/stable/reference/generated/numpy.tanh.html).
- [NumPy logaddexp](https://numpy.org/doc/stable/reference/generated/numpy.logaddexp.html).
- [Glorot y Bengio (2010)](https://proceedings.mlr.press/v9/glorot10a.html).
