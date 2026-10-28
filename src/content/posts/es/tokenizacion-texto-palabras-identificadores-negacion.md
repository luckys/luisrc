---
id: "NLP-TOKENIZATION"
title: "Tokenización: qué pierde un buscador al decidir dónde empieza una palabra"
published: "2026-10-27T10:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-tokenization"
slug: "tokenizacion-texto-palabras-identificadores-negacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["NLP-NORMALIZATION"]
description: "Cómo los límites de token cambian vocabulario y coincidencias. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

Un buscador puede convertir `C++` y `C#` en el mismo token: `c`. Después podrá calcular perfectamente las frecuencias y seguir devolviendo resultados que mezclan dos lenguajes distintos.

La **tokenización** decide qué unidades entran en el índice. Si esa decisión pierde una distinción necesaria, el algoritmo de ranking no podrá recuperarla mirando únicamente los tokens que recibió.

Venimos de [Normalizar texto sin borrar diferencias que importan](/posts/normalizacion-texto-unicode-tildes-nfc-busqueda).

## Un token es una ocurrencia; un término es una entrada del vocabulario

Al analizar «hash hash contraseña» obtenemos tres ocurrencias de tokens y dos términos distintos. La frecuencia de `hash` en ese documento es dos; su presencia en el vocabulario ocupa una entrada.

No necesitamos que cada término sea una palabra de diccionario. Un identificador técnico, una secuencia de caracteres o una subword también pueden ser unidades de representación. Lo importante es conocer la regla y aplicarla de forma coherente.

En esta colección pequeña elegimos secuencias de letras, marcas combinantes y números Unicode. Los demás caracteres delimitan tokens. Es una regla reproducible para estudiar sus consecuencias, no un tokenizer universal para cualquier documento.

<img src="/assets/visuals/lexical-search/NLP-TOKENIZATION.svg" alt="Cómo los límites de token cambian vocabulario y coincidencias. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="486" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La regex evita un problema de ASCII, pero no resuelve todos los idiomas

Usar solo `[a-z]+` excluiría letras presentes en español y en muchos otros idiomas. Nuestra expresión usa categorías Unicode: **L** para letras, **M** para marcas y **N** para números.

El fragmento de `analysis.mjs` normaliza primero y después obtiene esas secuencias:

```javascript
export function tokenize(text, options = {}) {
  return normalize(text, options).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}
```

La opción `u` activa el modo Unicode de la expresión. Si no hay ninguna coincidencia, devolvemos una lista vacía. No inventamos un token vacío que pudiera aparecer en todos los documentos.

Esto sigue sin resolver segmentación lingüística en idiomas que no separan palabras mediante espacios ni puntuación. Una secuencia larga de letras puede convertirse en un solo token aunque una persona distinga varias palabras. Allí hace falta una política de segmentación adecuada al idioma, no añadir más caracteres a la regex y dar el problema por cerrado.

## Los ejemplos técnicos descubren pérdidas que una frase normal no muestra

La entrada `C++ C# Node.js sin secretos` produce exactamente:

```text
c, c, node, js, sin, secretos
```

Los signos de los dos primeros lenguajes desaparecen. El punto de `Node.js` divide el identificador en dos unidades. Un correo electrónico o una versión como `2.14.0` tendría pérdidas parecidas de estructura.

En un buscador de documentación técnica podríamos añadir un campo de identificadores, preservar ciertos símbolos o utilizar reglas específicas antes de la segmentación general. Cada alternativa implica más casos que probar: conservar toda la puntuación también puede impedir que palabras iguales coincidan cuando una termina en coma y otra no.

En esta serie mantenemos la regla simple para que el fallo se vea y quede cubierto por una prueba. No corregimos el test para ocultar que ambos lenguajes terminan en `c`.

## No eliminamos stopwords porque queremos observar la negación

Las **stopwords** son palabras que un pipeline decide omitir, a menudo por ser frecuentes. No existe una lista universalmente correcta para todos los productos.

Si eliminamos `sin` de «logs sin secretos», queda una bolsa de términos mucho más parecida a «logs con secretos». Por eso aquí no quitamos stopwords. El peso de una palabra frecuente se ajustará mediante estadísticas del corpus.

Conservar `sin` no significa comprender la negación. En Q18, D18, la guía preventiva, aparece primero; D19, un incidente donde sí se filtraron secretos, aparece segundo. El buscador mantiene una pista útil, pero la suma de coincidencias no representa por sí sola la relación «evitar que ocurra».

## Una bolsa de palabras pierde el orden aunque conserve todos los tokens

El índice guarda counts por documento. No conserva posiciones. «El proceso cancela la tarea» y «la tarea cancela el proceso» pueden compartir los mismos términos y frecuencias a pesar de expresar acciones distintas.

Para búsquedas de frases necesitaríamos información adicional. Los **word n-grams** guardan secuencias cortas; un índice posicional permite consultar relaciones entre posiciones. Son opciones con costes y comportamiento diferentes, que no se obtienen activando BM25.

La longitud que usaremos en BM25 es el número de tokens después del analyzer. No es el número de bytes del archivo ni el número de caracteres que ve el lector. Si cambiamos tokenización, también cambia esa longitud y la media del corpus.

## Garantías y límites

La prueba conserva la salida exacta para símbolos, negación y caracteres españoles. No implementamos un parser de código, tokenización multilingüe completa ni posiciones para frases. Una configuración puede ser correcta para notas breves y quedarse corta en documentación de APIs.

## Ejercicio: probar los nombres que realmente busca tu equipo

Reúne nombres de lenguajes, errores, versiones, clases y funciones. Anótalos junto a la secuencia de tokens esperada. Incluye un par que no deba acabar en la misma representación. Esa tabla ofrece una revisión más útil que probar únicamente «hola mundo».


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

- [Normalización y pre-tokenización, Hugging Face](https://huggingface.co/learn/llm-course/en/chapter6/4).

Siguiente: [Stemming: agrupar variantes también puede mezclar palabras distintas](/posts/stemming-busqueda-reducir-sufijos-falsas-coincidencias).
