---
id: "NLP-LEMMA"
title: "Lemmatization: por qué un diccionario no resuelve toda la morfología"
published: "2026-10-27T12:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-lemma"
slug: "lemmatization-lookup-contexto-ambiguedad-busqueda"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-STEMMING"]
description: "Qué información hace falta para convertir una forma en su lema. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Un diccionario puede relacionar «contraseñas» con «contraseña» sin eliminar sufijos de otras palabras. En cambio, decidir qué lema corresponde a «fue» requiere más información: puede proceder de «ser» o de «ir».

La **lemmatization** busca una forma de referencia lingüística, el **lema**. Entender qué información utiliza evita confundir una tabla de sustituciones con un sistema que analiza la palabra en su contexto.

Venimos de [Stemming: agrupar variantes también puede mezclar palabras distintas](/posts/stemming-busqueda-reducir-sufijos-falsas-coincidencias).

## El lema y el stem cumplen contratos distintos

Un **stem** es una representación a la que llegamos mediante reglas de reducción; no necesita existir como palabra de diccionario. Un lema pretende identificar una forma lingüística de referencia, como el infinitivo de un verbo o la forma canónica de un sustantivo.

Eso no garantiza que todo lemmatizer acierte ni que necesite siempre una red neuronal. Hay sistemas basados en diccionarios, reglas y análisis morfológico. Algunos necesitan **part of speech**, o **POS**, para elegir entre alternativas. La [API de lemmatizer de spaCy](https://spacy.io/api/lemmatizer) distingue modos y sus dependencias de pipeline.

La decisión útil es qué información necesita la implementación elegida y qué errores produce en el dominio. Llamar lema al resultado no hace desaparecer la ambigüedad del lenguaje.

<img src="/assets/visuals/lexical-search/NLP-LEMMA.svg" alt="Qué información hace falta para convertir una forma en su lema. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="549" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## El laboratorio ejecuta un lookup pequeño y auditable

Guardamos un diccionario explícito en `lexicon.json`. Contiene trece correspondencias, entre ellas `contraseñas → contraseña`, `tokens → token` y `copias → copia`. Está fijado antes de calcular los rankings.

La función consulta solo claves propias del objeto, de modo que una palabra ajena al diccionario permanezca igual:

```javascript
export function lemmaLookup(token, lexicon) {
  return Object.hasOwn(lexicon, token) ? lexicon[token] : token;
}
```

Antes de utilizar ese diccionario en el analyzer **lookup**, normalizamos sus claves y valores con la misma política fold aplicada a los tokens. Así, la tabla y los documentos no utilizan representaciones incompatibles por las tildes.

La consulta a la tabla no utiliza la frase completa. No hay un tagger de POS ni un modelo de contexto. Si aparece `fue`, se conserva como `fue`, porque no existe una correspondencia definida. Elegir «ser» para todas las ocurrencias ocultaría una ambigüedad en vez de resolverla.

## Las formas regulares no bastan para probar un lemmatizer

Una tabla con plurales sencillos puede dar una impresión excesivamente favorable. Los verbos irregulares, formas ambiguas y vocabulario técnico plantean decisiones adicionales.

Incluso un lema correcto puede perder una distinción importante para el producto. Una búsqueda legal o lingüística puede necesitar la forma exacta; una búsqueda general puede preferir agrupar variantes. Por eso conviene conservar el original y evaluar la política de recuperación completa.

El pequeño lookup evita el fallo `lunes → lun` del reductor anterior porque no tiene una regla general para terminaciones desconocidas. A cambio, deja sin agrupar todas las formas que no aparecen en su tabla. Es un intercambio entre cobertura y control, no una victoria universal del diccionario sobre las reglas.

## Morfología y sinónimos deben revisarse por separado

Convertir «copias» en «copia» trata una variación morfológica. Relacionar «respaldo» con «copia de seguridad» introduce una equivalencia léxica o de dominio. No es la misma operación.

En Q12, «restaurar respaldo», el lookup sigue devolviendo solo D07 dentro de los primeros resultados positivos, aunque las etiquetas consideran relevantes D06 y D07. D06 habla de restauración y copias, pero no comparte los términos necesarios bajo este analyzer.

Podríamos añadir expansión de consultas o sinónimos. Tendríamos que declarar qué se expande, cómo afectan las expresiones de varias palabras y si la expansión se aplica al indexar o al consultar. Modificar la tabla tras observar Q12 y presentar el resultado como una mejora sobre test sería una comparación engañosa.

## Evaluar retrieval no sustituye a evaluar exactitud lingüística

El vocabulario pasa de 237 términos con fold a 228 con lookup. Sus métricas agregadas sobre las nueve consultas test con respuesta coinciden con fold: **Recall@3** de 0,833333 y **MRR@3** de 0,888889.

Esto solo describe esas consultas y ese corpus. No mide qué porcentaje de lemas son correctos en español. Para esa otra pregunta necesitaríamos tokens anotados con sus lemas y, cuando corresponda, contexto y categorías gramaticales.

Tampoco existe una equivalencia obligatoria entre mejor exactitud lingüística y mejor ranking para todas las tareas. Puede que una distinción lingüística correcta no afecte a las consultas del usuario, o que agrupar una forma empeore la precisión de un campo técnico. Los dos niveles se pueden evaluar, pero responden a preguntas diferentes.

## Garantías y límites

La tabla se conserva completa y el resultado se puede auditar token a token. No entrenamos ni descargamos un modelo lingüístico, no afirmamos resolver formas ambiguas y no llamamos general a una cobertura de trece entradas.

## Ejercicio: decidir qué contexto falta

Prueba «fue al servidor» y «fue un error». Explica qué información necesitarías para elegir el lema del verbo en cada frase. Después revisa si esa distinción cambiaría una consulta real de tu buscador. Separa el objetivo lingüístico del objetivo de recuperación antes de añadir un modelo.


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

- [Lemmatizer y modos de funcionamiento, spaCy](https://spacy.io/api/lemmatizer).

Siguiente: [N-grams: recuperar una errata sin llenar el ranking de parecidos](/posts/n-grams-palabras-caracteres-busqueda-errores).
