---
id: "DL-MULTIHEAD"
title: "Multi-head attention: separar perspectivas y volver a reunir sus resultados"
published: "2026-10-26T02:03:00Z"
locale: "es"
translationKey: "attention-transformer-dl-multihead"
slug: "multi-head-attention-split-concat-proyeccion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ATTENTION-MASKS"]
description: "Qué se divide entre heads y cómo vuelve a producirse un vector por query. Matrices, código ejecutado y controles numéricos reproducibles."
author: "Luis Ramírez Calle"
series: "Reconstruir un Transformer: matrices, máscaras y posiciones"
tags: ["deep-learning", "attention", "transformer", "pytorch"]
---

Añadir heads no significa crear varias copias completas del modelo. Con un ancho total fijo, multi-head divide las representaciones proyectadas, calcula varias atenciones y vuelve a reunir sus resultados.

Después de [acordar las máscaras](/posts/attention-masks-padding-bool-permitido-excluido), vamos a seguir ese recorrido sin perder qué eje representa posiciones y cuál representa componentes.

## El ancho del modelo se reparte entre heads

Nuestro modelo usa $d_{model}=8$ y dos heads. Q, K y V se proyectan primero a ocho componentes por posición. Después cada uno se organiza como dos grupos de cuatro.

Para un batch de dos muestras y cinco queries:

<div role="region" aria-label="Cálculo 1: Multi-head attention: separar perspectivas y volver a reunir sus resultados" tabindex="0" style="overflow-x:auto;max-width:100%">

| Etapa | Shape de Q |
| --- | --- |
| Entrada proyectada | 2 × 5 × 8 |
| Separar grupos | 2 × 5 × 2 × 4 |
| Mover eje de heads | 2 × 2 × 5 × 4 |

</div>

La última forma representa batch, heads, queries y componentes. Para K y V, el eje de posiciones corresponde a las keys, que puede tener otra longitud.

No cortamos la secuencia en dos fragmentos. Las dos heads pueden consultar todas las keys que su máscara permita; lo que se divide es el eje de representación.

<img src="/assets/visuals/attention-transformer/DL-MULTIHEAD.svg" alt="Qué se divide entre heads y cómo vuelve a producirse un vector por query. El diagrama muestra las dependencias de las operaciones del laboratorio." width="390" height="676" loading="lazy" style="width:100%;max-width:380px;height:auto" />

En `MultiHead.split`:

```python
        return x.reshape(batch,length,self.heads,self.depth).transpose(1,2)
```

El orden importa. Un reshape que mezcle componentes de posiciones distintas puede conservar la cantidad de elementos y calcular una función equivocada. Los tests contrastan el recorrido completo con pesos copiados a MHA.

## Cada head calcula su distribución de atención

Para cada head se forman scores, se aplica su escala $d_k^{-1/2}$ y se normalizan las keys permitidas por query. Las proyecciones correspondientes a distintos grupos de componentes tienen parámetros distintos.

Con dos heads, cinco queries y cuatro keys, los pesos tienen shape 2 × 2 × 5 × 4, incluyendo el batch. Sus valores no tienen por qué coincidir entre heads.

Una head puede llegar a especializarse durante entrenamiento, pero aquí no hemos entrenado. No le asignamos a la head 0 la función de «buscar verbos» ni a la 1 la de «recordar posiciones». El número de heads no define por adelantado esos papeles.

## Concat reúne respuestas, no vuelve a sumar distribuciones

Cada head produce un vector de cuatro componentes por query. Movemos otra vez el eje de heads y concatenamos sus respuestas hasta recuperar ocho componentes.

La proyección final $W_O$ puede combinar esos componentes. Por eso observar un mapa de atención aislado no determina toda la contribución a la salida final: también importan los values, las otras heads y esa transformación.

La salida sigue teniendo una fila por query. En cross-attention no adopta la longitud de las keys ni devuelve una fila por cada combinación query-key.

El código usa `contiguous` antes del reshape final para hacer explícita la reorganización después de transpose. No se presupone que cualquier vista con los mismos tamaños recorra memoria en el orden que queremos.

## Con ancho fijo, más heads no añaden por sí solas matrices completas nuevas

En esta implementación tenemos cuatro proyecciones de 8→8: Q, K, V y salida. Con bias, cada una registra $8\cdot8+8=72$ parámetros. El total del módulo es **288**.

Los tests construyen una, dos y cuatro heads manteniendo ancho ocho. Los tres módulos registran 288 parámetros. Cambia cómo se separan los componentes y qué escala se aplica dentro de cada head.

Eso no garantiza el mismo tiempo o comportamiento. Las shapes intermedias, la implementación y la tarea importan. Con más heads a ancho fijo cada una recibe menos componentes; no se añade capacidad de representación sin otra contrapartida.

Si en otro diseño aumentamos también el ancho total, sí cambiará el presupuesto. La comparación debe indicar qué se ha mantenido constante.

## Comparar con MHA exige conservar pesos y convenciones

El adaptador reúne WQ, WK y WV en la matriz de proyección que espera PyTorch. Copia también biases y la proyección final. Usa `batch_first=True` y pide pesos por head, sin promediarlos.

La máscara se convierte al convenio de MHA y se organiza por batch×heads. Solo entonces comparamos salidas y pesos. Si dejásemos inicializaciones distintas, una diferencia no permitiría diagnosticar el reshape o la máscara.

El laboratorio tiene nueve casos: self-attention completa, causal y cross-attention para tres seeds. Además, el visor permite inspeccionar las atenciones de bloques completos. Sus mapas tienen la misma estructura de ejes, aunque sus entradas procedan de otras subcapas.

## Garantías y límites

Se comprueban las shapes y se rechaza que ocho componentes se repartan en tres heads con este diseño uniforme. Forward, mapas y gradientes de entrada se contrastan con las funciones nativas correspondientes.

No medimos si más heads mejoran accuracy, latencia o memoria. Los pesos son inicializados y no se han ajustado a una tarea. La garantía obtenida es que la composición implementa la operación explicada.

## Ejercicio: cambia heads manteniendo el presupuesto claro

Calcula las shapes para ancho 12 y tres heads, con cuatro queries y seis keys. Después cambia a seis heads manteniendo ancho 12. Indica qué ejes cambian, qué tamaño tiene la salida y por qué el número de parámetros de estas cuatro proyecciones permanece igual.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene las [fuentes de este artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/attention.py), [tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/attention-transformer/tests/test_attention.py), protocolo y observaciones. Desde la raíz del monorepo:

```bash
pnpm --dir packages/attention-transformer test:container
pnpm --dir packages/attention-transformer verify
pnpm --dir packages/attention-transformer test
```

`verify` recalcula los nueve casos de atención y tres inicializaciones de cada arquitectura, incluidos controles y gradientes. No entrena modelos ni compara solo hashes. `exercise` regenera observaciones y `render` las figuras. Si falta la image CPU fijada por digest, `runtime:fetch` la descarga. Docker ejecuta sin red, con dos CPUs, 2 GiB y un thread. El README concreta versiones y tolerancias.

## Referencias

- [MultiheadAttention](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MultiheadAttention.html).

## Continuar la serie

Anterior: [Máscaras de atención: no confundir permitido, padding y posición futura](/posts/attention-masks-padding-bool-permitido-excluido). Siguiente: [Positional encodings: dar coordenadas a una atención que respeta las permutaciones](/posts/positional-encodings-sinusoidales-orden-permutaciones).
