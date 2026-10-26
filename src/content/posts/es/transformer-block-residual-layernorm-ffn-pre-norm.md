---
id: "DL-TRANSFORMER-BLOCK"
title: "Un bloque Transformer: atención, residual, LayerNorm y FFN resuelven tareas distintas"
published: "2026-10-26T02:05:00Z"
locale: "es"
translationKey: "attention-transformer-dl-transformer-block"
slug: "transformer-block-residual-layernorm-ffn-pre-norm"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-POSITIONAL", "DL-LAYERNORM"]
description: "Qué transforma cada subcapa y dónde se normaliza en el bloque del laboratorio. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Una multiplicación de atención mezcla información entre posiciones, pero todavía no describe un bloque Transformer completo. También necesitamos explicar cómo conserva una representación de entrada, cómo normaliza y qué transformación aplica a cada posición después de mezclar contexto.

Tras [añadir señales de posición](/posts/positional-encodings-sinusoidales-orden-permutaciones), reconstruiremos un bloque **pre-norm**. Mantendremos visibles sus dos sumas residuales y lo contrastaremos con una capa nativa configurada con los mismos pesos.

## Atención y FFN trabajan sobre ejes diferentes

La subcapa de atención combina values de otras posiciones según cada query y su máscara. Puede cambiar una representación usando contenido de su contexto permitido.

La **feed-forward network**, o FFN, transforma después cada posición de forma independiente. Comparte sus parámetros entre posiciones, pero no mezcla sus filas entre sí. Aquí usa dos capas lineales 8→16→8 con ReLU entre ambas.

No es equivalente a eliminar la FFN y añadir más heads. Una decide cómo consultar contexto; la otra aplica una transformación no lineal al vector de cada posición. Su composición añade operaciones que una sola suma ponderada no describe.

<img src="/assets/visuals/attention-transformer/DL-TRANSFORMER-BLOCK.svg" alt="Qué transforma cada subcapa y dónde se normaliza en el bloque del laboratorio. El diagrama muestra las dependencias de las operaciones del laboratorio." width="387" height="1124" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Pre-norm coloca LayerNorm antes de cada subcapa

Nuestro bloque calcula:

<div role="region" aria-label="Cálculo 2: Un bloque Transformer: atención, residual, LayerNorm y FFN resuelven tareas distintas" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
\begin{aligned}
u&=x+\operatorname{Attention}(\operatorname{LN}_1(x)),\\
y&=u+\operatorname{FFN}(\operatorname{LN}_2(u)).
\end{aligned}
$$
</div>


Las LayerNorm actúan sobre los ocho componentes de cada posición, sin mezclar pasos ni muestras. Así no introducen acceso al futuro a través de estadísticas calculadas sobre todo el eje temporal.

En `TransformerBlock.forward`:

```python
        normalized=self.norm1(x)
        attended,trace=self.attention(normalized,normalized,allowed)
        after_attention=x+attended
        after_feed_forward=after_attention+self.feed_forward(self.norm2(after_attention))
```

La primera suma conserva x como camino directo. La segunda conserva la respuesta después de atención. No se sobrescriben esos caminos con una normalización posterior dentro de este bloque.

## El residual conserva un camino, no una garantía general de aprendizaje

Si anulamos las salidas de ambas subcapas, el bloque pre-norm devuelve exactamente su entrada. El test pone a cero las proyecciones de salida pertinentes y comprueba esa propiedad.

No basta con poner a cero una matriz al azar: un bias posterior podría seguir produciendo una contribución. El control desactiva también esos biases para expresar el caso que queremos probar.

Que exista un camino de identidad no implica que todo el Jacobiano del bloque sea identidad ni que una red profunda entrene sin problemas. Las subcapas restantes pueden añadir sus propias derivadas.

Además, nuestro modelo completo tiene una LayerNorm final antes de la head. Aunque el bloque aislado conserve x en ese control, la salida completa no tiene por qué ser x. Mantener separados bloque y modelo evita una garantía demasiado amplia.

