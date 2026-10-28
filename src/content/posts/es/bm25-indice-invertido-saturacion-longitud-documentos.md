---
id: "NLP-BM25"
title: "BM25 por dentro: postings, saturación y longitud de documentos"
published: "2026-10-27T15:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-bm25"
slug: "bm25-indice-invertido-saturacion-longitud-documentos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-TFIDF"]
description: "Cómo obtener un ranking explicable con frecuencia y longitud. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Repetir una palabra diez veces no debería hacer que un documento sea diez veces más útil. Además, un documento largo tiene más oportunidades de contener términos de la consulta. **BM25** incorpora ambas observaciones al construir su score.

No entiende si una afirmación es correcta ni si responde a toda la pregunta. Ofrece un ranking léxico que podemos descomponer: para cada término conocemos qué coincidió y cuánto aportó.

Venimos de [TF-IDF: de contar palabras a comparar vectores de documentos](/posts/tf-idf-cosine-pesos-terminos-busqueda).

## Un índice invertido encuentra candidatos sin pedir todas las palabras

El índice relaciona cada término con sus documentos mediante **postings**. Para consultar, analizamos el texto y reunimos la unión de los postings de sus términos. Es una búsqueda **OR**: basta con compartir uno para entrar como candidato.

Después calculamos scores positivos y ordenamos. En caso de empate usamos el ID en orden lexicográfico, para que el resultado no dependa accidentalmente del orden de inserción.

No hay semántica de frase ni obligación de cubrir todas las palabras. Esta decisión explica por qué «índice glucémico» devuelve notas sobre índices de bases de datos: la parte `indice` ya genera candidatos.

<img src="/assets/visuals/lexical-search/NLP-BM25.svg" alt="Cómo obtener un ranking explicable con frecuencia y longitud. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="473" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La contribución combina rareza, frecuencia y longitud

Para cada término único de consulta sumamos esta contribución:

$$
\operatorname{IDF}(t)\,
\frac{f(t,d)(k_1+1)}{f(t,d)+k_1(1-b+b|d|/\overline L)}
$$

`f(t,d)` es TF; `|d|`, la longitud analizada del documento; y la media de longitudes del corpus es `L̄`. En la variante de palabras con fold, esa media vale 21,15 tokens.

Utilizamos una IDF positiva: `ln(1 + (N - DF + 0,5) / (DF + 0,5))`. Es la forma documentada por [BM25Similarity de Lucene](https://lucene.apache.org/core/10_3_1/core/org/apache/lucene/search/similarities/BM25Similarity.html). Fijamos **k1 = 1,2** y **b = 0,75** antes de ejecutar; no los elegimos tras ver test.

```javascript
export function bm25Contribution(tf, df, N, length, avgLength, k1, b) {
  if (!tf) return 0;
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const lengthFactor = 1 - b + b * length / avgLength;
  return idf * tf * (k1 + 1) / (tf + k1 * lengthFactor);
}
```

No declaramos que este pequeño buscador replique Lucene: no implementa sus índices, cuantización de normas, optimizaciones ni todos los detalles de scoring. La fórmula y sus unidades son el contrato de nuestro experimento.

## k1 controla cuánto sigue aportando la repetición

La fracción aumenta con TF, pero se aproxima a un límite cuando los demás valores permanecen fijos. Para un término con IDF fija, ese límite es `IDF × (k1 + 1)`.

Con k1 igual a cero, cualquier TF positiva aporta la misma cantidad y la longitud deja de intervenir en la fracción. Con k1 positivo hay ganancias por repetición, cada vez menores. Ese comportamiento se llama **saturación**.

La figura usa un corpus hipotético de veinte documentos, DF dos y longitud igual a la media, cuarenta. Son valores analíticos calculados por la misma función, no una medición de rendimiento.

<img src="/assets/interactive/lexical-search/saturation.svg" alt="Contribución BM25 al crecer TF de cero a veinte, manteniendo DF dos de veinte, longitud cuarenta y media cuarenta, k1 1,2 y b 0,75. Cálculo analítico, no benchmark." width="380" height="406" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Un k1 mayor permite que la frecuencia siga teniendo influencia durante más tiempo. Eso no significa que sea mejor: la repetición también puede proceder de plantillas, código duplicado o texto poco informativo.

## b decide cuánto pesa la longitud relativa

Con **b = 0**, el término de longitud vale uno para todos los documentos. Con **b = 1**, depende completamente de la relación entre longitud del documento y longitud media, dentro de esta fórmula.

Si mantenemos TF dos y cambiamos la longitud de diez a ciento sesenta, el score baja. Estamos manteniendo fija una señal y variando otra para ver el mecanismo; no afirmamos que cualquier documento largo deba quedar detrás de uno corto.

<img src="/assets/interactive/lexical-search/length.svg" alt="Contribución BM25 para TF dos y longitudes de diez a ciento sesenta con media cuarenta, DF dos de veinte, k1 1,2 y b 0,75. Las demás variables permanecen fijas." width="380" height="310" loading="lazy" style="width:100%;max-width:380px;height:auto" />

La longitud depende del analyzer. Al pasar de palabras a trigramas cambian tanto las longitudes como DF y TF. Por eso no tiene sentido comparar los scores brutos de ambas variantes como si midieran confianza en la misma escala.

## Una suma concreta permite revisar el ranking

En Q01, «indice b tree», D01 recibe aproximadamente 1,980730 por `indice`, 3,451974 por `b` y 3,451974 por `tree`: en total, 8,884678 con fold. D02 solo comparte `indice` y obtiene aproximadamente 2,266315.

El visor muestra las contribuciones, sus TF y DF y la longitud utilizada. Una prueba comprueba que su suma coincide con el score. Otra contrasta la recuperación por postings con un cálculo exhaustivo sobre un fixture pequeño.

Tratamos las repeticiones de términos en la consulta como una sola aparición para BM25: «gato gato» devuelve lo mismo que «gato». Otras variantes pueden modelar frecuencia de consulta; no debemos atribuirles automáticamente nuestra política.

## Garantías y límites

Construimos postings, puntuamos con BM25 y conservamos rankings completos. No medimos capacidad de un motor de producción ni estimamos probabilidad de relevancia. Un candidato con muchas coincidencias puede seguir sin responder a la intención.

## Ejercicio: explicar el primer resultado sin usar adjetivos

Abre Q13 con fold y después con el reductor de plurales. Anota qué término nuevo coincide y qué DF cambia. Comprueba si el documento relevante cambia de posición antes de decidir si el nuevo score representa una mejora.


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

- [BM25Similarity, documentación de Lucene](https://lucene.apache.org/core/10_3_1/core/org/apache/lucene/search/similarities/BM25Similarity.html).
- [Okapi BM25, Introduction to Information Retrieval](https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html).

Siguiente: [Evaluar un buscador: el promedio no explica qué consulta acaba de fallar](/posts/evaluar-busqueda-bm25-precision-recall-mrr-errores).
