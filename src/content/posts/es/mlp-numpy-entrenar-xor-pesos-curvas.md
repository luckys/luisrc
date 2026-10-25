---
id: "DL-XOR"
title: "Una MLP con NumPy: entrenar XOR y observar dónde falla"
published: "2026-10-25T18:03:00Z"
locale: "es"
translationKey: "neural-foundations-dl-xor"
slug: "mlp-numpy-entrenar-xor-pesos-curvas"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ACTIVATIONS", "P092", "P084"]
description: "Cómo entrenar una MLP pequeña con un protocolo fijo y controles negativos reproducibles. Ejemplos NumPy probados, diagramas y límites explícitos."
author: "Luis Ramírez Calle"
series: "Redes neuronales desde sus fundamentos: representar y aprender"
tags: ["deep-learning", "numpy", "redes-neuronales", "machine-learning"]
---

Una fórmula demuestra que existe una red capaz de representar XOR, pero todavía falta encontrar unos pesos mediante entrenamiento. Y una implementación puede tener la arquitectura adecuada y quedarse produciendo 0,5 para todos los puntos.

Vamos a entrenar una **MLP con NumPy**, contrastarla con una regresión logística y provocar un fallo con inicialización a cero. Los resultados que siguen se han ejecutado con el protocolo y el runtime archivados. No son curvas dibujadas para ilustrar cómo debería aprender una red.

## El dataset amplía XOR sin usar solo cuatro filas

Generamos puntos uniformes alrededor de los centros `(−1, −1)`, `(−1, 1)`, `(1, −1)` y `(1, 1)`. Cada coordenada puede desviarse hasta 0,45. Asignamos clase 1 a los centros de signos distintos y clase 0 a los otros dos.

Es la misma regla binaria con 0 recodificado como −1 y 1 como +1, ampliada con variación alrededor de cada centro.

Quedan cuatro cuadrados separados, con un hueco alrededor de los ejes. Train contiene **256 puntos**, validation **128** y test **256**, balanceados por clase. Los seeds de generación son 101, 102 y 103. No son particiones de las mismas filas: se generan independientemente y se comprueba que no hay puntos idénticos compartidos.

Las tres muestras proceden de la misma distribución sintética. Un resultado en test describe esa distribución y ese tamaño de muestra. No evalúa puntos en el hueco, cambios de distribución ni datos de un producto.

## Fijamos los recorridos antes de mirar test

El archivo `packages/neural-foundations/protocol.json` fija 3000 epochs, learning rate 0,1, full-batch, float64 y snapshots cada 150 epochs. Ejecutamos una regresión logística, una MLP de ancho cuatro con todos los pesos a cero y tres MLP con semillas **7, 19 y 31**.

Todas usan los mismos datos y la misma binary cross entropy. No hay early stopping ni selección de semilla por test. Validation se registra para observar el entrenamiento; no participa en el cálculo de gradientes. Test se evalúa al final de cada recorrido declarado.

La MLP tiene arquitectura 2→4→1 y tanh oculta. En `packages/neural-foundations/neural.py`, la inicialización es:

```python
def initialize(width: int, seed: int, zero: bool = False) -> list[Layer]:
    if not isinstance(width, int) or width < 0 or width > 8:
        raise ValueError("width must be 0 (linear) or 1..8")
    rng = np.random.default_rng(seed)
    dimensions = [2, width, 1] if width else [2, 1]
    layers = []
    for inputs, outputs in zip(dimensions[:-1], dimensions[1:]):
        bound = np.sqrt(6 / (inputs + outputs))
        weight = rng.uniform(-bound, bound, (inputs, outputs))
        # A zero linear baseline is intentional; hidden zeros are a negative control.
        if zero or width == 0:
            weight = np.zeros_like(weight)
        layers.append(Layer(weight, np.zeros(outputs)))
    return layers
```

El límite `sqrt(6 / (fan_in + fan_out))` define la escala uniforme utilizada, relacionada con la inicialización de [Glorot y Bengio](https://proceedings.mlr.press/v9/glorot10a.html). Los bias empiezan a cero. La rama `zero` es un control negativo de la MLP; la regresión logística también empieza a cero, donde sí puede actualizar sus pesos sin el mismo bloqueo de una capa oculta.

## Cada epoch calcula gradientes sobre todo train

Este es `train` en `packages/neural-foundations/neural.py`:

```python
def train(x: Array, y: Array, vx: Array, vy: Array, layers: list[Layer],
          epochs: int, learning_rate: float, record_every: int) -> tuple[list[Layer], list[dict]]:
    if (not isinstance(epochs, int) or not 1 <= epochs <= 5000
            or not isinstance(record_every, int) or record_every < 1
            or not np.isfinite(learning_rate) or not 0 < learning_rate <= 1):
        raise ValueError("training parameters outside the bounded example")
    history = []
    for epoch in range(epochs + 1):
        if epoch % record_every == 0 or epoch == epochs:
            training = metrics(x, y, layers)
            validation = metrics(vx, vy, layers)
            history.append({"epoch": epoch, "trainLoss": training["loss"],
                            "validationLoss": validation["loss"],
                            "trainAccuracy": training["accuracy"],
                            "validationAccuracy": validation["accuracy"],
                            "layers": serialize(layers)})
        if epoch == epochs:
            break
        derivatives = gradients(x, y, layers)
        layers = [Layer(layer.weight - learning_rate * grad.weight,
                        layer.bias - learning_rate * grad.bias)
                  for layer, grad in zip(layers, derivatives)]
    return layers, history
```

En este protocolo, **una epoch corresponde a una actualización full-batch**. Primero registramos epoch 0, antes de aprender; después hay 3000 actualizaciones. El último snapshot contiene los parámetros posteriores a la actualización 3000.

`gradients` calcula derivadas de la loss respecto a cada weight y bias. Actualizamos parámetros restando learning rate por derivada. No usamos validation para esa cuenta. La derivación detallada del backward se desarrollará en P097; aquí se comprueba numéricamente cada uno de los diecisiete parámetros antes de confiar en el entrenamiento.

<img src="/assets/visuals/neural-foundations/DL-XOR.svg" alt="Cómo entrenar una MLP pequeña con un protocolo fijo y controles negativos reproducibles. El diagrama separa entradas, representación y decisión, indicando límites para no confundir una cuenta o un entrenamiento sintético con una garantía general." width="293" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/neural-foundations/DL-XOR.svg).

