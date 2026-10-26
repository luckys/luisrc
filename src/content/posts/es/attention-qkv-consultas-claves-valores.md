---
id: "P103"
title: "Atención con Q/K/V: consultar y combinar una secuencia sin reducirla a un solo estado"
published: "2026-10-26T02:00:00Z"
locale: "es"
translationKey: "attention-transformer-p103"
slug: "attention-qkv-consultas-claves-valores"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P076", "P084", "P099", "P102"]
description: "Cómo una consulta produce una combinación de valores a partir de compatibilidades con claves. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Un estado recurrente debe conservar la información que necesitará más adelante. La atención ofrece otra operación: para cada posición, consultar un conjunto de representaciones y construir una combinación distinta de sus valores.

Después de [RNN, LSTM y GRU](/posts/teacher-forcing-generacion-autoregresiva-evaluacion), reconstruiremos un Transformer con tensores pequeños. Este laboratorio no entrena un modelo de lenguaje. Su objetivo es comprobar matrices, ejes y acceso a información antes de interpretar una predicción.

## Query, key y value son representaciones con papeles diferentes

Una **query** describe la consulta de una posición. Una **key** se usa para calcular su compatibilidad con esa consulta. Un **value** contiene la representación que se combinará para producir la respuesta.

En **self-attention**, los tres se obtienen de la misma secuencia de entrada, mediante proyecciones diferentes:

<div role="region" aria-label="Cálculo 1: Atención con Q/K/V: consultar y combinar una secuencia sin reducirla a un solo estado" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V.
$$
</div>


La notación usa vectores fila y omite biases para mostrar la estructura. Los módulos Linear de PyTorch almacenan la matriz transpuesta respecto a esa escritura y nuestro código incluye bias. No copiamos una matriz entre convenciones sin revisar sus ejes.

Que Q, K y V procedan de X no significa que sean iguales. Sus proyecciones tienen parámetros distintos. En cross-attention, además, Q y el par K/V pueden proceder de secuencias diferentes.

<img src="/assets/visuals/attention-transformer/P103.svg" alt="Cómo una consulta produce una combinación de valores a partir de compatibilidades con claves. El diagrama muestra las dependencias de las operaciones del laboratorio." width="402" height="696" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Los scores comparan cada query con todas las keys disponibles

Para una query $q_i$ y una key $k_j$, calculamos un producto escalar. Reunir todos esos productos produce una matriz de scores con una fila por query y una columna por key.

Si tenemos cuatro queries y cinco keys, esa matriz es 4 × 5. No exige que el número de posiciones coincida. Sí exige que query y key tengan la misma cantidad de componentes para poder multiplicarlas.

En una head, la operación escalada es:

<div role="region" aria-label="Cálculo 2: Atención con Q/K/V: consultar y combinar una secuencia sin reducirla a un solo estado" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
S=\frac{QK^\top}{\sqrt{d_k}}.
$$
</div>


$d_k$ es la dimensión de las queries y keys de esa head. En el siguiente artículo veremos por qué aparece ese factor; ahora necesitamos conservarlo para que el cálculo coincida con la implementación.

## Softmax normaliza las keys de una misma query

Aplicamos softmax a cada fila de scores. Sus pesos son no negativos y suman uno entre las keys permitidas. Así cada query obtiene su propia distribución de atención.

Después combinamos los values:

<div role="region" aria-label="Cálculo 3: Atención con Q/K/V: consultar y combinar una secuencia sin reducirla a un solo estado" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
A=\operatorname{softmax}(S),\qquad O=AV.
$$
</div>


El resultado mantiene una fila por query y tiene tantos componentes como cada value. No devuelve necesariamente el value de una posición concreta: puede mezclar varios.

Normalizar sobre el eje de queries resolvería otra operación. Las shapes podrían seguir siendo válidas y el programa devolver números finitos. Por eso los tests comprueban la suma por fila y la suma ponderada, además de la dimensión final.

## Un ejemplo de dos posiciones permite comprobar la suma

