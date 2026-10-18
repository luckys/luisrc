---
id: P079
title: 'Gradient descent: por qué un learning rate puede acercarte al mínimo o alejarte'
published: 2026-10-18T00:03:00Z
locale: es
translationKey: math-gradient-descent
slug: gradiente-descendente-learning-rate-convergencia
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P078]
description: 'Deduce cuándo converge el descenso sobre una parábola y experimenta con el tamaño del paso y una función no convexa.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, optimizacion, gradientes, machine-learning]
---

El gradiente apunta en una dirección que reduce localmente la pérdida, pero cada actualización termina más lejos del mínimo. No hace falta una red neuronal para reproducirlo: basta una parábola y un paso demasiado grande.

Ya sabemos [calcular una derivada](/posts/derivadas-gradientes-regla-cadena). Ahora utilizaremos esa información para decidir una secuencia de cambios, y veremos por qué «seguir el gradiente» no basta para prometer convergencia.

## Gradient descent elige dirección y tamaño del paso

Una **objective function** asigna un valor a cada configuración de parámetros. Minimizarla significa buscar una configuración que reduzca ese valor. El descenso usa:

$$
x_{t+1}=x_t-\eta\nabla L(x_t).
$$

El gradiente indica el crecimiento local bajo la geometría euclídea habitual; su negativo proporciona una dirección de descenso infinitesimal si no es cero. El **learning rate** $\eta$ decide cuánto nos movemos. Que la dirección sea apropiada cerca del punto no valida cualquier distancia.

La primera solución ingenua elige un paso grande porque «así llegará antes». Eso puede cruzar el mínimo, entrar en una región más empinada y hacer crecer el siguiente salto.

## En una parábola podemos deducir la condición de convergencia

Con $L(x)=x^2$, el gradiente es $2x$. Sustituyendo:

$$
x_{t+1}=(1-2\eta)x_t.
$$

Cada actualización multiplica la posición por el mismo factor. Para reducir su magnitud desde un punto distinto de cero necesitamos $|1-2\eta|<1$, es decir, **$0<\eta<1$**.

Con $\eta=0.1$, el factor es 0,8. Con 0,8, es -0,6: saltamos de lado, pero nos acercamos. Con 1,1, es -1,2: alternamos de lado y nos alejamos. Para $\eta=1$ no reducimos la magnitud; para 0,5 llegamos a cero en un paso en aritmética exacta.

<img src="/assets/visuals/math-series/P079.svg" alt="Para la pérdida x al cuadrado, el descenso multiplica x por uno menos dos eta; el módulo se contrae entre cero y uno y crece por encima de uno." width="679" height="750" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P079.svg).

Esa deducción depende de esta función y de su escala. Si multiplicamos la pérdida por cien, el gradiente también cambia. No reutilices el intervalo de learning rates como regla universal.

Archivo: `matematicas-estadistica/foundations.py`, actualización dentro de `descend`.

```python
        next_value = values[-1] - rate*gradient(values[-1])
```

La función completa recibe el gradiente, el punto inicial, el paso y el número máximo de iteraciones. Conserva la trayectoria y se detiene si sale del límite numérico didáctico. No interpreta esa detención como convergencia.

<img src="/assets/visuals/math-series/learning-rates.svg" alt="Trayectorias calculadas de pérdida x al cuadrado: eta cero coma uno y cero coma ocho disminuyen; eta uno coma uno aumenta. El eje de pérdida es logarítmico." width="900" height="460" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/math-series/learning-rates.svg).

## Un gradiente cero no demuestra que hayamos encontrado un mínimo

La segunda función del simulador es $L(x)=(x^2-1)^2$. Tiene mínimos en -1 y 1, pero en cero su derivada también vale cero. Si empezamos exactamente ahí, el algoritmo no se mueve aunque la pérdida sea 1 y existan puntos con pérdida cero.

En varias dimensiones aparecen además **saddle points**, puntos estacionarios que no son mínimos ni máximos locales. Reducir el problema a «el optimizador encontrará el mejor valle» oculta estas posibilidades.

En entrenamiento real se añaden otros factores: ruido de mini-batches, escalas distintas por parámetro y objetivos que cambian con los datos. **Momentum**, schedules o métodos adaptativos son alternativas que estudiaremos después; no eliminan automáticamente todos esos problemas.

## Regularizar cambia el objetivo que estamos resolviendo

Una penalización $L_{total}=L_{datos}+\lambda\lVert w\rVert_2^2$ añade $2\lambda w$ al gradiente de esa parte. Favorece configuraciones con menor norma bajo esa parametrización, a cambio de modificar el compromiso de ajuste.

No es una reparación universal de un learning rate inestable ni demuestra mejor generalización. El coeficiente debe elegirse con un procedimiento de validación adecuado, no por el resultado del conjunto de test.

## Prueba el simulador con teclado

[Descarga el laboratorio](/assets/examples/matematicas-estadistica-lab.zip). Desde `matematicas-estadistica/`:

```bash
python3 -m http.server 4401 --bind 127.0.0.1
```

Abre `http://127.0.0.1:4401/simulator.html`. Cambia función, posición inicial y paso. La curva muestra pérdida frente a iteración; el eje vertical se adapta, por lo que conviene leer también los valores numéricos. Detén el servidor con Ctrl+C.

## Garantías y límites

Los tests comprueban contracción, divergencia y el punto estacionario del doble pozo. El simulador comparte esas ecuaciones y limita la trayectoria para evitar valores descontrolados. No entrena un modelo ni implementa optimización multidimensional.

## Ejercicio: cambiar la escala de la función

Usa $L(x)=100x^2$. Deduce primero el intervalo de pasos que contrae $|x|$ y después compruébalo: debe ser $0<\eta<0.01$. La aceptación exige relacionar el cambio con la derivada, no encontrar un número que casualmente funcione.

Pasamos a [cómo interpretar información incierta antes de aprender de los datos](/posts/probabilidad-bayes-prior-alertas).

## Referencias

- [Deep Learning: optimización y cálculo numérico](https://www.deeplearningbook.org/contents/numerical.html).
- [CS231n: descenso de gradiente](https://cs231n.github.io/optimization-1/).
- [Google ML Crash Course: pérdida y regularización](https://developers.google.com/machine-learning/crash-course/logistic-regression/loss-regularization).

Fuentes consultadas el 18 de octubre de 2026. Las curvas son trayectorias calculadas, no benchmarks de entrenamiento.
