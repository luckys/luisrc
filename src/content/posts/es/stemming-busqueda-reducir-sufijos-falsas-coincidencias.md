---
id: "NLP-STEMMING"
title: "Stemming: agrupar variantes también puede mezclar palabras distintas"
published: "2026-10-27T11:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-stemming"
slug: "stemming-busqueda-reducir-sufijos-falsas-coincidencias"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-TOKENIZATION"]
description: "Qué gana y pierde una regla que reduce terminaciones. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

«Reintentos» y «reintento» pueden referirse a la misma operación, pero un índice de palabras exactas los trata como términos distintos. Agrupar sus formas facilita algunas búsquedas. Hacerlo sin cuidado también puede convertir «lunes» en «lun».

El **stemming** aplica reglas para reducir formas a una representación compartida, llamada **stem**. Esa representación sirve como clave de búsqueda; no tiene por qué ser una palabra que alguien usaría al escribir.

Venimos de [Tokenización: qué pierde un buscador al decidir dónde empieza una palabra](/posts/tokenizacion-texto-palabras-identificadores-negacion).

## Reducir una terminación es una hipótesis sobre qué formas conviene unir

Un stemmer puede eliminar o sustituir sufijos de acuerdo con reglas del idioma. La familia **Snowball** incluye un algoritmo para español con regiones de la palabra y varias etapas. Su [especificación oficial](https://snowballstem.org/algorithms/spanish/stemmer.html) permite ver por qué un stemmer completo contiene bastante más que una lista de terminaciones.

No necesitamos implementar todo Snowball para entender el trade-off, pero sí distinguir lo que ejecutamos. El laboratorio usa un **reductor didáctico de plurales**, deliberadamente incompleto. Nunca lo presentamos como Snowball ni como un análisis correcto de toda la morfología española.

<img src="/assets/visuals/lexical-search/NLP-STEMMING.svg" alt="Qué gana y pierde una regla que reduce terminaciones. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="484" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Una regla corta muestra el mecanismo y sus fallos

El reductor quita `es` si el token tiene más de cuatro caracteres; si no se aplica esa regla, quita `s` en tokens de más de tres. La prioridad importa: probar primero `s` produciría salidas distintas para algunas palabras.

```javascript
export function pluralStem(token) {
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}
```

La función transforma `reintentos` en `reintento`. En cambio, transforma `lunes` en `lun`, porque una terminación gráfica no basta para decidir si una palabra es un plural que deba reducirse así. La prueba conserva ese contraejemplo de forma explícita.

También podemos dejar relacionadas dos formas de manera inconsistente. La regla convierte `índices` en `índic`, pero no transforma `índice` a la misma cadena. En la variante con fold desaparecen los acentos antes de reducir, sin resolver esa diferencia de terminaciones.

Estos ejemplos permiten distinguir **over-stemming**, unir formas que deberían permanecer separadas, de **under-stemming**, no unir variantes que sí querríamos recuperar juntas. Para demostrar over-stemming hace falta comprobar una colisión concreta entre formas; que `lunes` termine en una cadena extraña ya prueba una reducción lingüísticamente inadecuada, pero no demuestra por sí solo una colisión en nuestro corpus.

## El cambio afecta a documentos y consultas

No basta con reducir el plural de la consulta. Para que `reintentos` y `reintento` coincidan bajo una representación común, indexación y consulta deben usar la misma regla.

Al agrupar formas también cambian **DF** e **IDF**. Si dos entradas antes separadas pasan a un mismo término, su frecuencia documental corresponde a la unión de los documentos donde aparecen. No se suma DF a ciegas: un documento que contiene ambas formas sigue contando una vez.

El índice reconstruido resuelve esto contando cada término analizado una sola vez por documento. Sus frecuencias internas sí suman todas las ocurrencias que hayan convergido en ese término.

## Un vocabulario más pequeño no demuestra una búsqueda mejor

Con fold, la colección contiene 237 términos distintos. Con el reductor pasa a 223. Sin embargo, ambas variantes obtienen el mismo **Recall@3** y **MRR@3** agregados en nuestras nueve consultas test con respuesta.

Hay cambios reales de scores y orden. En Q13, «contraseñas hash», D08 sigue primero, pero D09 y D18 intercambian sus posiciones respecto al analyzer sin reducción. D09 menciona contraseña en singular; al agrupar las formas gana una coincidencia adicional.

Según nuestras etiquetas, solo D08 responde a la intención de guardar contraseñas con hash. Por eso ese cambio de orden no mejora P@3 ni Recall@3. El ejemplo recuerda que cambiar la representación no garantiza que el cambio sea útil para esa necesidad de información.

## Cuándo probar un stemmer completo

Tiene sentido evaluar stemming cuando el corpus contiene muchas variantes flexivas que dificultan recuperar documentos relevantes. Conviene usar una implementación mantenida para el idioma y conservar casos con nombres propios, identificadores y vocabulario especializado.

Un campo técnico puede necesitar una política distinta de la prosa. Reducir el nombre de una librería como si fuera una palabra común puede unir elementos que el usuario quiere diferenciar. Otra alternativa es conservar un campo exacto junto a un campo analizado, con una combinación de scores diseñada y evaluada.

Ese diseño añade complejidad; no lo necesitamos para explicar la regla de esta serie. Tampoco añadimos sinónimos al stemmer: «respaldo» y «copia de seguridad» plantean una relación léxica diferente de quitar un sufijo.

## Garantías y límites

Ejecutamos y comparamos una regla limitada, con sus errores conocidos. No atribuimos al stemming una mejora que no aparece en las métricas ni generalizamos los fallos de nuestra regla a Snowball.

## Ejercicio: construir pares positivos y negativos

Prepara pares de formas que deberían agruparse y pares que deberían seguir separados. Prueba primero la transformación y después el ranking. Si una regla mejora los primeros pero mezcla términos técnicos distintos, conserva ambos resultados para decidir si el intercambio compensa.


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

- [Spanish stemming algorithm, Snowball](https://snowballstem.org/algorithms/spanish/stemmer.html).

Siguiente: [Lemmatization: por qué un diccionario no resuelve toda la morfología](/posts/lemmatization-lookup-contexto-ambiguedad-busqueda).
