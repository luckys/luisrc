---
id: "DL-POSITIONAL"
title: "Positional encodings: dar coordenadas a una atención que respeta las permutaciones"
published: "2026-10-26T02:04:00Z"
locale: "es"
translationKey: "attention-transformer-dl-positional"
slug: "positional-encodings-sinusoidales-orden-permutaciones"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-MULTIHEAD"]
description: "Qué aporta la posición y qué cambia cuando se reordenan tokens o pares token-posición. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Si reordenamos los vectores de una self-attention sin posiciones y reordenamos sus salidas del mismo modo, el cálculo sigue siendo consistente. La operación no sabe por sí sola cuál de esos vectores era «el primero».

Después de [separar heads y reunir sus respuestas](/posts/multi-head-attention-split-concat-proyeccion), necesitamos aportar coordenadas si el orden forma parte del problema. Los **positional encodings** añaden esa información, pero no garantizan entender cualquier longitud nueva.

## Equivarianza no significa que todas las salidas sean iguales

Sin posición ni máscara causal, permutar las filas de X permuta también las queries, las keys y los values. Las compatibilidades se reorganizan y cada salida acompaña a su nueva posición.

Eso es **equivarianza a permutaciones**. No significa que cualquier token obtenga la misma respuesta ni que la salida sea constante. Significa que el cálculo respeta el reordenamiento de ese conjunto de vectores.

El probe toma cuatro posiciones y la permutación `[2, 0, 3, 1]`. Compara atender a los vectores permutados con permutar la salida original. El error máximo observado es aproximadamente 2,22 × 10⁻¹⁶ en float64.

La prueba no incluye una máscara causal: esa restricción ya distingue posiciones por su acceso al prefijo. Debemos conservar las condiciones bajo las que afirmamos la propiedad.

<img src="/assets/visuals/attention-transformer/DL-POSITIONAL.svg" alt="Qué aporta la posición y qué cambia cuando se reordenan tokens o pares token-posición. El diagrama muestra las dependencias de las operaciones del laboratorio." width="451" height="550" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Una señal sinusoidal asigna un vector a cada posición

Usamos una tabla de ocho componentes con parejas seno/coseno. Para posición p y pareja i:

<div role="region" aria-label="Cálculo 2: Positional encodings: dar coordenadas a una atención que respeta las permutaciones" tabindex="0" style="overflow-x:auto;max-width:100%">

$$
\begin{aligned}
PE(p,2i)&=\sin\left(p/10000^{2i/d}\right),\\
PE(p,2i+1)&=\cos\left(p/10000^{2i/d}\right).
\end{aligned}
$$
</div>


Cada pareja cambia a una frecuencia diferente. No hay una frecuencia nueva aprendida a partir de nuestros datos: la base 10 000 y la fórmula están fijadas en el protocolo.

En la posición cero, las componentes pares valen cero y las impares uno. Es un caso que podemos verificar sin aproximaciones trigonométricas complicadas. El test también comprueba la shape de la tabla.

En `positional_encoding`, después de calcular ángulos por posición y frecuencia:

```python
    result[:,0::2]=angles.sin();result[:,1::2]=angles.cos()
```

Este helper requiere un ancho par para mantener parejas completas. Otras implementaciones pueden tratar anchos impares de otro modo; aquí se rechazan explícitamente.

<img src="/assets/interactive/attention-transformer/position-signals.svg" alt="Cuatro componentes de la tabla sinusoidal en posiciones cero a quince, con dos parejas de frecuencias distintas y valores entre menos uno y uno." width="380" height="336" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Sumamos contenido y posición antes del bloque

El modelo sobre IDs multiplica su embedding por raíz de ocho y añade la señal de posición. Conserva el ancho ocho, así que las proyecciones posteriores reciben el mismo tipo de tensor que antes, ahora con ambas contribuciones.

Sumar es una decisión de arquitectura. No reservamos por obligación cuatro componentes al contenido y cuatro a la coordenada. Las proyecciones pueden combinar ambas partes.

Los tokens PAD también tienen una posición dentro del tensor. Aunque su embedding sea cero, sumar PE produce un vector no nulo. Seguimos necesitando una máscara que impida usarlos como keys reales; la señal de posición no reemplaza el contrato de longitudes.

## Mover tokens y mover pares completos son experimentos diferentes

El laboratorio realiza tres controles:

<div role="region" aria-label="Cálculo 1: Positional encodings: dar coordenadas a una atención que respeta las permutaciones" tabindex="0" style="overflow-x:auto;max-width:100%">

| Reordenamiento | Resultado observado |
| --- | --- |
| Tokens sin posiciones | Equivarianza, error ≈ 2,22 × 10⁻¹⁶ |
| Tokens movidos, posiciones fijas | Cambio máximo ≈ 0,432636 |
| Pares token+posición movidos juntos | Equivarianza, error ≈ 3,33 × 10⁻¹⁶ |

</div>

En el segundo caso cambiamos qué contenido se asocia a cada coordenada. En el tercero tratamos cada suma como un vector completo y permutamos el conjunto; eso no demuestra que el modelo ignore el orden.

Esta distinción ayuda a diseñar una prueba útil. Si movemos también la etiqueta de posición junto con el token, no estamos preguntando qué ocurre al ponerlo en otra coordenada absoluta.

## Poder calcular posiciones nuevas no demuestra extrapolación

La fórmula sinusoidal permite obtener una fila para posiciones que no estaban en una tabla precomputada. Esa propiedad práctica no demuestra que un modelo entrenado se comporte bien con secuencias mucho más largas.

Pueden cambiar las relaciones entre señales, las distribuciones de atención y las exigencias de la tarea. En este laboratorio no entrenamos ni evaluamos calidad a nuevas longitudes.

También existen posiciones aprendidas y mecanismos relativos. Una tabla aprendida tiene un rango y parámetros que deben gestionarse. Los mecanismos relativos modifican cómo se representa la relación entre posiciones. No se reproducen aquí ni se mezclan sus garantías con las de nuestra suma sinusoidal.

## Garantías y límites

Los tests contrastan las tres permutaciones y los valores conocidos de PE en cero. El visor muestra cada posición y sus ocho componentes, además de curvas con escala fija de −1 a 1.

Los vectores de contenido y las proyecciones están inicializados. El cambio observado prueba que la asociación con posiciones afecta al cálculo; no prueba comprensión lingüística ni una noción de distancia aprendida.

## Ejercicio: define qué estás permutando

Escribe una secuencia de tres símbolos con posiciones 0, 1 y 2. Intercambia dos símbolos conservando las coordenadas. Después intercambia los pares completos. Explica qué información recibe la atención en cada experimento y cuál sirve para estudiar el efecto de cambiar el orden del contenido.

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

- [Attention Is All You Need: positional encoding](https://arxiv.org/html/1706.03762v7).

## Continuar la serie

Anterior: [Multi-head attention: separar perspectivas y volver a reunir sus resultados](/posts/multi-head-attention-split-concat-proyeccion). Siguiente: [Un bloque Transformer: atención, residual, LayerNorm y FFN resuelven tareas distintas](/posts/transformer-block-residual-layernorm-ffn-pre-norm).
