---
id: "NLP-BPE"
title: "BPE: cómo aprender subwords uniendo pares frecuentes"
published: "2026-10-27T17:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-bpe"
slug: "bpe-subwords-aprender-merges-tokenizacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-EVALUATION"]
description: "Cómo entrenar y aplicar merges sin confundir subwords con morfemas. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Guardar una entrada por palabra puede dejar fuera nombres y formas que no aparecieron al construir el vocabulario. Guardar solo caracteres evita ese problema dentro del alfabeto conocido, pero suele producir secuencias más largas. Las **subwords** ofrecen unidades intermedias.

**Byte Pair Encoding**, o **BPE**, puede aprender esas unidades uniendo pares frecuentes. Para entender qué aprende, seguiremos cinco fusiones sobre cuatro palabras, sin presentar esta versión pequeña como el tokenizer de un LLM.

Venimos de [Evaluar un buscador: el promedio no explica qué consulta acaba de fallar](/posts/evaluar-busqueda-bm25-precision-recall-mrr-errores).

## Aprender el tokenizer y usarlo son operaciones distintas

Durante el aprendizaje analizamos un corpus y elegimos fusiones. Durante la inferencia aplicamos las reglas ya aprendidas a una entrada nueva. Si volvemos a aprenderlas para cada texto, no estamos usando un vocabulario estable.

Nuestro corpus de palabras contiene `bajo` cinco veces, `bajos` dos, `baja` tres y `caja` dos. Inicialmente cada palabra se divide en caracteres. No permitimos fusiones entre palabras distintas y no añadimos marcadores de final de palabra.

El par `a + j` aparece doce veces al tener en cuenta los counts. Se convierte en `aj`. Después de cada fusión recalculamos las frecuencias sobre las representaciones resultantes.

<img src="/assets/visuals/lexical-search/NLP-BPE.svg" alt="Cómo entrenar y aplicar merges sin confundir subwords con morfemas. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="517" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Las frecuencias se cuentan sobre pares adyacentes

El código guarda el historial completo de cada paso. Si dos pares tienen la misma frecuencia, los ordena por la representación serializada de sus puntos de código. La regla de desempate forma parte de la reproducibilidad de esta demo.

```javascript
export function trainBpe(wordCounts, steps) {
  const words = Object.entries(wordCounts).map(([word,count]) => ({parts:[...word],count}));
  const merges = [], trace = [];
  for (let step=0;step<steps;step++) {
    const pairs = new Map();
    for (const {parts,count} of words) for (let i=0;i<parts.length-1;i++) {
      const key = JSON.stringify([parts[i],parts[i+1]]);
      pairs.set(key,(pairs.get(key) ?? 0) + count);
    }
    const ordered = [...pairs].sort((a,b) => b[1]-a[1] || (a[0]<b[0]?-1:1));
    if (!ordered.length) break;
    const [key,frequency] = ordered[0], [left,right] = JSON.parse(key);
    merges.push([left,right]);
    for (const word of words) word.parts = mergePair(word.parts,left,right);
    trace.push({step:step+1,pair:[left,right],frequency,words:words.map(w=>({...w,parts:[...w.parts]}))});
  }
  return {merges,trace};
}
```

Una función auxiliar realiza cada fusión de izquierda a derecha, sin solapar dos ocurrencias. Por ejemplo, al fusionar `a + a` dentro de `aaa`, produce `aa, a`, no dos piezas que compartan el carácter central. La prueba incluye este caso.

La secuencia observada es:

| Paso | Fusión | Frecuencia en ese paso |
| --- | --- | --- |
| 1 | `a + j → aj` | 12 |
| 2 | `b + aj → baj` | 10 |
| 3 | `baj + o → bajo` | 7 |
| 4 | `baj + a → baja` | 3 |
| 5 | `aj + a → aja` | 2 |

Las frecuencias pertenecen al estado de ese paso, no a una lista de substrings contados una sola vez en el texto original.

## La inferencia debe respetar las fusiones aprendidas

Aplicamos los merges en el orden guardado. `bajos` se convierte en `bajo, s`; `caja` queda como `c, aja`. La palabra nueva `cajo` produce `c, aj, o`, aunque esa forma completa no aparezca en el corpus de aprendizaje.

No buscamos una raíz lingüística. `aja` es una unidad útil según estas frecuencias, no una afirmación sobre cómo se construyen morfológicamente las palabras. Por eso BPE no sustituye a stemming ni lemmatization.

El visor permite aplicar cero, uno o hasta cinco merges. Ese control recorta una lista ya aprendida; no vuelve a entrenar un tokenizer con el texto que escribe el lector. Así podemos seguir cómo cambia la segmentación sin mezclar aprendizaje e inferencia.

## BPE de caracteres no garantiza cobertura de cualquier entrada

Nuestra implementación deja un carácter desconocido como pieza individual. Por ejemplo, `ñ` se muestra como `ñ`. Esa salida explica el algoritmo, pero no afirma que exista un **token ID** para ese carácter en el vocabulario de un modelo.

Para usar un tokenizer con un modelo hay que definir el alfabeto, las piezas válidas y el tratamiento de entradas desconocidas. Un BPE **byte-level** parte de bytes y tiene un contrato distinto de esta demostración de caracteres. No hemos implementado ese modo ni un mecanismo de byte fallback.

La guía de [BPE de Hugging Face](https://huggingface.co/learn/llm-course/en/chapter6/5) describe aprendizaje e inferencia con ejemplos más amplios. Nuestro experimento mantiene un corpus mínimo para poder comprobar cada frecuencia a mano.

## Cambiar de tokenizer puede cambiar el significado de los IDs

Un modelo entrenado asocia filas de su tabla de embeddings y salidas con IDs concretos. Si aprendemos otro vocabulario y conservamos el modelo sin adaptar esas asociaciones, un mismo número puede referirse a otra pieza.

Además de las fusiones, importan normalización, pre-tokenización, tokens especiales y reglas de decodificación. Al utilizar un modelo preentrenado debemos cargar su tokenizer compatible, no reemplazarlo por uno que produzca secuencias aparentemente más cortas.

Aquí no entrenamos un modelo de lenguaje ni comparamos su calidad. Las pocas palabras del corpus solo permiten estudiar cómo se construyen las piezas.

## Garantías y límites

Se guardan corpus, counts, cinco merges y estados intermedios. Probamos frecuencia, orden y fusiones no solapadas. No implementamos entrenamiento a escala, byte-level BPE, IDs de un modelo ni una política completa de unknown tokens.

## Ejercicio: anticipar una fusión antes de ejecutarla

Cuenta los pares del estado inicial usando las multiplicidades de cada palabra. Aplica `a + j` y vuelve a contar. Después comprueba la traza del visor. Si el siguiente par no coincide, revisa si contaste tipos de palabras en vez de ocurrencias.


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

- [Byte-Pair Encoding tokenization, Hugging Face](https://huggingface.co/learn/llm-course/en/chapter6/5).

Siguiente: [WordPiece: elegir la subword más larga también puede acabar en UNK](/posts/wordpiece-greedy-vocabulario-unk-diferencias-bpe).