Tomamos $q=[1,0]$, keys $[1,0]$ y $[0,1]$, y values $[2,4]$ y $[8,10]$. Los scores escalados son aproximadamente 0,707107 y 0.

Softmax produce pesos 0,669762 y 0,330238. La respuesta resulta aproximadamente:

<div role="region" aria-label="Cálculo 4: Atención con Q/K/V: consultar y combinar una secuencia sin reducirla a un solo estado" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
0{,}669762[2,4]+0{,}330238[8,10]
\approx[3{,}98143,5{,}98143].
$$
</div>


La segunda componente no es una probabilidad: es un valor combinado. Los pesos suman uno, pero los componentes de los values pueden tener magnitudes y signos arbitrarios.

`test_controlled_weighted_sum_and_manual_row` contrasta este ejemplo con la fórmula analítica. Los casos completos se comparan después con SDPA y MultiheadAttention de PyTorch.

Este mapa corresponde a otro caso del laboratorio: cinco posiciones, con una máscara causal que desarrollaremos después. Las cruces marcan accesos excluidos; cada fila reparte peso entre las keys que sí puede consultar.

<img src="/assets/interactive/attention-transformer/attention-weights.svg" alt="Pesos de self-attention causal sobre cinco posiciones con seed 7 y head cero, calculados con parámetros inicializados. Las cruces distinguen accesos excluidos de valores permitidos pequeños." width="380" height="396" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Proyectar y combinar no son el mismo tipo de peso

En `MultiHead.forward`, las proyecciones se calculan por separado:

```python
        query=self.split(self.query(query_input))
        key=self.split(self.key(context_input))
        value=self.split(self.value(context_input))
```

Los parámetros de esas capas son persistentes y se aprenderían durante entrenamiento. Los coeficientes de atención se recalculan para cada entrada. No guardamos un coeficiente fijo que diga cuánto debe atender siempre el token 2 al token 4.

El método `split` separa heads, que desarrollaremos después. El mecanismo básico sigue siendo comparar queries con keys y sumar values usando los coeficientes obtenidos.

## Atención alta no es una explicación semántica automática

En nuestro laboratorio los parámetros se inicializan y no se entrenan. Una key con peso alto no queda identificada como «el sujeto de la frase» ni como la causa de una decisión aprendida.

Incluso en un modelo entrenado, interpretar esos coeficientes requiere considerar values, proyección de salida, otras heads y capas posteriores. El mapa permite observar una operación, no sustituye un análisis de comportamiento.

## Garantías y límites

La implementación conserva Q/K/V, scores, máscara, pesos, contexto por head, concat y salida. Los tests contrastan forward y gradientes con PyTorch. El visor permite seleccionar query, key y componente del value para revisar cada contribución.

No se mide comprensión, calidad generativa o rendimiento de hardware. El primer resultado que buscamos es más concreto: que las matrices hagan la operación que estamos explicando.

## Ejercicio: separa compatibilidad de contenido

Mantén Q y K y cambia solo V. Predice qué permanece igual en scores y pesos, y qué cambia en la respuesta. Después cambia K sin modificar V y explica por qué ahora se altera qué combinación recibe cada query.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/attention.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/tests/test_attention.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/attention-transformer test:container
pnpm --dir packages/attention-transformer verify
pnpm --dir packages/attention-transformer test
```

`verify` recalcula los nueve casos de atención y tres inicializaciones de cada arquitectura, incluidos controles y gradientes. No entrena modelos ni compara solo hashes. `exercise` regenera observaciones y `render` las figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. El README concreta versiones y tolerancias.

## Explorar matrices y controles

<iframe src="/assets/interactive/attention-transformer/explorer.html" title="Explorar matrices de atención, máscaras, posiciones y causalidad" loading="lazy" style="width:100%;height:1200px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor de atención](/assets/interactive/attention-transformer/explorer.html).

## Referencias

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762).
- [Scaled dot-product attention, PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html).

## Continuar la serie

Siguiente: [Scaled dot-product: por qué dividir antes de softmax y cómo evitar overflow](/posts/scaled-dot-product-attention-softmax-estable).
