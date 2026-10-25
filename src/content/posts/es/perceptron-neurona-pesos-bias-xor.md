---
id: "P096"
title: "Perceptrón y neurona artificial: qué pueden decidir unos pesos y un bias"
published: "2026-10-25T18:00:00Z"
locale: "es"
translationKey: "neural-foundations-p096"
slug: "perceptron-neurona-pesos-bias-xor"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P076", "P078", "P079"]
description: "Por qué una frontera afín puede resolver unas reglas y no XOR. Ejemplos NumPy probados, diagramas y límites explícitos."
author: "Luis Ramírez Calle"
series: "Redes neuronales desde sus fundamentos: representar y aprender"
tags: ["deep-learning", "numpy", "redes-neuronales", "machine-learning"]
---

Un clasificador acierta cuando una señal supera un umbral, pero falla en cuanto la regla depende de combinar dos señales de otra manera. Aumentar las iteraciones de entrenamiento no siempre ayuda: puede que la función que hemos elegido no permita representar esa regla.

Comenzamos **Redes neuronales desde sus fundamentos** con una pregunta concreta: ¿qué puede decidir una neurona y dónde aparece la necesidad de combinar varias? Recuperaremos [vectores y matrices](/posts/vectores-matrices-tensores-similitud), [derivadas](/posts/derivadas-gradientes-regla-cadena) y [gradient descent](/posts/gradiente-descendente-learning-rate-convergencia) solo cuando los necesitemos.

## Weights y bias definen un score antes de decidir una clase

Para dos features, una unidad puede calcular:

`z = w1 × x1 + w2 × x2 + b`

Los **weights** multiplican las features y el **bias** añade un desplazamiento. Si decidimos clase 1 cuando `z ≥ 0`, la frontera de decisión es la recta `w1 × x1 + w2 × x2 + b = 0`. En más dimensiones sería un hiperplano.

El bias permite desplazar la frontera sin obligarla a pasar por el origen. Un peso positivo hace crecer el score al aumentar esa feature, manteniendo las demás constantes. Eso describe el modelo, no demuestra una relación causal en los datos.

Por ejemplo, con pesos 1 y 1 y bias −1,5, los puntos binarios solo superan el umbral cuando ambas entradas valen 1. Hemos construido una función AND a mano. Todavía no hemos entrenado nada.

## El perceptrón clásico y una salida sigmoid tienen diferencias

Un **perceptrón** clásico combina un score afín con una decisión de umbral. Su regla de actualización histórica no es el entrenamiento por binary cross entropy que utilizaremos en el laboratorio.

Una unidad con **sigmoid** transforma el score en un valor entre cero y uno. Si aplicamos umbral 0,5, su frontera vuelve a ser `z = 0`, porque sigmoid es creciente y vale 0,5 en cero. Cambia la salida y el modo de entrenar; la frontera sigue siendo afín para esas features.

Un valor de 0,9 puede interpretarse como probabilidad propuesta por el modelo bajo sus supuestos. La calibración requiere evaluación adicional. No se convierte en probabilidad fiable solo por estar dentro del intervalo correcto.

## XOR muestra una limitación de la familia de funciones

**XOR**, exclusive or, devuelve 1 cuando las entradas binarias son distintas. Queremos estas cuatro decisiones:

<div role="region" aria-label="Tabla de XOR sobre dos entradas binarias" tabindex="0" style="overflow-x:auto">

| x1 | x2 | Clase |
| --- | --- | --- |
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

</div>

Para un clasificador afín que asigna 1 si `z ≥ 0`, el primer punto exige `b < 0`. Los dos positivos exigen `w1 + b ≥ 0` y `w2 + b ≥ 0`. Al sumarlos obtenemos `w1 + w2 + 2b ≥ 0`.

Por tanto, `w1 + w2 + b ≥ −b > 0`. Pero el último punto necesita precisamente `w1 + w2 + b < 0`. Las condiciones se contradicen. Ningún ajuste de esos tres parámetros satisface la tabla completa con esa regla de decisión.

La demostración no depende de que gradient descent haya funcionado bien o mal. Hemos descartado la existencia de una frontera de esa familia para los cuatro puntos.

<img src="/assets/visuals/neural-foundations/P096.svg" alt="Por qué una frontera afín puede resolver unas reglas y no XOR. El diagrama separa entradas, representación y decisión, indicando límites para no confundir una cuenta o un entrenamiento sintético con una garantía general." width="309" height="813" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/neural-foundations/P096.svg).

## Nuevas features pueden cambiar lo que separa una recta

Construimos dos features a partir de `s = x1 + x2`: `h1 = max(0, s)` y `h2 = max(0, s − 1)`. Para las entradas binarias, el score `h1 − 2 × h2` produce 0, 1, 1 y 0.

El archivo `packages/neural-foundations/neural.py` implementa esa construcción exacta:

```python
def xor_features(bits: Array) -> Array:
    if bits.ndim != 2 or bits.shape[1] != 2 or not np.all((bits == 0) | (bits == 1)):
        raise ValueError("this exact construction is for two binary inputs")
    total = bits.sum(axis=1)
    return np.column_stack([np.maximum(0, total), np.maximum(0, total - 1)])
```

`np.column_stack` coloca una feature en cada columna. Los dos `maximum` aplican **ReLU** elemento a elemento. El test comprueba los cuatro resultados, usando después un umbral 0,5 para decidir la clase.

Ahora la salida es lineal respecto a las features ocultas, pero esas features son funciones no lineales de las entradas. Ese cambio de representación permite una decisión que una sola frontera sobre `x1, x2` no podía expresar.

## Representar una solución no es aprenderla de datos

Hemos escogido las fórmulas y coeficientes conociendo XOR. Una **MLP**, multilayer perceptron, puede ajustar parámetros de una representación mediante una loss y un algoritmo de entrenamiento.

El capítulo de [feedforward networks de Goodfellow, Bengio y Courville](https://www.deeplearningbook.org/contents/mlp.html) desarrolla esta relación entre composición y representación. Aquí separaremos tres pasos: definir la familia, ejecutar entrenamiento y evaluar el modelo resultante.

En la cuarta entrega entrenaremos una MLP sobre puntos continuos alrededor de cuatro centros, con train, validation y test distintos. Esa prueba también tiene límites: un juguete sintético no representa todos los problemas no lineales ni demuestra generalización al mundo real.

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

La contradicción demuestra la imposibilidad de resolver esa tabla XOR con una frontera afín y el umbral declarado. La construcción con ReLU demuestra una representación concreta sobre cuatro entradas binarias. No demuestra que una rutina de entrenamiento encuentre esos parámetros ni que esa construcción resuelva datos arbitrarios.

## Ejercicio: cambiar la regla antes del modelo

Repite las desigualdades para AND y encuentra unos pesos y un bias que funcionen. Después explica por qué cambiar el learning rate no elimina la contradicción de XOR. La siguiente entrega traduce estas unidades a matrices para poder procesar un batch completo.

Continúa con [Dense layers: leer una red neuronal como operaciones entre matrices](/posts/dense-layers-batches-matrices-dimensiones).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026; documentación NumPy 2.5 y runtime exacto NumPy 2.5.3. Los datos y resultados numéricos del juguete proceden de nuestro laboratorio.

- [Deep Feedforward Networks, Goodfellow, Bengio y Courville](https://www.deeplearningbook.org/contents/mlp.html).
