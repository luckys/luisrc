---
id: "NLP-TFIDF"
title: "TF-IDF: de contar palabras a comparar vectores de documentos"
published: "2026-10-27T14:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-tfidf"
slug: "tf-idf-cosine-pesos-terminos-busqueda"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-NGRAMS"]
description: "Cómo frecuencia, rareza y normalización construyen un score sparse. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Una palabra repetida muchas veces puede indicar de qué trata un documento. También puede ser una palabra que aparece en casi toda la colección. **TF-IDF** separa esas dos señales: frecuencia dentro del documento y capacidad de distinguirlo de los demás.

El resultado es un vector **sparse**, con pesos para los términos presentes. Podemos compararlo con el vector de una consulta sin entrenar un modelo ni generar embeddings densos.

Venimos de [N-grams: recuperar una errata sin llenar el ranking de parecidos](/posts/n-grams-palabras-caracteres-busqueda-errores).

## TF y DF cuentan cosas diferentes

**Term frequency**, o **TF**, cuenta las ocurrencias de un término en un documento. **Document frequency**, o **DF**, cuenta en cuántos documentos aparece al menos una vez.

Si `hash` aparece tres veces en D08 y una en D09, su TF en D08 es tres y su DF en esta colección es dos. No es cuatro: DF no suma todas las apariciones.

Hay distintas convenciones de TF-IDF. En esta serie utilizamos TF bruto, una IDF suavizada y normalización L2. La fórmula declarada es:

$$
\operatorname{idf}(t)=\ln\left(\frac{1+N}{1+\operatorname{df}(t)}\right)+1
$$

N es el número de documentos. Sumamos uno en numerador y denominador y otro fuera del logaritmo; no afirmamos que esa sea la única definición válida. La [documentación de extracción de features de scikit-learn](https://scikit-learn.org/stable/modules/feature_extraction.html#tfidf-term-weighting) describe esta convención de pesos.

<img src="/assets/visuals/lexical-search/NLP-TFIDF.svg" alt="Cómo frecuencia, rareza y normalización construyen un score sparse. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="464" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Cosine compara la dirección de los vectores

El peso sin normalizar es `TF × IDF`. La norma L2 de un vector es la raíz cuadrada de la suma de los cuadrados de sus componentes. **Cosine similarity** divide su producto escalar entre las dos normas.

Con pesos no negativos, el score queda entre cero y uno, salvo pequeños efectos de redondeo. Eso no lo convierte en probabilidad de relevancia. Dos textos pueden tener una dirección parecida en este espacio y expresar ideas incompatibles.

El código de `retrieval.mjs` calcula el producto escalar sobre términos compartidos y las dos normas:

```javascript
export function cosineScore(index, id, queryTokens) {
  const doc = index.documents.find(d => d.id === id);
  if (!doc) throw Error('Documento desconocido');
  const query = countsOf(queryTokens.filter(t => index.df.has(t)));
  const idf = t => Math.log((1 + index.documents.length) / (1 + index.df.get(t))) + 1;
  let dot = 0, docSquared = 0, querySquared = 0;
  for (const [t,tf] of doc.counts) docSquared += (tf * idf(t)) ** 2;
  for (const [t,tf] of query) {
    const weight = tf * idf(t);
    querySquared += weight ** 2;
    dot += weight * (doc.counts.get(t) ?? 0) * idf(t);
  }
  return docSquared && querySquared ? dot / Math.sqrt(docSquared * querySquared) : 0;
}
```

Las estadísticas de IDF se obtienen solo del corpus de documentos. Las consultas no se añaden como documentos para ajustar los pesos. Los términos de consulta ausentes del vocabulario se ignoran en el vector, una decisión que también debemos conocer al interpretar el score.

## Un cálculo pequeño permite comprobar la implementación

La prueba usa dos documentos: A contiene «gato gato» y B contiene «gato perro». La consulta es «gato».

N vale dos. `gato` aparece en los dos documentos, por lo que su IDF es 1. `perro` aparece en uno, así que su IDF es `1 + ln(3/2)`, aproximadamente 1,405465.

El vector de A tiene una única componente no nula, de peso dos. El de la consulta también tiene una sola componente, de peso uno. Comparten dirección y cosine vale 1, aunque A repita la palabra.

En B, los pesos son 1 para `gato` y aproximadamente 1,405465 para `perro`. Su score es `1 / sqrt(1 + 1,405465²)`, aproximadamente 0,579739. La componente de `perro` aumenta la norma sin aportar producto escalar con la consulta.

Este fixture tiene un resultado que podemos derivar sin reutilizar la función bajo prueba. Si confundimos TF y DF o quitamos la normalización, el test puede detectar el error.

## Las palabras desconocidas muestran un límite de la representación

En el fixture, «gato zorro» obtiene el mismo vector de consulta que «gato», porque `zorro` no existe en el vocabulario. No hay una componente desconocida con la que representar su intención.

En la colección real del laboratorio ocurre algo parecido con términos de Q20, «índice glucémico». El sistema puede puntuar la parte conocida e ignorar otra que cambia por completo la necesidad de información. Un score alto respecto a los términos conocidos no demuestra que toda la pregunta tenga respuesta.

Esta es una limitación que merece aparecer junto al valor numérico. No se resuelve simplemente mostrando más decimales o interpretando un umbral como confianza sin calibrarlo.

## Qué aporta la comparación con BM25

TF-IDF con fold y BM25 con fold tienen el mismo Recall@3 y MRR@3 agregados en las nueve consultas test con respuesta. Sus scores son distintos y no tienen una escala común.

La igualdad de esas métricas en una colección pequeña no prueba que los métodos sean equivalentes. Algunas consultas tienen pocos candidatos, y varias diferencias de orden no cambian si el único relevante ya aparece primero. BM25 nos permitirá estudiar de forma explícita saturación de TF y ajuste por longitud.

## Garantías y límites

Los vectores se calculan con la convención documentada y un fixture independiente. No utilizamos SVD, embeddings densos ni entrenamiento supervisado. El resultado sigue dependiendo del analyzer y conserva las pérdidas de orden de una bolsa de términos.

## Ejercicio: comprobar qué cambia al repetir todo un documento

Duplica todas las ocurrencias de A en el fixture manteniendo el mismo vocabulario y DF. Calcula su nueva norma y cosine con «gato». Después duplica solo una palabra de un documento con varias componentes. Explica por qué la normalización no produce el mismo efecto en ambos casos.


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

- [TF-IDF term weighting, scikit-learn](https://scikit-learn.org/stable/modules/feature_extraction.html#tfidf-term-weighting).

Siguiente: [BM25 por dentro: postings, saturación y longitud de documentos](/posts/bm25-indice-invertido-saturacion-longitud-documentos).
