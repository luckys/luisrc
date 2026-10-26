---
id: "DL-RECURRENT-GRADIENTS"
title: "Gradientes a través del tiempo: perder sensibilidad no equivale a olvidar al predecir"
published: "2026-10-26T01:06:00Z"
locale: "es"
translationKey: "recurrent-sequences-dl-recurrent-gradients"
slug: "rnn-vanishing-exploding-gradients-dependencias-largas"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GRU", "DL-GRADIENT-CLIPPING"]
description: "Qué significan los productos de Jacobianos y cómo contrastarlos sin forzar un fracaso. Código contrastado, estados reales y límites del experimento."
author: "Luis Ramírez Calle"
series: "Cómo aprende una red de una secuencia: estados, puertas y generación"
tags: ["deep-learning", "rnn", "pytorch", "sequences"]
---

Un modelo puede acertar qué símbolo apareció al principio y, aun así, tener una derivada diminuta respecto a su primer embedding. Ese resultado no es contradictorio: conservar una distinción durante el forward y aprenderla mediante un gradiente a distancia son preguntas relacionadas, pero diferentes.

Después de [las puertas de GRU](/posts/gru-reset-update-candidato-convencion-pytorch), vamos a estudiar productos de derivadas y contrastarlos con las predicciones. El laboratorio no fuerza a la RNN a fallar para que encaje en un relato conocido.

## El gradiente atraviesa una cadena de Jacobianos

Si el estado final depende de transiciones anteriores, un cambio en un estado temprano llega al final a través de varios pasos. En una cadena simple:

$$
\frac{\partial h_T}{\partial h_t}=J_TJ_{T-1}\cdots J_{t+1}.
$$

Cada $J$ es la derivada de una transición respecto a su estado anterior. En una RNN con tanh combina la matriz recurrente y la derivada de tanh en los valores que recorrió el forward.

Los productos pueden contraer unas direcciones y ampliar otras. No basta contar pasos o mirar un único peso. Tampoco podemos leer la norma total solo a partir de una multiplicación escalar si los estados son vectores y hay mezclas entre componentes.

<img src="/assets/visuals/recurrent-sequences/DL-RECURRENT-GRADIENTS.svg" alt="Qué significan los productos de Jacobianos y cómo contrastarlos sin forzar un fracaso. Relación de entradas, estados y decisiones del cálculo contrastado." width="424" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Un control escalar permite calcular el efecto exactamente

Construimos $h_t=\tanh(a h_{t-1})$ con $h_0=0$. El estado permanece a cero y la derivada de tanh en ese punto es 1. La derivada respecto al estado inicial es exactamente $a^T$.

El código de `probes.py` mantiene `start` como variable diferenciable:

```python
            start=torch.tensor(0.,dtype=torch.float64,requires_grad=True);state=start
            for _ in range(length):state=torch.tanh(a*state)
            row[name]=float(torch.autograd.grad(state,start)[0])
```

Con $a=0,5$ y 96 pasos, obtenemos aproximadamente $1,26218\cdot10^{-29}$. Con $a=1,2$, unos $3,99392\cdot10^7$. Autograd se contrasta con ambas potencias analíticas en float64.

No son dos redes entrenadas ni una medida sobre nuestro clasificador. Aíslan contracción y expansión sin confundirlas con datos, optimizador o una loss concreta.

<img src="/assets/interactive/recurrent-sequences/gradient-controls.svg" alt="Logaritmo decimal de derivadas positivas para dos recurrencias escalares tanh y un camino de memoria con coeficiente fijo 0,99, con resultados contrastados analíticamente." width="380" height="336" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El eje representa log10 de derivadas positivas, no sus valores sin transformar. Un valor −10 significa $10^{-10}$, no una derivada negativa.

## El camino directo de una cell state es un control distinto

Otro probe repite $c_t=0,99c_{t-1}$. Su derivada tras 96 pasos es $0,99^{96}\approx0,381047$. Ese camino conserva una contribución mucho mayor que $0,5^{96}$.

El coeficiente está fijado y no hay puertas dependientes de hidden state. Ilustra por qué un camino cercano a identidad puede ayudar, pero no sustituye la derivada total de LSTM. En una celda completa hay otras rutas y valores aprendidos.

