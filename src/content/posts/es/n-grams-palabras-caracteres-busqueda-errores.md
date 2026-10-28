---
id: "NLP-NGRAMS"
title: "N-grams: recuperar una errata sin llenar el ranking de parecidos"
published: "2026-10-27T13:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-ngrams"
slug: "n-grams-palabras-caracteres-busqueda-errores"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-LEMMA"]
description: "Cómo ventanas de palabras y caracteres cambian recall y ruido. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

La consulta `toknizacion` no comparte una palabra completa con «tokenización». Sin embargo, conserva varias secuencias de letras. Un buscador de **character n-grams** puede aprovechar esas coincidencias sin corregir explícitamente la palabra.

Esa tolerancia tiene un coste: dos palabras pueden compartir fragmentos y hablar de cosas distintas. En nuestro laboratorio, la misma estrategia que rescata esa errata empeora el primer resultado de «prestamos rust».

Venimos de [Lemmatization: por qué un diccionario no resuelve toda la morfología](/posts/lemmatization-lookup-contexto-ambiguedad-busqueda).

## Un n-gram es una ventana de n unidades consecutivas

La unidad puede ser una palabra o un carácter. Los **word bigrams** de «logs sin secretos» son `logs sin` y `sin secretos`. Conservan relaciones locales de orden que una bolsa de palabras individuales pierde.

Los **character trigrams** de `caché` son `cac`, `ach` y `ché`. En nuestra variante fold se forman después de normalizar: se trabaja sobre `cache` y la última pieza es `che`.

Para una secuencia de longitud L y un n fijo, esta implementación produce `max(0, L - n + 1)` ocurrencias. Si la palabra es más corta que n, no produce ninguna. No añadimos marcadores de principio ni final.

<img src="/assets/visuals/lexical-search/NLP-NGRAMS.svg" alt="Cómo ventanas de palabras y caracteres cambian recall y ruido. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="487" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## El código hace visible qué se considera carácter

El fragmento usa expansión de string a puntos de código antes de crear las ventanas:

```javascript
export function charNgrams(word, n) {
  if (!Number.isInteger(n) || n < 1) throw Error('n debe ser entero positivo');
  const chars = [...word];
  return Array.from({length: Math.max(0, chars.length - n + 1)},
    (_, i) => chars.slice(i, i + n).join(''));
}
```

Esto evita cortar un punto de código representado por dos unidades UTF-16. No equivale a segmentar todos los **grapheme clusters** que una persona percibe como caracteres. NFC compone ciertas secuencias, pero no convierte todos los grafemas posibles en un único punto de código.

Los trigramas se calculan dentro de cada palabra tokenizada. No cruzan espacios ni unen el final de una palabra con el principio de la siguiente. Los word n-grams son una función distinta y se muestran en el visor como otro tipo de unidad.

## Compartir fragmentos permite recuperar la errata

Con **bm25-fold**, Q19, `toknizacion`, no devuelve coincidencias. Con **bm25-char3**, D17, «Tokenización de texto», aparece primero. Entre los fragmentos compartidos están `tok`, `niz`, `iza` y `zac`.

El algoritmo no ha inferido la intención de la persona ni reconstruido una ortografía correcta. Ha encontrado secuencias compartidas y las ha ponderado con BM25. Esta explicación más pequeña basta para entender el resultado y permite investigar qué ocurrirá con otra errata.

El mismo contraste recupera D06 además de D07 en Q12. No hemos añadido «respaldo» como sinónimo. La representación permite coincidencias parciales entre otras formas de la consulta y del documento, como las relacionadas con restaurar y restauración.

## El mismo mecanismo introduce ruido en otra consulta

Con palabras completas, Q17, «prestamos rust», coloca D15, «Rust y ownership», primero gracias a `rust`. En el índice de trigramas, el orden es D06, D07 y D15.

Los documentos sobre copias de seguridad ganan contribuciones por `res`, `est` y `sta`, fragmentos presentes en «prestamos» y en formas de restaurar. D15 queda tercero aunque siga siendo el único relevante según la intención anotada.

El **Recall@3** de esa consulta sigue siendo 1: el documento está dentro de los tres primeros. Su **RR@3** baja de 1 a 1/3. Si observáramos únicamente recall, diríamos que no hubo regresión, aunque el lector ahora tenga que descartar dos resultados antes de llegar al útil.

## Más términos también cambian el coste y las estadísticas

El índice fold de palabras tiene 237 términos distintos; el de trigramas tiene 598. La longitud media analizada también cambia, porque ahora contamos ventanas y no palabras.

La fórmula de BM25 sigue siendo la misma, pero **TF**, **DF** y longitud describen otras unidades. Un score de 20 en trigramas no es una señal de confianza mayor que un score de 5 en palabras. Sus escalas no tienen esa interpretación.

En producción, más ocurrencias y postings pueden aumentar memoria, tiempo de indexación y trabajo de consulta. Este laboratorio no mide esos costes ni contiene suficientes documentos para estimarlos. El recuento de vocabulario muestra una diferencia estructural; no es un benchmark de latencia.

## Trigramas, edge n-grams y subwords no son intercambiables

Una ventana que recorre todas las posiciones difiere de un **edge n-gram**, que crece desde un extremo y puede ser útil para autocompletado. Tampoco es **BPE**, que aprende fusiones a partir de frecuencias y no conserva todas las ventanas de un tamaño fijo.

Se pueden combinar campos exactos, palabras y fragmentos. Eso obliga a definir pesos y una evaluación que incluya las regresiones. Aquí mantenemos seis contrastes separados para ver qué aporta cada representación antes de diseñar una combinación.

## Garantías y límites

La errata se recupera y la regresión de Rust se conserva. No afirmamos comprensión semántica, corrección general de faltas ni rendimiento superior. La documentación de [n-gram tokenizer de Elasticsearch](https://www.elastic.co/docs/reference/text-analysis/analysis-ngram-tokenizer) ofrece otro contexto de implementación; nuestro laboratorio no ejecuta Elasticsearch.

## Ejercicio: buscar una mejora y su coste

Cambia al índice de trigramas y compara Q19 con Q17. Abre las contribuciones del primer resultado y localiza los fragmentos que lo elevaron. Decide qué métrica detecta cada cambio antes de proponer un peso nuevo.


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

- [N-gram tokenizer, Elasticsearch](https://www.elastic.co/docs/reference/text-analysis/analysis-ngram-tokenizer).

Siguiente: [TF-IDF: de contar palabras a comparar vectores de documentos](/posts/tf-idf-cosine-pesos-terminos-busqueda).
