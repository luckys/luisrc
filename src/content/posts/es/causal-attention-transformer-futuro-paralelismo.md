---
id: "DL-CAUSAL-ATTENTION"
title: "Atención causal: demostrar que el futuro no cambia el prefijo"
published: "2026-10-26T02:07:00Z"
locale: "es"
translationKey: "attention-transformer-dl-causal-attention"
slug: "causal-attention-transformer-futuro-paralelismo"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ENCODER-DECODER", "DL-TEACHER-FORCING"]
description: "Qué permite calcular en paralelo una máscara causal y qué sigue siendo secuencial al generar. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Dibujar una matriz triangular no basta para demostrar que un modelo evita el futuro. Otra operación podría mezclar posiciones o recibir inputs mal alineados. La prueba debe llegar hasta los logits del prefijo que pretendemos proteger.

Después de [separar origen y destino en encoder/decoder](/posts/transformer-encoder-decoder-cross-attention-contexto), comprobaremos causalidad en modelos completos. También veremos qué permite calcular en paralelo y qué coste conserva una implementación de atención densa.

## Una posición solo consulta el contexto permitido

En self-attention causal, la query i puede atender a keys con índice j menor o igual a i. La diagonal se incluye porque el input de esa posición puede ser el símbolo previo al target que queremos predecir.

El contrato depende de la preparación de datos. Durante teacher forcing podemos entregar toda la secuencia desplazada y aplicar la máscara. Cada fila obtiene su contexto permitido aunque las matrices se calculen juntas.

En generación, el siguiente símbolo todavía no existe. Debemos obtenerlo antes de usarlo como input de otro paso. La máscara no hace que podamos conocer todos esos futuros símbolos a la vez.

<img src="/assets/visuals/attention-transformer/DL-CAUSAL-ATTENTION.svg" alt="Qué permite calcular en paralelo una máscara causal y qué sigue siendo secuencial al generar. El diagrama muestra las dependencias de las operaciones del laboratorio." width="387" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Cambiar el futuro no debe cambiar los logits anteriores

El control utiliza el mismo modelo y modifica solo las posiciones 3 y 4 de la primera muestra. Compara después sus logits de posiciones 0, 1 y 2, que no deberían depender de esos inputs.

En `causal_observation` mantenemos una ejecución con máscara y otra sin ella:

```python
    logits,trace=model(target,target_lengths,True);other,_=model(changed,target_lengths,True)
    plain,_=model(target,target_lengths,False);leak,_=model(changed,target_lengths,False)
```

La comparación abarca embedding, posición, bloque, normalización final y head. No se limita a observar ceros en una matriz intermedia.

<div role="region" aria-label="Cálculo 1: Atención causal: demostrar que el futuro no cambia el prefijo" tabindex="0" style="overflow-x:auto;max-width:100%">

| Seed | Cambio del prefijo con máscara | Sin máscara |
| --- | --- | --- |
| 7 | 0 | 0,650188 |
| 19 | 0 | 0,392394 |
| 31 | 0 | 0,527208 |

</div>

La ejecución sin máscara es un **control negativo**: demuestra que la perturbación puede recorrer un camino que la máscara causal elimina. Sin él, dos salidas iguales podrían deberse a una perturbación ineficaz o un modelo que ignorase toda la entrada.

Los valores pertenecen a parámetros inicializados, no a un modelo entrenado. Cero fuga estructural no significa buena predicción.

## El gradiente permite comprobar otro aspecto del mismo contrato

Derivamos el logit de muestra 0, posición 1 y clase 1 respecto a los embeddings de entrada. Las posiciones 2, 3 y 4 son futuras para ese logit y sus derivadas deben ser cero.

<img src="/assets/interactive/attention-transformer/causal-gradient.svg" alt="Gradiente de un logit de posición uno respecto a cinco embeddings de entrada. Las filas de posiciones futuras dos a cuatro son cero; los colores representan signo y escala local simétrica." width="380" height="287" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El test exige también gradiente cero hacia la otra muestra del batch. La atención no debe mezclar ejemplos diferentes.