El análisis de [Pascanu, Mikolov y Bengio](https://arxiv.org/abs/1211.5063) trata las dificultades del entrenamiento recurrente. Nuestros controles pequeños sirven para verificar mecanismos, no para reproducir todas las condiciones de ese trabajo.

## Los modelos entrenados aciertan todos los probes de longitud

Entrenamos con longitudes 4 a 12. Después evaluamos 128 muestras equilibradas para cada longitud 4, 8, 12, 24, 48 y 96, con generadores separados de train. RNN, LSTM y GRU obtienen accuracy 1 en las tres seeds.

<img src="/assets/interactive/recurrent-sequences/length-curves.svg" alt="Accuracy final de RNN, LSTM y GRU con seed 7 en seis longitudes discretas. Las tres curvas coinciden en uno, incluidos los probes fuera del rango de entrenamiento." width="380" height="336" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Los puntos corresponden a longitudes evaluadas; el espaciado visual es discreto y uniforme. No representa que el salto de 4 a 8 sea igual en tiempo al salto de 48 a 96, ni que hayamos medido todas las longitudes intermedias.

Recordar un bit es una tarea limitada. Su éxito no implica reconstruir una historia arbitraria o entender relaciones complejas a distancia. Estos probes tampoco son un test final usado para seleccionar un modelo de producción.

## La sensibilidad local de un modelo entrenado puede seguir siendo pequeña

Para la primera secuencia del probe de longitud 48 y seed 7, medimos la norma del gradiente del logit de la clase correcta respecto al embedding del primer paso:

<div role="region" aria-label="Tabla 1: Gradientes a través del tiempo: perder sensibilidad no equivale a olvidar al predecir" tabindex="0" style="overflow-x:auto;max-width:100%">

| Modelo | Norma en el primer embedding |
| --- | --- |
| RNN | 3,19836 × 10⁻²² |
| LSTM | 3,56772 × 10⁻⁷ |
| GRU | 1,94026 × 10⁻⁴ |

</div>

Es una traza concreta, no una media de población ni un ranking universal. Derivamos el logit, no la loss, para no mezclar sin explicación esta comparación con la derivada adicional de una predicción muy confiada.

Un ID es discreto. Cambiar de símbolo significa saltar a otra fila del embedding, mientras que esta derivada describe perturbaciones infinitesimales alrededor del vector actual. Que el gradiente local sea pequeño no impide distinguir dos entradas que producen trayectorias diferentes.

También importa cuándo se aprende: mantener una distinción ya adquirida durante un forward largo no exige necesariamente el mismo gradiente que descubrir esa distinción entrenando desde cero con una supervisión muy lejana.

## Clipping limita expansión; no reconstruye información perdida

El entrenamiento usa clipping de norma global 1. Eso limita el gradiente entregado al optimizador cuando excede ese umbral. No recupera una señal que ya se ha contraído ni aumenta la capacidad del estado.

No presentamos clipping como la causa identificada del éxito. No entrenamos una ablation sin él. El artículo de [gradient clipping](/posts/gradient-clipping-norma-paso-estabilidad) desarrolla sus garantías y sus límites con otros controles.

## Garantías y límites

Los tests contrastan las potencias analíticas y las derivadas calculadas. Las trazas reales conservan una norma por paso para longitudes 12 y 48. El visor muestra sus valores originales además de log10, con un suelo declarado de $10^{-30}$ para la representación gráfica.

No se ocultan ceros ni se inventa una caída de accuracy. Las tres seeds comparten datasets; no equivalen a tres poblaciones independientes. Para otro problema hay que variar contenido, distancia, capacidad y protocolo de forma controlada.

## Ejercicio: diferencia una perturbación local de cambiar un símbolo

Explica por qué sumar $10^{-6}$ a un componente del primer embedding y sustituir el primer ID por otro son intervenciones diferentes. Define qué medirías en cada una y qué resultado podría coexistir con accuracy final perfecta.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/probes.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/recurrent-sequences/tests/test_training.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/recurrent-sequences test:container
pnpm --dir packages/recurrent-sequences verify
pnpm --dir packages/recurrent-sequences test
```

`verify` vuelve a entrenar doce modelos y recalcula estados, gradientes y rollouts. No compara solo hashes. `exercise` regenera las observaciones y `render` sus figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. No requiere instalar Python o descargar datasets en el host. El README concreta versiones, tolerancias y límites.

## Consultar estados y predicciones

<iframe src="/assets/interactive/recurrent-sequences/explorer.html" title="Explorar embeddings, celdas, memoria y generación con resultados reales" loading="lazy" style="width:100%;height:1200px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor de secuencias](/assets/interactive/recurrent-sequences/explorer.html).

## Referencias

- [On the difficulty of training Recurrent Neural Networks](https://arxiv.org/abs/1211.5063).

## Continuar la serie

Anterior: [GRU: combinar estado y candidato sin una cell state separada](/posts/gru-reset-update-candidato-convencion-pytorch). Siguiente: [Teacher forcing: entrenar con el pasado correcto y generar con el propio](/posts/teacher-forcing-generacion-autoregresiva-evaluacion).