## Esta variante no reproduce exactamente el bloque original de 2017

El trabajo **Attention Is All You Need** presentó el patrón de atención, FFN, conexiones residuales y normalización. Su disposición de Add & Norm es post-norm, diferente de la que ejecutamos aquí.

Elegimos pre-norm para que el recorrido del laboratorio sea explícito y se pueda contrastar con `norm_first=True` en PyTorch. No usamos esta elección para afirmar superioridad de entrenamiento: no hemos entrenado ninguno de los dos diseños en este bloque.

Tampoco aplicamos dropout. Las llamadas de atención funcional reciben cero explícitamente. Incluir dropout obligaría a separar resultados deterministas de entrenamiento y evaluación antes de comparar arrays.

## El presupuesto del bloque se puede reconstruir

Con ancho ocho y dos heads:

<div role="region" aria-label="Cálculo 1: Un bloque Transformer: atención, residual, LayerNorm y FFN resuelven tareas distintas" tabindex="0" style="overflow-x:auto;max-width:100%">

| Componente | Parámetros registrados |
| --- | --- |
| Atención Q/K/V y salida | 288 |
| Dos LayerNorm con affine | 32 |
| FFN 8→16→8 con biases | 280 |
| Total del bloque | 600 |

</div>

La FFN incluye 144 parámetros en la primera capa y 136 en la segunda. LayerNorm aporta escala y desplazamiento por componente. El embedding, la posición y la head se cuentan aparte; la señal sinusoidal no añade parámetros aprendidos.

Contar parámetros no mide activaciones almacenadas, operaciones o tiempo. Una secuencia más larga aumenta el trabajo aunque las matrices registradas conserven su tamaño.

## Copiar pesos permite contrastar el bloque completo

El test construye `TransformerEncoderLayer` con ancho ocho, dos heads, FFN de dieciséis, ReLU, dropout cero y pre-norm. Copia Q/K/V, salida, FFN y ambas normalizaciones.

Después convierte la máscara al convenio de la capa nativa y compara el tensor final. Una prueba de esta composición puede detectar un error que no aparecería al comprobar cada matriz por separado, como normalizar el tensor equivocado o sumar la rama residual en otro punto.

## Garantías y límites

El contraste usa float64 en CPU y tolerancias explícitas. No se reproduce un entrenamiento del paper de 2017 ni se mide estabilidad a cientos de capas.

Los bloques encoder y decoder de los siguientes artículos reutilizan estas operaciones, con políticas de acceso y orígenes de Q/K/V diferentes. La estructura seguirá siendo comprobable sin atribuir calidad predictiva a pesos inicializados.

## Ejercicio: distingue el bloque de su envoltorio

Anula las dos subcapas en el cálculo manual y conserva las sumas residuales. Después añade una LayerNorm al final. Explica por qué el primer resultado puede ser idéntico a la entrada y el segundo no, aunque ambos mantengan la misma shape.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/transformer.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/tests/test_attention.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/attention-transformer test:container
pnpm --dir packages/attention-transformer verify
pnpm --dir packages/attention-transformer test
```

`verify` recalcula los nueve casos de atención y tres inicializaciones de cada arquitectura, incluidos controles y gradientes. No entrena modelos ni compara solo hashes. `exercise` regenera observaciones y `render` las figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. El README concreta versiones y tolerancias.

## Referencias

- [TransformerEncoderLayer](https://docs.pytorch.org/docs/2.14/generated/torch.nn.TransformerEncoderLayer.html).
- [Arquitectura original](https://arxiv.org/html/1706.03762v7).

## Continuar la serie

Anterior: [Positional encodings: dar coordenadas a una atención que respeta las permutaciones](/posts/positional-encodings-sinusoidales-orden-permutaciones). Siguiente: [Encoder y decoder: quién consulta a quién en cross-attention](/posts/transformer-encoder-decoder-cross-attention-contexto).
