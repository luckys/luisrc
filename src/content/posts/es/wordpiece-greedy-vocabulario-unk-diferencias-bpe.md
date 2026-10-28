---
id: "NLP-WORDPIECE"
title: "WordPiece: elegir la subword más larga también puede acabar en UNK"
published: "2026-10-27T18:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-wordpiece"
slug: "wordpiece-greedy-vocabulario-unk-diferencias-bpe"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-BPE"]
description: "Cómo segmentar con vocabulario fijo y fallar sin inventar tokens. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Un tokenizer encuentra `bajo` al principio de `bajoz`, pero no puede representar la `z` restante con su vocabulario. ¿Debe conservar el prefijo y descartar lo demás? En la inferencia **WordPiece** que estudiamos, la palabra completa se convierte en `[UNK]`.

Ese comportamiento evita fabricar una segmentación parcial y muestra una diferencia importante con aplicar merges BPE. Para usar ambos términos con precisión, conviene separar cómo se aprende el vocabulario de cómo se segmenta una entrada.

Venimos de [BPE: cómo aprender subwords uniendo pares frecuentes](/posts/bpe-subwords-aprender-merges-tokenizacion).

## WordPiece busca la pieza más larga desde la posición actual

Partimos de un vocabulario fijo. En cada posición probamos primero la secuencia restante más larga; si no existe, acortamos el candidato hasta encontrar una pieza válida.

En nuestra convención, la primera pieza no lleva prefijo y las continuaciones utilizan `##`. `bajos` se representa como `bajo, ##s`. Esos caracteres `##` forman parte de la notación del vocabulario: no estaban escritos en la palabra original.

Cuando encontramos una pieza, avanzamos hasta el primer carácter aún no cubierto y repetimos la búsqueda. Esto es **greedy longest-match**. No explora todas las segmentaciones posibles para decidir después cuál parece más conveniente.

<img src="/assets/visuals/lexical-search/NLP-WORDPIECE.svg" alt="Cómo segmentar con vocabulario fijo y fallar sin inventar tokens. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="496" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## El código no conserva una palabra incompleta

Este fragmento de `subwords.mjs` trabaja sobre puntos de código y devuelve `[UNK]` si una posición no admite ninguna pieza:

```javascript
export function wordPiece(word, vocabulary) {
  const vocab = new Set(vocabulary), chars = [...word], result = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length, piece;
    for (; end > start; end--) {
      const candidate = (start ? '##' : '') + chars.slice(start,end).join('');
      if (vocab.has(candidate)) { piece = candidate; break; }
    }
    if (!piece) return ['[UNK]'];
    result.push(piece);
    start = end;
  }
  return result;
}
```

Usamos un vocabulario didáctico de nueve entradas, guardado en el protocolo: `[UNK]`, `bajo`, `baja`, `caja`, `##s`, `c`, `##a`, `##j` y `##o`. No es el vocabulario real de BERT ni un vocabulario entrenado con las veinte notas del buscador.

Con `bajos` obtenemos `bajo, ##s`. Con `cajo`, `c, ##a, ##j, ##o`. Con `bajoz` obtenemos únicamente `[UNK]`: el prefijo ya encontrado no se devuelve como si la palabra estuviera resuelta.

El uso de `[UNK]` aquí significa que no podemos representar la palabra bajo este contrato. No afirma que el contenido sea inválido ni que una persona no lo entienda.

## Greedy también puede fallar aunque exista otra segmentación

La prueba incluye la palabra `abc` y el vocabulario `ab`, `a`, `##bc`. La estrategia elige primero `ab`, porque es el prefijo válido más largo. Después no encuentra `##c` y devuelve `[UNK]`.

Existe una segmentación alternativa, `a, ##bc`, pero este algoritmo no retrocede para probarla. Es una diferencia entre «hay alguna solución» y «la estrategia greedy encuentra una solución».

Conocer esa propiedad ayuda al depurar unknown tokens. Añadir una pieza larga al vocabulario puede cambiar qué camino elige la inferencia; no basta con comprobar que todas las letras aparecen en alguna entrada de la tabla.

## La comparación con BPE necesita mantener claras las condiciones

En el artículo anterior BPE aprendió cinco merges. Aquí WordPiece utiliza un vocabulario fijo distinto. La comparación muestra mecanismos, no un experimento controlado sobre cuál produce mejor vocabulario.

Para `caja`, nuestro BPE devuelve `c, aja` y WordPiece devuelve `caja`, porque esta última está en su tabla. No podemos atribuir la secuencia más corta a una superioridad general del algoritmo: hemos decidido explícitamente que la palabra completa exista en ese vocabulario.

