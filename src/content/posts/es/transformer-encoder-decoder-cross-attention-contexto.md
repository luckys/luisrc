---
id: "DL-ENCODER-DECODER"
title: "Encoder y decoder: quién consulta a quién en cross-attention"
published: "2026-10-26T02:06:00Z"
locale: "es"
translationKey: "attention-transformer-dl-encoder-decoder"
slug: "transformer-encoder-decoder-cross-attention-contexto"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-TRANSFORMER-BLOCK"]
description: "Cómo se combinan contexto de origen y prefijo de destino sin filtrar el futuro. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Un decoder que consulta una entrada completa no está necesariamente viendo información prohibida. En una tarea condicionada, el origen puede estar disponible desde el principio; lo que debe ocultarse es el futuro de la secuencia que estamos generando.

Después de [reconstruir un bloque Transformer](/posts/transformer-block-residual-layernorm-ffn-pre-norm), separaremos los dos contextos. El criterio útil para distinguir self-attention y **cross-attention** es de dónde proceden Q, K y V.

## El encoder transforma el origen disponible

Nuestro encoder recibe cuatro posiciones de source, con dos muestras en el batch. La primera tiene cuatro posiciones válidas; la segunda, dos y dos PAD.

Su self-attention permite a cada query consultar todas las keys válidas de su muestra. No impone un prefijo causal porque el origen completo forma parte de la entrada disponible en este ejemplo.

Después de atención, residual y FFN, una normalización final produce la **memory** que consumirá el decoder. Este nombre no implica un estado recurrente que se actualice entre tokens: aquí es el conjunto de representaciones del origen.

<img src="/assets/visuals/attention-transformer/DL-ENCODER-DECODER.svg" alt="Cómo se combinan contexto de origen y prefijo de destino sin filtrar el futuro. El diagrama muestra las dependencias de las operaciones del laboratorio." width="446" height="686" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El laboratorio usa una tabla de embeddings compartida para source y target dentro de un vocabulario sintético común. No deducimos de eso que dos idiomas o dos modalidades deban compartir siempre vocabulario y representación.

## El decoder consulta primero su prefijo

La self-attention del decoder recibe representaciones de target. Usa causalidad y padding de keys: cada posición puede consultar su propio input desplazado y los anteriores que existan.

En una tarea entrenada, esos inputs deberían estar alineados con los targets, como explicamos en [teacher forcing](/posts/teacher-forcing-generacion-autoregresiva-evaluacion). Una máscara correcta no repara que alguien haya introducido el target actual en la entrada destinada a predecirlo.

Aquí usamos cinco posiciones de target, con longitudes válidas cinco y tres. No entrenamos un traductor ni un modelo de lenguaje. Estamos comprobando el recorrido de información con pesos inicializados.

## Cross-attention toma las queries del decoder y las keys/values del encoder

Después de su primera suma residual, el decoder normaliza su representación para formar queries. Las keys y values se proyectan desde memory:

```python
        cross_result,cross_trace=self.cross_attention(self.norm2(after_self),memory,cross_allowed)
        after_cross=after_self+cross_result
```

Una query de destino pregunta cómo combinar las representaciones del origen. Por eso el número de filas de atención corresponde al target y las columnas al source.

Con batch dos, dos heads, cinco queries y cuatro keys, los pesos tienen shape **2 × 2 × 5 × 4**. El resultado sigue teniendo cinco posiciones de target; no cambia a cuatro por consultar cuatro posiciones de source.

Si tomásemos K y V del mismo prefijo de destino, estaríamos calculando otra self-attention. Las shapes podrían coincidir en alguna tarea, pero el origen del contexto sería distinto.

## La máscara de cross-attention elimina padding del origen

La segunda muestra tiene dos keys reales de source. Sus columnas de padding se excluyen para todas las queries de target. No se aplica una triangular que relacione arbitrariamente el índice de source con el de target.

Los índices 0, 1 y 2 de ambas secuencias no tienen por qué representar el mismo tiempo o la misma unidad. Imponer `source_index <= target_index` sin una justificación de la tarea restringiría otro acceso diferente.

Tampoco esperamos que las queries de target PAD produzcan cero solo por excluir keys inválidas. Las salidas válidas se identifican mediante sus longitudes; una futura loss debería respetarlas.

## Cambiar source válido y cambiar target futuro deben comportarse de forma distinta

El laboratorio conserva tres controles del modelo completo:

<div role="region" aria-label="Cálculo 1: Encoder y decoder: quién consulta a quién en cross-attention" tabindex="0" style="overflow-x:auto;max-width:100%">

| Cambio de entrada | Qué se comprueba |
| --- | --- |
| Tokens futuros de target | El prefijo de logits permanece idéntico |
| IDs de padding del source | Las salidas válidas de esa muestra permanecen idénticas |
| Un token válido del source | Puede cambiar el primer logit de destino |

</div>

En seed 7, el máximo cambio del primer vector de logits al modificar una posición válida de source es aproximadamente **0,095145**. Los dos primeros controles dan error cero en las tres seeds.

No interpretamos ese valor como influencia semántica aprendida ni como una medida de calidad. Comprueba que existe un camino desde origen válido y que las restricciones elegidas bloquean los otros cambios considerados.

## El decoder añade una tercera subcapa respecto al encoder

La secuencia del bloque decoder es self-attention causal, cross-attention y FFN, con normalización previa y residual en cada caso. La FFN sigue transformando cada posición, sin mezclar por sí sola filas del target.

Nuestro encoder-decoder completo registra **1 740 parámetros**. Incluye el encoder, el decoder, normalizaciones finales, embedding compartido y head de doce logits. No es comparable directamente con el decoder-only de 820 como si ambos resolvieran exactamente la misma tarea con el mismo contexto.

La arquitectura original de Transformer usa un stack de capas y otros detalles del entrenamiento. Este ejemplo tiene una capa por bloque, pre-norm y dropout cero para que el contraste resulte pequeño y reproducible.

## Garantías y límites

Los tests contrastan shapes de cross-attention, aislamiento de padding, acceso a source y causalidad del target. Las operaciones de atención y el bloque pre-norm se verifican además frente a PyTorch con pesos copiados.

No se ha entrenado una correspondencia entre secuencias ni evaluado una traducción. Los números y mapas describen un cálculo inicializado. La ausencia de fuga en los controles no demuestra que un dataset real, su tokenización o su preparación eviten otras formas de filtrar la respuesta.

## Ejercicio: identifica el contexto antes de dibujar una máscara

Imagina una entrada de seis posiciones y una salida de cuatro. Indica las shapes de Q, K, V y pesos en self-attention del encoder, self-attention del decoder y cross-attention. Después decide qué información está disponible al generar el segundo símbolo y qué restricciones corresponden a cada matriz.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/transformer.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/tests/test_attention.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/attention-transformer test:container
pnpm --dir packages/attention-transformer verify
pnpm --dir packages/attention-transformer test
```

`verify` recalcula los nueve casos de atención y tres inicializaciones de cada arquitectura, incluidos controles y gradientes. No entrena modelos ni compara solo hashes. `exercise` regenera observaciones y `render` las figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. El README concreta versiones y tolerancias.

## Referencias

- [Arquitectura encoder-decoder original](https://arxiv.org/html/1706.03762v7).

## Continuar la serie

Anterior: [Un bloque Transformer: atención, residual, LayerNorm y FFN resuelven tareas distintas](/posts/transformer-block-residual-layernorm-ffn-pre-norm). Siguiente: [Atención causal: demostrar que el futuro no cambia el prefijo](/posts/causal-attention-transformer-futuro-paralelismo).
