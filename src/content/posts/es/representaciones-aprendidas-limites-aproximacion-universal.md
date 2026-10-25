---
id: "DL-REPRESENTATIONS"
title: "Representaciones aprendidas: qué significa que una red pueda aproximar una función"
published: "2026-10-25T18:04:00Z"
locale: "es"
translationKey: "neural-foundations-dl-representations"
slug: "representaciones-aprendidas-limites-aproximacion-universal"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-XOR"]
description: "Cómo interpretar features ocultas y separar representabilidad, optimización y generalización. Ejemplos NumPy probados, diagramas y límites explícitos."
author: "Luis Ramírez Calle"
series: "Redes neuronales desde sus fundamentos: representar y aprender"
tags: ["deep-learning", "numpy", "redes-neuronales", "machine-learning"]
---

La MLP clasifica todos los puntos de test del juguete y el mapa muestra regiones de color muy definidas. Es fácil dar un paso de más y concluir que ha aprendido la regla correcta en todo el plano. Ese test no contiene todo el plano.

Después de [entrenar XOR](/posts/mlp-numpy-entrenar-xor-pesos-curvas), vamos a inspeccionar la representación oculta y separar tres preguntas: qué funciones puede representar la arquitectura, qué pesos encontró el entrenamiento y sobre qué datos hemos evaluado el resultado.

## Una hidden representation es una nueva descripción de la entrada

En nuestra MLP, H tiene cuatro columnas. Para cada punto, esas cuatro activaciones son las features que recibe la capa de salida. Se calculan con pesos aprendidos, bias y tanh.

La salida sigue formando una combinación afín de H. Lo que ha cambiado es cómo se describe el punto antes de esa combinación. Las curvas que vemos en el espacio original aparecen por la composición de funciones.

En el bucle de snapshots de `packages/neural-foundations/experiments.py`, guardamos probes para contrastar la inferencia del visor:

```python
            logits, hidden = forward(probes, parameters)
            snapshot['probeProbability'] = sigmoid(logits).ravel().tolist()
            snapshot['probeHidden'] = hidden.tolist() if width else None
```

`probes` son ocho puntos declarados en el protocolo. Son entradas de inspección, no un conjunto añadido para entrenar. Guardamos tanto la salida como los valores ocultos. El test de JavaScript compara su inferencia con estas observaciones NumPy en todos los checkpoints.

## Una unidad oculta no tiene una semántica fija entre entrenamientos

Abre el [visor de representaciones](/assets/interactive/neural-foundations/explorer.html), selecciona MLP seed 7, checkpoint 3000 y «Activación de una unidad oculta». Cambia entre h1 y h4. El mapa muestra el valor de una columna de H sobre el mismo grid, con rango −1 a 1.

Esas unidades no vienen etiquetadas como «XOR» o «clase positiva». La decisión final depende de combinarlas con los pesos de salida. Una unidad que parece detectar una región puede contribuir positiva o negativamente según ese peso.

Al cambiar de semilla, la unidad con índice h1 no tiene por qué conservar la misma función. Permutar unidades ocultas y permutar de forma consistente los pesos de salida puede conservar la función completa. El índice de una columna es una posición de implementación, no una identidad semántica garantizada.

<img src="/assets/visuals/neural-foundations/DL-REPRESENTATIONS.svg" alt="Cómo interpretar features ocultas y separar representabilidad, optimización y generalización. El diagrama separa entradas, representación y decisión, indicando límites para no confundir una cuenta o un entrenamiento sintético con una garantía general." width="298" height="829" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/neural-foundations/DL-REPRESENTATIONS.svg).

## El mapa incluye puntos que no aparecen en el soporte de datos

Los cuatro cuadrados del dataset tienen coordenadas alrededor de ±1 con desviación máxima 0,45. No hemos muestreado el hueco central ni franjas junto a los ejes.

El grid del visor cubre de −1,6 a 1,6 en cada eje. Allí podemos calcular una salida para cada punto, incluso donde no hay datos. Esa posibilidad de inferencia no equivale a haber evaluado la calidad de esas salidas.