BPE aplica fusiones con un orden aprendido. La inferencia WordPiece consulta piezas y elige prefijos por longitud. Dos listas de piezas parecidas no implican el mismo procedimiento ni la misma salida ante una palabra nueva.

## Este laboratorio no implementa un trainer de WordPiece

La [guía de Hugging Face sobre WordPiece](https://huggingface.co/learn/llm-course/en/chapter6/6) explica una reconstrucción del aprendizaje y advierte que la implementación original del trainer de Google no se publicó. No tratamos esa reconstrucción como si fuera un contrato universal.

Una reconstrucción didáctica del aprendizaje puntúa cada par como su frecuencia dividida entre el producto de las frecuencias de sus piezas. A diferencia de elegir solo el par más frecuente, esa regla favorece ciertas asociaciones entre piezas que aparecen menos por separado.

Un ejemplo hipotético permite ver la diferencia: un par observado ocho veces cuyas piezas aparecen veinte y diez veces obtiene `8 / (20 × 10) = 0,04`. Otro observado cuatro veces, con ambas piezas presentes cuatro veces, obtiene `4 / (4 × 4) = 0,25`. El segundo gana bajo esa regla aunque tenga menos apariciones. Los números ilustran la fórmula; no pertenecen a nuestra captura ni a un entrenamiento ejecutado.

No debemos trasladar esa puntuación a la inferencia: el tokenizer con vocabulario ya fijado no vuelve a contar pares para cada entrada. Busca piezas válidas por longitud. Tampoco hemos usado esta reconstrucción para generar las nueve entradas del vocabulario del laboratorio.

El [código original de tokenización de BERT](https://github.com/google-research/bert/blob/master/tokenization.py) es una referencia para la inferencia longest-match y los unknown tokens. Nuestro ejemplo se limita a la segmentación de una palabra ya preparada, con un vocabulario pequeño y sin todo su pipeline de normalización o límites de longitud.

Esta separación permite aprender el mecanismo sin afirmar que hemos reproducido un tokenizer completo. Cuando usemos un modelo real, cargaremos su configuración y vocabulario compatibles.

## Garantías y límites

Probamos prefijos, continuaciones, fallo completo, palabra vacía y un caso sin backtracking. No entrenamos WordPiece ni medimos calidad de un modelo de lenguaje. BPE y WordPiece no reemplazan por sí solos la evaluación de relevancia del buscador.

## Ejercicio: depurar un unknown token

Selecciona `bajoz` en el visor y sigue las posiciones cubiertas por `bajo`. Explica qué pieza falta y qué ocurriría al añadir `##z`. Después compara el caso `abc`: para evitar aquel fallo podrías añadir `##c`, cambiar la política de segmentación o revisar el vocabulario. Son decisiones diferentes que necesitan pruebas diferentes.


## Explorar el laboratorio

El [visor interactivo](/assets/interactive/lexical-search/explorer.html) ejecuta el buscador en el navegador con las mismas fuentes. Permite comparar seis variantes y veinte queries, revisar tokens y contribuciones, escribir consultas sin etiquetas y seguir las subwords. No llama a servicios externos ni genera una respuesta con un LLM.

<iframe src="/assets/interactive/lexical-search/explorer.html" title="Buscador léxico y trazas de subwords" loading="lazy" width="100%" height="780" style="border:1px solid #475569;border-radius:8px;max-width:100%"></iframe>

## Código completo y pruebas

El laboratorio completo está en [lexical-search](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/lexical-search), separado del blog. Requiere Node 24.19 o posterior; no descarga modelos ni necesita claves de API.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --filter @luisrc-examples/lexical-search test
pnpm --filter @luisrc-examples/lexical-search verify
```

`verify` comprueba hashes y vuelve a calcular los 120 rankings, las métricas y las trazas. `exercise` crea una nueva captura; no es necesario sobrescribir la referencia para leerla.

- [analysis.mjs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/analysis.mjs)
- [retrieval.mjs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/retrieval.mjs)
- [evaluation.mjs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/evaluation.mjs)
- [subwords.mjs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/subwords.mjs)
- [corpus.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/corpus.json)
- [queries.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/queries.json)
- [protocol.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/protocol.json)
- [tests/search.test.mjs](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/tests/search.test.mjs)
- [results/observations.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/lexical-search/results/observations.json)

## Referencias

- [WordPiece tokenization y alcance del trainer descrito, Hugging Face](https://huggingface.co/learn/llm-course/en/chapter6/6).
- [WordpieceTokenizer, implementación de BERT](https://github.com/google-research/bert/blob/master/tokenization.py).

Para continuar, revisa una consulta donde el ranking falla y conserva su intención y sus etiquetas. Esa evidencia será necesaria al comparar recuperación léxica con representaciones densas.