## El control con pesos a cero separa arquitectura de optimización

Con todos los pesos y bias a cero, tanh produce cero en cada unidad oculta y el logit final vale cero. Las probabilidades son 0,5. Para cualquiera de las dos etiquetas, esa predicción tiene loss `−ln(0,5) = ln(2)`, aproximadamente 0,693147 nats por muestra.

El gradiente de los pesos de salida multiplica esas activaciones cero. El gradiente de la capa oculta multiplica los pesos de salida cero. Además, el batch balanceado hace cero la media del error que movería el bias final. En este caso concreto, todo permanece igual.

No afirmamos que inicializar cualquier parámetro a cero impida entrenar. Los bias a cero de las MLP aleatorias funcionan aquí. El fallo depende de la simetría y del recorrido que acabamos de describir.

## Los cinco recorridos se muestran, incluidos los que no resuelven XOR

<div role="region" aria-label="Resultados observados del entrenamiento NumPy en datos sintéticos" tabindex="0" style="overflow-x:auto">

| Recorrido | Loss train final | Accuracy validation | Accuracy test |
| --- | --- | --- | --- |
| Regresión logística | 0,692934 | 0,50 | 0,50 |
| MLP pesos cero | 0,693147 | 0,50 | 0,50 |
| MLP seed 7 | 0,008298 | 1,00 | 1,00 |
| MLP seed 19 | 0,008070 | 1,00 | 1,00 |
| MLP seed 31 | 0,008628 | 1,00 | 1,00 |

</div>

Los decimales de la tabla son presentación redondeada. El informe conserva pesos y valores completos. Las tres MLP aleatorias aciertan los 256 puntos de test del juguete; eso no estima por sí solo una tasa de acierto general ni demuestra calibración.

<img src="/assets/interactive/neural-foundations/training-curves.svg" alt="Cinco curvas observadas de loss de entrenamiento con los mismos datos y protocolo. Las tres MLP aleatorias reducen la pérdida; la regresión logística y la MLP a cero permanecen cerca de log dos. No son medidas de tiempo." width="380" height="435" loading="lazy" style="width:100%;height:auto" />

Las curvas de logística y pesos a cero quedan casi superpuestas cerca de log(2); la leyenda conserva ambos recorridos.

[Ampliar las curvas de entrenamiento](/assets/interactive/neural-foundations/training-curves.svg).

<img src="/assets/interactive/neural-foundations/decision-maps.svg" alt="Mapas finales de regresión logística y MLP seed siete con el mismo grid y puntos de validation. Las cajas delimitan el soporte de datos. Los colores fuera de ellas son inferencia sin evaluación en esa región." width="380" height="930" loading="lazy" style="width:100%;height:auto" />

[Ampliar los mapas](/assets/interactive/neural-foundations/decision-maps.svg).

## El visor recorre pesos archivados, no reentrena el modelo

Puedes cambiar recorrido y checkpoint, observar train/validation e inspeccionar activaciones ocultas. Test solo aparece como resultado final. La semilla 7 se usa como vista inicial por protocolo de presentación, no por haber ganado una selección en test.

<iframe src="/assets/interactive/neural-foundations/explorer.html" title="Explorar entrenamiento NumPy y representaciones de XOR" loading="lazy" width="100%" height="2300" style="border:0;border-radius:12px"></iframe>

[Abrir el visor](/assets/interactive/neural-foundations/explorer.html).

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

El runtime está fijado por digest: Python 3.13.15 y NumPy 2.5.3, dos CPUs asignadas y un thread BLAS. No medimos rendimiento por segundo. Los tests comprueban shapes, loss estable, gradientes y controles. La verificación vuelve a entrenar los cinco recorridos con tolerancias numéricas declaradas.

Este problema es pequeño y deliberadamente fácil para una MLP. No demuestra que debamos sustituir árboles u otros modelos tabulares por redes, ni que tres semillas agoten la variabilidad del entrenamiento.

## Ejercicio: explicar una curva que no baja

Selecciona MLP a cero y compara su primer y último checkpoint. Explica el papel de activaciones, pesos de salida y batch balanceado. Después distingue ese fallo de la limitación afín de la regresión logística. La siguiente entrega analiza qué representan las features aprendidas y qué garantías siguen faltando.

Continúa con [Representaciones aprendidas: qué significa que una red pueda aproximar una función](/posts/representaciones-aprendidas-limites-aproximacion-universal).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026; documentación NumPy 2.5 y runtime exacto NumPy 2.5.3. Los datos y resultados numéricos del juguete proceden de nuestro laboratorio.

- [NumPy random Generator](https://numpy.org/doc/stable/reference/random/generator.html).
- [Glorot y Bengio (2010)](https://proceedings.mlr.press/v9/glorot10a.html).
