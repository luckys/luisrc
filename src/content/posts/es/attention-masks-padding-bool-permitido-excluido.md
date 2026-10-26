---
id: "DL-ATTENTION-MASKS"
title: "Máscaras de atención: no confundir permitido, padding y posición futura"
published: "2026-10-26T02:02:00Z"
locale: "es"
translationKey: "attention-transformer-dl-attention-masks"
slug: "attention-masks-padding-bool-permitido-excluido"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ATTENTION-SCALE"]
description: "Cómo traducir una política de acceso a claves sin invertir su significado entre APIs. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Una máscara booleana correcta en una API puede significar justo lo contrario en otra. El cálculo sigue devolviendo tensores con la shape esperada, pero ahora consulta posiciones que debían estar excluidas.

Tras [escalar scores y estabilizar softmax](/posts/scaled-dot-product-attention-softmax-estable), necesitamos definir quién puede consultar a quién. La política pertenece al problema; su representación depende de la API.

## Una máscara limita relaciones entre queries y keys

Una matriz de atención tiene filas de queries y columnas de keys. Excluir la celda `(i, j)` impide que la query i incorpore el value asociado a la key j por ese camino.

En nuestro código, **True significa permitido**. Antes de softmax sustituimos los scores excluidos por infinito negativo. Sus exponenciales aportan cero y la normalización se reparte entre las keys restantes.

```python
    weights=stable_softmax(scores.masked_fill(~allowed,float('-inf')))
```

Multiplicar el score por cero no expresa lo mismo. Un score cero produce una exponencial igual a uno y puede recibir peso. Lo que queremos anular es la contribución a la distribución, no simplemente cambiar su score a un valor moderado.

<img src="/assets/visuals/attention-transformer/DL-ATTENTION-MASKS.svg" alt="Cómo traducir una política de acceso a claves sin invertir su significado entre APIs. El diagrama muestra las dependencias de las operaciones del laboratorio." width="477" height="550" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La máscara del laboratorio tiene ejes batch, head, query y key. Algunas dimensiones de tamaño uno se expanden por broadcasting, pero el contrato final se comprueba contra la matriz completa. No elegimos ejes solo porque la suma acepte sus tamaños.

## Padding de keys y causalidad expresan restricciones distintas

La máscara de **padding de keys** elimina columnas que no corresponden a datos reales. Si una muestra tiene longitud 3 dentro de un tensor de longitud 5, sus keys 3 y 4 quedan excluidas.

La máscara **causal** de self-attention permite las keys de posición $j\leq i$ para la query i. Es triangular inferior, incluida la diagonal. Su significado depende de qué hay en cada posición: en un decoder con targets desplazados, el input de la propia posición ya es contexto anterior al target que se predice.

Podemos combinar ambas restricciones mediante una intersección lógica. Una key debe existir y estar dentro del prefijo permitido. El ejemplo conserva siempre al menos una key válida por fila.

Nuestro helper causal exige una matriz cuadrada. SDPA también define comportamientos para matrices no cuadradas, pero no los deducimos de este dibujo: requieren acordar cómo se alinean queries y keys.

## Excluir keys no convierte las queries de padding en ceros

Una query situada en una fila de padding todavía puede consultar keys válidas y devolver un vector no nulo. La máscara de keys no elimina automáticamente esa fila de salida.

El test comprueba esa situación y, por separado, que cambiar los embeddings de padding no altera las salidas válidas. En el visor se marca cuándo la query seleccionada no corresponde a un paso real, aunque sus coeficientes sumen uno.

Para una loss por token habría que excluir los targets PAD. Para una reducción global de salidas también habría que respetar qué filas representan datos. Una sola máscara no sustituye todos esos contratos.

## SDPA y MultiheadAttention invierten el significado booleano

La [documentación de SDPA](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html) usa True para participar en atención. En [MultiheadAttention](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MultiheadAttention.html), True en sus máscaras booleanas significa excluir.

<div role="region" aria-label="Cálculo 1: Máscaras de atención: no confundir permitido, padding y posición futura" tabindex="0" style="overflow-x:auto;max-width:100%">

| API o helper | True significa |
| --- | --- |
| Nuestro `scaled_attention` | Permitido |
| SDPA `attn_mask` | Permitido |
| MHA `attn_mask` | Excluido |
| MHA `key_padding_mask` | Padding que se ignora |

</div>

El adaptador que contrasta con MHA invierte nuestra máscara y organiza sus ejes como batch×heads, queries, keys. Con los mismos pesos, las salidas y los mapas coinciden dentro de tolerancias.

El control que pasa la máscara invertida a SDPA produce un cambio máximo aproximado de **8,018569** en el ejemplo pequeño. Acertar la shape no habría detectado esa inversión semántica.

## Una máscara aditiva también necesita un convenio

Podemos representar el acceso con cero en posiciones permitidas e infinito negativo en posiciones excluidas, y sumar esa matriz a los scores. El probe contrasta esa forma con la booleana correcta en SDPA.

No sirve convertir una máscara booleana a números 0 y 1 y asumir que ahora excluye posiciones. Eso añadiría offsets finitos a los scores y calcularía otra distribución.

Usar un valor negativo finito como sustituto de infinito también requiere revisar dtype y escala. En este laboratorio se usa infinito negativo y se detecta antes el caso sin ninguna key disponible.

## Una fila totalmente excluida debe tener una política explícita

Si no hay ninguna key permitida, no podemos repartir entre ellas una masa total de uno. Nuestro helper rechaza esa fila antes de normalizar.

El runtime observado de SDPA devuelve salida finita cero para el control totalmente excluido. Ese resultado se registra, pero no se presenta como un comportamiento universal de cualquier función, versión o ruta de ejecución.

También fijamos `dropout_p=0` en las llamadas funcionales. La función SDPA usa ese argumento para aplicar dropout; poner un módulo contenedor en eval no cambia por sí solo un argumento distinto de cero que alguien le haya pasado.

## Garantías y límites

Los tests comprueban pesos excluidos exactamente cero, equivalencia entre representaciones correctas, rechazo de filas vacías y contraste con APIs nativas. La causalidad del modelo completo se comprobará después: una máscara aislada no demuestra que otra operación no filtre el futuro.

No se prueban aquí cache de generación, máscaras rectangulares causales o todas las combinaciones de kernels y precisión. La implementación es deliberadamente pequeña y declara sus límites.

## Ejercicio: escribe la política antes de elegir la API

Para una secuencia válida de tres posiciones dentro de un tensor de cinco, dibuja qué keys puede consultar la query 1 bajo causalidad. Después escribe la máscara booleana equivalente para nuestro helper y para MHA. Explica por qué ambas representan la misma política con valores opuestos.

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

- [SDPA: máscaras y dropout](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html).
- [MultiheadAttention: convenciones de máscaras](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MultiheadAttention.html).

## Continuar la serie

Anterior: [Scaled dot-product: por qué dividir antes de softmax y cómo evitar overflow](/posts/scaled-dot-product-attention-softmax-estable). Siguiente: [Multi-head attention: separar perspectivas y volver a reunir sus resultados](/posts/multi-head-attention-split-concat-proyeccion).
