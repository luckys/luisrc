---
id: "NLP-EVALUATION"
title: "Evaluar un buscador: el promedio no explica qué consulta acaba de fallar"
published: "2026-10-27T16:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-evaluation"
slug: "evaluar-busqueda-bm25-precision-recall-mrr-errores"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-BM25"]
description: "Cómo medir top-k con etiquetas y conservar errores fuera de alcance. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

El buscador devuelve el documento de Rust entre sus tres primeros resultados. Esa observación parece positiva hasta que vemos que está tercero, detrás de dos notas sobre copias de seguridad. Una métrica puede conservar su valor mientras otra revela una regresión importante.

Evaluar búsqueda requiere definir qué cuenta como resultado relevante, cuántos resultados vamos a revisar y qué errores no queremos esconder dentro del promedio.

Venimos de [BM25 por dentro: postings, saturación y longitud de documentos](/posts/bm25-indice-invertido-saturacion-longitud-documentos).

## Las etiquetas corresponden a una intención concreta

Cada consulta tiene una intención escrita y una lista de documentos relevantes. En Q18, «logs sin secretos», buscamos una guía preventiva. D18 es relevante; D19 describe un incidente donde se filtraron secretos y no se etiqueta como respuesta a esa necesidad.

Esa decisión podría ser diferente para una consulta sobre cómo responder a una filtración. La relevancia no es una propiedad universal del documento: relaciona el documento con una necesidad de información.

Fijamos los juicios antes del primer ranking. No cambiamos una etiqueta porque un documento haya obtenido un score alto. Para una evaluación con usuarios reales necesitaríamos criterios de anotación, revisión de desacuerdos y una muestra representativa. Aquí conservamos explícitamente el carácter didáctico y subjetivo del conjunto.

<img src="/assets/visuals/lexical-search/NLP-EVALUATION.svg" alt="Cómo medir top-k con etiquetas y conservar errores fuera de alcance. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="565" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## P@3 y R@3 responden a preguntas distintas

**Precision@3**, o **P@3**, divide los relevantes recuperados en los primeros tres puestos entre tres. **Recall@3**, o **R@3**, divide esos mismos aciertos entre todos los documentos etiquetados como relevantes para la consulta.

En Q12, «restaurar respaldo», son relevantes D06 y D07. BM25 con fold devuelve solo D07. Por tanto, P@3 vale 1/3 y R@3 vale 1/2.

Mantenemos el denominador tres aunque el buscador devuelva un único resultado. Otra convención podría dividir entre el número devuelto; sería una métrica distinta y tendría que declararse. Nuestro protocolo evita presentar una lista de un documento como precisión perfecta en tres posiciones.

El código separa las consultas sin respuesta antes de calcular estas métricas:

```javascript
export function metrics(ranking, relevantIds, k = 3) {
  if (!Number.isInteger(k) || k < 1) throw Error('k inválido');
  if (new Set(ranking.map(r => r.id)).size !== ranking.length) throw Error('Ranking duplicado');
  if (!relevantIds.length) return null;
  const relevant = new Set(relevantIds);
  const top = ranking.slice(0,k);
  const hits = top.filter(r => relevant.has(r.id)).length;
  const first = top.findIndex(r => relevant.has(r.id));
  return {precision:hits/k, recall:hits/relevant.size, rr:first < 0 ? 0 : 1/(first+1), hits};
}
```

## MRR@3 permite detectar si el relevante llegó demasiado tarde

El **reciprocal rank** de una consulta vale uno dividido entre la posición del primer relevante. En esta serie truncamos en tres: si no aparece ningún relevante en esos puestos, vale cero.

**MRR@3** es la media de ese valor entre las consultas evaluadas. Q17, «prestamos rust», obtiene RR@3 igual a 1 con palabras completas y 1/3 con trigramas. Recall@3 permanece en 1 en ambos casos.

MRR tampoco lo explica todo. Si una pregunta tiene varios relevantes, solo atiende al primero. Por eso no sustituimos todas las medidas por un único número; combinamos métricas con inspección de rankings y errores concretos.

## Qué obtuvieron las seis variantes