Este gradiente es una sensibilidad local, no una explicación causal de una clase aprendida. Se usa para contrastar un bloqueo estructural cuya consecuencia también comprobamos con una perturbación finita de tokens.

## Las otras subcapas deben respetar la separación temporal

La FFN del bloque actúa por posición. LayerNorm normaliza los componentes de cada vector, sin calcular estadísticas a través de todo el tiempo. Ambas decisiones conservan la restricción de acceso establecida por la atención.

Una normalización que mezclase posiciones podría introducir otro camino al futuro. Por eso probar solo `weights[i, j] == 0` en posiciones prohibidas sería insuficiente para certificar toda una arquitectura modificada.

En encoder-decoder, la causalidad protege el futuro del target, mientras cross-attention puede consultar el source completo que se proporciona como contexto. El test distingue cambiar source válido de cambiar un target futuro.

## Paralelizar posiciones conocidas no equivale a generar sin dependencia

Dentro de una capa de atención, las queries de una secuencia conocida se calculan a partir de sus representaciones de la capa anterior. No hay una recurrencia que obligue a terminar el hidden state de la posición i para empezar el de i+1 dentro de esa misma capa.

Eso permite organizar operaciones matriciales sobre posiciones durante entrenamiento con inputs conocidos. No demuestra un tiempo mejor en cualquier tamaño, hardware o implementación.

Al generar autoregresivamente, cada token nuevo depende del ya elegido. Las caches de K/V pueden evitar repetir parte del cálculo anterior, pero no implementamos una cache aquí ni atribuimos sus costes a este laboratorio.

## La máscara triangular no reduce automáticamente el tensor denso

Nuestra implementación construye scores con shape batch × heads × longitud × longitud antes de enmascarar. Para batch dos, dos heads y float64:

<div role="region" aria-label="Cálculo 2: Atención causal: demostrar que el futuro no cambia el prefijo" tabindex="0" style="overflow-x:auto;max-width:100%">

| Longitud | Elementos de scores | Bytes de ese tensor |
| --- | --- | --- |
| 4 | 64 | 512 |
| 8 | 256 | 2 048 |
| 16 | 1 024 | 8 192 |
| 32 | 4 096 | 32 768 |

</div>

Duplicar longitud cuadruplica este almacenamiento. Excluir la mitad de relaciones no elimina por sí solo la matriz que acabamos de reservar.

Es la cuenta observada de un tensor concreto. No incluye todo el modelo, gradientes, activaciones, memoria del sistema o VRAM. Kernels fusionados pueden evitar materializar algunas matrices; no hemos ejecutado un benchmark que permita comparar esas estrategias.

## Garantías y límites

Los controles se recalculan con tres seeds en float64 CPU, dropout cero y un bloque pequeño. Se comprueban prefijos idénticos con máscara, cambios sin ella, derivadas al futuro, padding y acceso al origen.

No se evalúan calidad lingüística, fine-tuning o eficiencia de GPU. El siguiente bloque del roadmap aborda pretraining y adaptación; sus requisitos de aprendizaje y evaluación no se dan por satisfechos por estas pruebas estructurales.

## Ejercicio: diseña una prueba que pudiera fallar

Propón una operación que mezcle todas las posiciones después de una atención correctamente enmascarada. Explica qué prueba de este artículo detectaría la fuga y cuál, limitada al mapa de atención, podría seguir pasando. Después define qué entradas cambiarías para hacer efectivo el control negativo.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/probes.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/tests/test_attention.py), protocolo y observaciones. Desde la raíz del monorepo:

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

- [SDPA y acceso causal](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html).

## Continuar la serie

Anterior: [Encoder y decoder: quién consulta a quién en cross-attention](/posts/transformer-encoder-decoder-cross-attention-contexto). Continúa con [Self-supervision: aprender a reconstruir antes de pedir etiquetas](/posts/self-supervision-denoising-aprender-sin-etiquetas), primera entrega del bloque de pretraining y adaptación.