El dibujo mantiene las cajas del soporte y usa un subconjunto fijo de validation para que esa diferencia sea visible. El color no certifica una frontera correcta fuera de las cajas. Si necesitáramos clasificar esa región, tendríamos que definir etiquetas, muestrearla adecuadamente y evaluar un protocolo nuevo.

## Universal approximation es un resultado de representación

Una formulación clásica de **universal approximation** establece que combinaciones finitas de unidades con una activation sigmoidal continua pueden aproximar uniformemente funciones continuas sobre el cubo unitario, con suficiente anchura. El [trabajo de Cybenko](https://papers.baulab.info/papers/Cybenko-1989.pdf) precisa esas condiciones.

El resultado habla de existencia de una aproximación y de sus hipótesis. No afirma que nuestra red de cuatro unidades sea suficiente para cualquier función, ni proporciona los pesos por haber visto unas muestras. La aproximación uniforme de funciones continuas tampoco significa reproducir exactamente una función con saltos en cada punto de su discontinuidad.

Una sigmoid y tanh están relacionadas mediante una transformación afín de entrada y salida: `tanh(z) = 2 × sigmoid(2z) − 1`. Esa relación ayuda a conectar familias de representación, pero no convierte nuestro entrenamiento finito en una prueba del teorema.

## Representar, optimizar y generalizar exigen evidencias distintas

**Representabilidad** pregunta si existen parámetros de la familia que aproximen la función considerada. La construcción manual de XOR del primer artículo aporta una solución concreta en su dominio binario.

**Optimización** pregunta si el algoritmo encontró parámetros que reducen la loss. El control con inicialización a cero muestra que una arquitectura capaz puede quedarse bloqueada bajo una configuración concreta.

**Generalización** pregunta cómo se comporta el resultado en datos no usados para ajustarlo, de una población relevante. Nuestro test independiente aporta evidencia limitada al generador y muestra declarados. No cubre nuevas reglas, ruido distinto o regiones no muestreadas.

Tampoco una alta accuracy demuestra calibración. Podríamos tener decisiones correctas y probabilidades exageradamente seguras. Ese análisis requiere métricas y datos apropiados, como vimos en [la evaluación de ML](/posts/metricas-ml-precision-recall-auc-errores).

## Qué cambiaría al pasar a un proyecto real

En NeuralLab, conservaría primero un baseline sencillo, un split ajustado al uso futuro y una definición de errores relevantes. Solo después compararía una MLP con alternativas mediante validation, dejando test para la evaluación acordada.

La representación aprendida puede resultar útil cuando la composición se adapta al problema, pero también añade parámetros y decisiones de entrenamiento. En tabular pequeño, un árbol o una regresión con features explícitas puede ser más fácil de mantener y suficientemente útil. Un buen resultado del juguete no resuelve esa elección.

Si el objetivo fuera estudiar robustez, diseñaría cambios de distribución explícitos y mediría el efecto. La inspección visual serviría para proponer hipótesis, no para reemplazar los datos de evaluación.

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

Se pueden reproducir pesos, activaciones e inferencias y contrastar el visor con NumPy. No se atribuyen explicaciones causales a unidades ocultas, no se acredita calibración y no se generaliza el resultado a todo el plano o a datos reales.

La evidencia de P096 cubre una MLP pequeña y conceptos de representación. La [serie de forward, backward y autodiff](/posts/computational-graph-regla-cadena-caminos) desarrolla el backward y su comprobación; el resto de Deep Learning sigue necesitando sus propios experimentos.

## Ejercicio: formular una afirmación que los datos sí soporten

Escribe una frase sobre los 256 puntos de test que pueda justificarse con el informe. Después escribe otra sobre el hueco central y señala qué evidencia faltaría para sostenerla. Finalmente, explica por qué el éxito de una semilla o un teorema de representación no sustituye esa prueba.

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026; documentación NumPy 2.5 y runtime exacto NumPy 2.5.3. Los datos y resultados numéricos del juguete proceden de nuestro laboratorio.

- [Cybenko (1989), Approximation by Superpositions of a Sigmoidal Function](https://papers.baulab.info/papers/Cybenko-1989.pdf).