La tabla corresponde a las **nueve consultas test que sí tienen respuesta**, con medias por consulta, o **macro averages**. No mezcla las diez consultas dev ni asigna un recall artificial a la consulta fuera de alcance.

<div role="region" aria-label="Métricas test, nueve consultas con respuesta" tabindex="0" style="overflow-x:auto;max-width:100%">

| Configuración | P@3 | R@3 | MRR@3 |
| --- | --- | --- | --- |
| bm25-literal | 0,296296 | 0,833333 | 0,888889 |
| bm25-fold | 0,296296 | 0,833333 | 0,888889 |
| bm25-plural | 0,296296 | 0,833333 | 0,888889 |
| bm25-lookup | 0,296296 | 0,833333 | 0,888889 |
| bm25-char3 | 0,370370 | 1,000000 | 0,925926 |
| tfidf-fold | 0,296296 | 0,833333 | 0,888889 |

</div>

<img src="/assets/interactive/lexical-search/test-recall.svg" alt="Recall arroba tres macro sobre nueve consultas test con respuesta. Trigramas llega a uno en este corpus didáctico y conserva una regresión de orden en la consulta de Rust." width="380" height="358" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Los trigramas mejoran el agregado y recuperan la errata Q19, pero conservamos la regresión Q17. Stemming limitado, lookup y TF-IDF no mejoran estas métricas respecto a BM25 con fold en test. No descartamos sus resultados para fabricar un progreso continuo en cada artículo.

Dev tiene diez consultas con respuesta. Sus valores se guardan por separado; no los usamos para elegir retrospectivamente una variante ganadora. Los seis contrastes y parámetros estaban fijados antes de calcular resultados.

## Una consulta sin respuesta necesita su propia revisión

Q20, «índice glucémico», no tiene documentos relevantes. Recall dividiría entre cero, por lo que devolvemos `null`, no uno ni cero arbitrariamente. Tampoco la incluimos en MRR o P@3 agregados de consultas con respuesta.

La revisamos aparte: BM25 con fold devuelve D02 y D01, ambos irrelevantes. Los trigramas devuelven D01, D02 y D08 en sus tres primeros puestos. Los scores positivos solo demuestran coincidencias bajo la representación elegida.

Un sistema que necesita abstenerse debe diseñar y evaluar esa decisión. Nuestro laboratorio no calibra umbrales ni estima tasa de falsos positivos con una única pregunta negativa. Se limita a conservar el contraejemplo que impide interpretar «hubo resultados» como «hay respuesta».

## El análisis de errores da una dirección al siguiente experimento

Q10 mejora por retirar la tilde de `retención`, sin corregir `anios`. Q12 pierde D06 con palabras completas porque no comparte términos suficientes. Q19 necesita tolerancia a una errata. Q17 empeora por fragmentos comunes de palabras no relacionadas.

Cada caso sugiere hipótesis diferentes: normalización, expansión léxica, tolerancia ortográfica o combinación de campos. No son equivalentes y no deben introducirse todas a la vez si queremos saber cuál causó el cambio.

Después de revisar test ya conocemos sus fallos. Si ahora diseñamos una mejora con esa información, necesitaremos nuevas consultas reservadas para estimar su calidad. La partición original sigue siendo útil como regresión, pero deja de ser una sorpresa para quien modifica el sistema.

## Garantías y límites

Se guardan los 120 rankings, métricas por consulta, errores y nueve hashes de fuentes y entradas. `verify` recalcula la captura completa. No hay un benchmark de latencia ni una afirmación de significación estadística sobre nueve ejemplos construidos a mano.

## Ejercicio: hacer que una métrica falle antes de cambiar el buscador

Compara Q17, Q19 y Q20. Para cada consulta, escribe qué comportamiento quieres mejorar, qué medida lo detectaría y qué regresión debes vigilar. Conserva ese registro antes de ampliar el vocabulario o ajustar parámetros.


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

- [Assessing relevance, Stanford](https://nlp.stanford.edu/IR-book/html/htmledition/assessing-relevance-1.html).

Siguiente: [BPE: cómo aprender subwords uniendo pares frecuentes](/posts/bpe-subwords-aprender-merges-tokenizacion).
