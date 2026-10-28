---
id: "P106"
title: "Corpus de búsqueda: decidir qué documento responde a una consulta"
published: "2026-10-27T08:00:00Z"
locale: "es"
translationKey: "lexical-search-p106"
slug: "corpus-busqueda-lexica-documentos-consultas-relevancia"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DB-SQL", "DB-ANALYTICS", "P086"]
description: "Cómo fijar unidad documental, procedencia y etiquetas antes del ranking. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Buscar «índice glucémico» en una colección de notas de backend devuelve dos artículos sobre índices de bases de datos. El programa encuentra coincidencias y ordena documentos, pero la colección no contiene una respuesta a esa pregunta.

Antes de discutir qué algoritmo usar, necesitamos decidir qué vamos a buscar y cómo reconoceremos un resultado útil. Ese trabajo forma parte de construir el buscador: sin él, podríamos mejorar el score y empeorar la experiencia del lector.

Para las bases de consultas y agregación puedes volver a [JOIN, NULL y agregaciones](/posts/sql-joins-null-agregaciones) y [CTE y window functions](/posts/sql-cte-ventanas-cohortes). Ambas ayudan a razonar sobre filas, recuentos y denominadores antes de comparar resultados.

## Un corpus es una colección con límites

Un **corpus** es la colección de textos que vamos a procesar. Puede contener artículos, contratos, incidencias o descripciones de productos. Su elección determina qué preguntas puede responder el sistema y qué vocabulario estará disponible.

Para esta serie escribimos veinte documentos breves en español sobre programación. Cada uno tiene un **ID** estable, un título, un cuerpo, un idioma y una versión. Son textos originales creados para enseñar mecanismos, no una muestra de búsquedas reales ni una colección descargada de producción.

El buscador indexa `title + body` con el mismo peso para ambos campos. El título aparece una vez dentro de ese texto combinado. Un término repetido en título y cuerpo cuenta dos veces. No hemos añadido un boost oculto al título.

**D06** explica por qué hay que probar las copias de seguridad; **D07** describe cómo restaurarlas. La consulta «restaurar respaldo» considera útiles los dos documentos, aunque no compartan exactamente las mismas palabras. Esa diferencia entre intención y coincidencia será importante al evaluar.

<img src="/assets/visuals/lexical-search/P106.svg" alt="Cómo fijar unidad documental, procedencia y etiquetas antes del ranking. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="498" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La unidad documental cambia lo que significa recuperar algo

Aquí cada nota es un documento. Si dividiéramos una nota en diez fragmentos, pasaríamos a buscar fragmentos: cambiarían sus longitudes, las frecuencias estadísticas y el conjunto de resultados posibles.

También cambiarían las etiquetas. Una nota completa puede resolver una pregunta aunque un fragmento aislado omita la parte necesaria. No podemos reutilizar sin revisión una etiqueta del documento como si demostrara que todos sus fragmentos son útiles.

Para una primera implementación conviene conservar una relación clara entre **ID**, texto mostrado y contenido indexado. Si una consulta termina en D07, debemos poder revisar qué versión de D07 produjo la coincidencia. Los IDs no dependen de su posición en una lista ni se vuelven a asignar al ordenar resultados.

## Las consultas describen necesidades, no listas de palabras acertadas

Guardamos veinte consultas en `queries.json`, cada una con intención, categoría, split y documentos relevantes. Hay consultas con tildes omitidas, plurales, erratas, términos ambiguos y una pregunta fuera de alcance.

Las etiquetas son **juicios didácticos del autor**. Para cada consulta, los IDs de `relevant` se consideran relevantes y todos los demás documentos del corpus se juzgan no relevantes. Con veinte documentos y veinte consultas, el protocolo define los cuatrocientos pares. Esa convención está escrita; no dejamos documentos sin juzgar para tratarlos después como negativos por comodidad.

En una colección grande suele ser inviable revisar todos los pares. Allí hay que distinguir **no relevante** de **no juzgado**. El capítulo de [evaluación de Information Retrieval](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-in-information-retrieval-1.html) sitúa los juicios de relevancia en el centro de la comparación entre sistemas.

## Construir el índice conserva las decisiones del corpus

Este fragmento de `retrieval.mjs` crea counts, longitudes y **postings**. Un posting relaciona un término con un documento y su número de apariciones. `analyze` es una función que transformará el texto en tokens; dedicaremos los siguientes artículos a esas transformaciones.

```javascript
export function buildIndex(corpus, analyze = analyzer()) {
  if (!corpus.length) throw Error('Corpus vacío');
  const postings = new Map(), df = new Map(), ids = new Set();
  const documents = corpus.map(doc => {
    if (!doc.id || ids.has(doc.id)) throw Error('ID duplicado o vacío');
    ids.add(doc.id);
    const tokens = analyze((doc.title ?? '') + ' ' + doc.body);
    const counts = countsOf(tokens);
    for (const [term,tf] of counts) {
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(doc.id,tf);
      df.set(term,(df.get(term) ?? 0) + 1);
    }
    return {...doc, tokens, counts, length:tokens.length};
  });
  const avgLength = documents.reduce((s,d) => s + d.length,0) / documents.length;
  if (!avgLength) throw Error('No hay tokens indexables');
  return {documents, postings, df, avgLength, analyze};
}
```

El mapa de **DF** se incrementa una vez por término y documento, aunque ese término aparezca muchas veces en la nota. Los counts conservan esas repeticiones por separado. Confundir ambos valores altera los pesos de todo el ranking.

Rechazamos IDs duplicados y corpus sin tokens indexables. El experimento comprueba además duplicados exactos tras NFC y lowercase sobre el texto combinado. No hemos implementado detección de near-duplicates: dos versiones casi idénticas podrían contar dos veces y cambiar las estadísticas.

## Dev y test ayudan a organizar el trabajo, pero no borran cómo se creó el conjunto

Q01–Q10 forman **dev** y Q11–Q20 forman **test**. Fijamos corpus, etiquetas, seis variantes y parámetros antes de calcular los primeros rankings. No buscamos una configuración ganadora ni cambiamos las etiquetas tras ver los resultados.

El autor conoce la colección y diseñó sus preguntas. Por eso, aunque llamemos test a una partición, no la presentamos como una evaluación ciega ni como evidencia de calidad comercial. Sirve para reproducir y discutir casos concretos.

Para evaluar un producto harían falta necesidades de información representativas, revisores con criterios compartidos y más variedad de documentos. Esa inversión tiene sentido cuando sabemos qué comportamiento queremos medir. En esta serie empezamos con una colección que se puede inspeccionar por completo.

## Garantías y límites

El corpus, las consultas y sus etiquetas están guardados y versionados. La consulta Q20 no tiene respuesta; devolver documentos no cambia esa etiqueta. No utilizamos un LLM para inventar juicios de relevancia ni ejecutamos instrucciones contenidas en los resultados.

## Ejercicio: escribir la etiqueta antes de ver el ranking

Elige tres notas de un proyecto y escribe cinco preguntas que alguien podría hacer sobre ellas. Para cada pregunta, señala el documento que contiene la respuesta y el fragmento que justifica la decisión. Incluye una pregunta que ninguna nota resuelva. Solo después ejecuta la búsqueda.


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

- [Evaluation in information retrieval, Stanford](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-in-information-retrieval-1.html).

Siguiente: [Normalizar texto sin borrar diferencias que importan](/posts/normalizacion-texto-unicode-tildes-nfc-busqueda).
