---
id: "DL-ATTENTION-SCALE"
title: "Scaled dot-product: por qué dividir antes de softmax y cómo evitar overflow"
published: "2026-10-26T02:01:00Z"
locale: "es"
translationKey: "attention-transformer-dl-attention-scale"
slug: "scaled-dot-product-attention-softmax-estable"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P103"]
description: "Qué controla la escala del producto escalar y qué no garantiza. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Un softmax puede concentrar casi todo su peso en una key porque los scores tienen una escala grande, aunque todavía no haya aprendido una relación útil. Además, calcular exponenciales directamente puede producir infinito antes de normalizar.

Tras [construir la atención con Q/K/V](/posts/attention-qkv-consultas-claves-valores), conviene separar dos decisiones: la escala del producto escalar y la estabilidad numérica de softmax. Resuelven problemas distintos.

## La dimensión puede aumentar la dispersión del producto escalar

El score sin escalar suma productos de componentes. Si query y key tienen componentes independientes, de media cero y varianza uno, la varianza de esa suma es $d_k$. Su desviación típica crece como la raíz cuadrada de $d_k$.

Dividir por la raíz cuadrada de $d_k$ compensa ese crecimiento bajo esos supuestos. No es una identidad aplicable sin más a cualquier representación entrenada: correlaciones, medias y normas pueden cambiar.

La escala predeterminada de **scaled dot-product attention** usa ese factor. El laboratorio no lo presenta como calibración de probabilidades ni como una garantía de que todas las heads tendrán la misma distribución.

<img src="/assets/visuals/attention-transformer/DL-ATTENTION-SCALE.svg" alt="Qué controla la escala del producto escalar y qué no garantiza. El diagrama muestra las dependencias de las operaciones del laboratorio." width="373" height="676" loading="lazy" style="width:100%;max-width:373px;height:auto" />

En `scaled_attention`, el tamaño se obtiene del eje de componentes de Q:

```python
    raw=query@key.transpose(-2,-1)
    scores=raw/math.sqrt(query.shape[-1])
```

Usar la longitud de la secuencia o el ancho completo del modelo cuando estamos dentro de una head daría un factor distinto. Tener los ejes nombrados permite detectar ese error antes de comparar curvas.

## Un probe aleatorio permite observar la escala sin entrenar

Por cada dimensión 1, 4, 16 y 64 generamos 512 queries y ocho keys por query, con componentes normales independientes. Usamos float64 y una seed declarada por dimensión.

<div role="region" aria-label="Cálculo 1: Scaled dot-product: por qué dividir antes de softmax y cómo evitar overflow" tabindex="0" style="overflow-x:auto;max-width:100%">

| Dimensión | Std. sin escala | Std. con escala | Entropía sin escala | Con escala |
| --- | --- | --- | --- | --- |
| 1 | 1,049231 | 1,049231 | 1,784940 | 1,784940 |
| 4 | 1,950130 | 0,975065 | 1,291801 | 1,761721 |
| 16 | 3,942757 | 0,985689 | 0,667016 | 1,735756 |
| 64 | 8,043139 | 1,005392 | 0,343398 | 1,716624 |

</div>

La desviación escalada queda cerca de uno en estas muestras. La entropía, medida en nats, describe cuánto se reparte el peso entre ocho keys. Una distribución uniforme tendría entropía $\ln 8$.

<img src="/assets/interactive/attention-transformer/scale-entropy.svg" alt="Entropía media de softmax sobre ocho keys con y sin escala, medida en cuatro dimensiones discretas sobre queries y keys normales independientes." width="380" height="336" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Las dimensiones se muestran como categorías igualmente separadas. No hemos medido todos los anchos intermedios. Cada dimensión usa sus muestras; no presentamos una demostración de que la entropía de cualquier red deba seguir esa curva.

Mayor entropía tampoco significa mejor respuesta. Una tarea podría necesitar concentrarse en una key. Este control solo muestra cómo cambia la concentración por escala antes de aprender.

## Softmax estable conserva la distribución al desplazar los logits

Para una fila de scores $s_j$, podemos restar el mismo número $m$ a todos sus elementos:

<div role="region" aria-label="Cálculo 2: Scaled dot-product: por qué dividir antes de softmax y cómo evitar overflow" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
\frac{e^{s_j-m}}{\sum_k e^{s_k-m}}
=\frac{e^{s_j}}{\sum_k e^{s_k}}.
$$
</div>


Elegimos el máximo de esa fila. El exponente mayor pasa a ser cero, de modo que no necesitamos calcular la exponencial de un número positivo enorme.

Para logits `[1000, 1001, 999]`, la forma ingenua desborda en el runtime observado. La forma desplazada produce aproximadamente `[0,244728, 0,665241, 0,090031]`.

Esos valores no indican que el modelo tenga confianza justificada. Hemos conservado una operación matemática sin el overflow de la implementación ingenua.

## La normalización debe conservar independientes batch, heads y queries

El máximo y la suma se calculan sobre el último eje, el de keys. Cada query de cada head y muestra tiene su propia normalización. `keepdim=True` conserva ese eje para restar y dividir mediante broadcasting sin mezclar filas.

Un máximo global también es un desplazamiento común que conserva idealmente las proporciones, pero puede volver innecesariamente pequeñas las exponenciales de otras filas. Usar el máximo de cada fila evita ese problema y deja explícito el contrato de normalización.

No hay ninguna key permitida si toda la fila está enmascarada. Restar máximo no resuelve entonces la distribución: aparecería una operación entre infinitos. Nuestro helper de atención rechaza ese caso antes de llamar a softmax.

## Escalar scores y controlar overflow no sustituye otras decisiones

El factor $d_k^{-1/2}$ cambia los pesos respecto a usar scores sin escalar. Restar el máximo de una fila conserva la distribución que ya habíamos decidido calcular. Confundir ambas operaciones lleva a tratar una decisión del modelo como si fuera solo una mejora de implementación.

Tampoco hemos ajustado una temperatura para calibración ni medido la calidad de una head. Los resultados pertenecen a vectores generados y no entrenados.

## Garantías y límites

Los tests comparan softmax estable con PyTorch sobre valores grandes y filas independientes. Los cálculos de atención y sus gradientes se contrastan además con SDPA. Se archivan las estadísticas del probe, no una curva dibujada para parecer convincente.

En una implementación real con precisión reducida, kernels fusionados o otras distribuciones de entrada habría que revisar tolerancias y estabilidad. Este laboratorio se limita al runtime CPU float64 declarado.

## Ejercicio: distingue cambiar la operación de calcularla mejor

Calcula softmax para una fila pequeña, después resta una constante a todos sus elementos y vuelve a calcularlo. Por último divide los scores por dos. Explica cuál de las dos transformaciones conserva la distribución y cuál la modifica.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/attention.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/tests/test_attention.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/attention-transformer test:container
pnpm --dir packages/attention-transformer verify
pnpm --dir packages/attention-transformer test
```

`verify` recalcula los nueve casos de atención y tres inicializaciones de cada arquitectura, incluidos controles y gradientes. No entrena modelos ni compara solo hashes. `exercise` regenera observaciones y `render` las figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. El README concreta versiones y tolerancias.

## Referencias

- [Attention Is All You Need, apartado de escala](https://arxiv.org/html/1706.03762v7).
- [SDPA, PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html).

## Continuar la serie

Anterior: [Atención con Q/K/V: consultar y combinar una secuencia sin reducirla a un solo estado](/posts/attention-qkv-consultas-claves-valores). Siguiente: [Máscaras de atención: no confundir permitido, padding y posición futura](/posts/attention-masks-padding-bool-permitido-excluido).
