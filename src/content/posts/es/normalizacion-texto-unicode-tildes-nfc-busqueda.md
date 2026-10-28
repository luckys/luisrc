---
id: "NLP-NORMALIZATION"
title: "Normalizar texto sin borrar diferencias que importan"
published: "2026-10-27T09:00:00Z"
locale: "es"
translationKey: "lexical-search-nlp-normalization"
slug: "normalizacion-texto-unicode-tildes-nfc-busqueda"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P106"]
description: "Qué equivalencias crea la normalización y cómo conservar el original. Ejemplos ejecutados, decisiones y límites de un buscador léxico."
author: "Luis Ramírez Calle"
series: "Búsqueda de texto: del corpus a BM25 y subwords"
tags: ["nlp", "search", "algorithms", "text-processing"]
---

«ÍNDICE» y «índice» deberían encontrar la misma nota en muchos buscadores. «Año» y «ano» plantean una decisión distinta. Aplicar indiscriminadamente la misma transformación a ambos casos puede borrar una diferencia que el usuario sí necesita.

La **normalización** define qué variantes trataremos como equivalentes al buscar. Conviene formular esas equivalencias como reglas de producto y probarlas con ejemplos, en lugar de llamar limpieza a cualquier cambio del texto.

Venimos de [Corpus de búsqueda: decidir qué documento responde a una consulta](/posts/corpus-busqueda-lexica-documentos-consultas-relevancia).

## NFC resuelve una equivalencia de representación

Unicode permite representar ciertas letras acentuadas de varias formas. `í` puede ser un carácter precompuesto o una `i` seguida de una marca de acento. Las cadenas pueden verse iguales y contener secuencias distintas de puntos de código.

**NFC** lleva las representaciones canónicamente equivalentes a una forma normalizada compuesta cuando existe. No traduce palabras, no corrige erratas y no elimina por sí sola las tildes. Las formas de normalización están definidas en [Unicode UAX #15](https://www.unicode.org/reports/tr15/).

Otra forma, **NFKC**, incorpora equivalencias de compatibilidad. Puede resultar útil en determinadas búsquedas, pero no es una alternativa intercambiable que debamos activar sin revisar los caracteres del dominio. En este laboratorio elegimos NFC y dejamos esa política explícita.

<img src="/assets/visuals/lexical-search/NLP-NORMALIZATION.svg" alt="Qué equivalencias crea la normalización y cómo conservar el original. El recorrido muestra las decisiones concretas del corpus y del algoritmo del laboratorio." width="551" height="937" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Lowercase y accent folding son decisiones adicionales

Después de NFC aplicamos lowercase con locale español. Así, `ÍNDICE` e `índice` producen la misma forma. No afirmamos que esta política sea adecuada para cualquier idioma ni que equivalga a todas las formas de Unicode case folding.

La variante **fold** añade una tabla pequeña: `áéíóúü` pasa a `aeiouu`. La `ñ` se conserva. No implementamos la receta de descomponer y borrar todas las marcas combinantes, porque eso también podría eliminar la virgulilla y confundir `año` con `ano`.

El código de `analysis.mjs` recibe la opción de forma explícita:

```javascript
export function normalize(text, {fold = false} = {}) {
  const canonical = text.normalize('NFC').toLocaleLowerCase('es');
  return fold ? canonical.replace(/[áéíóúü]/gu, c => accentMap[c]) : canonical;
}
```

`accentMap` es la tabla anterior. El texto original permanece en el corpus; esta función devuelve una nueva cadena para indexar o analizar una consulta. Podemos mostrar «Índices B-tree» al lector aunque el índice contenga `indices` y `b`.

Una prueba comprueba que `I` más acento combinante, seguido de `NDICE`, produce `índice`. Otra comprueba que aplicar fold dos veces da el mismo resultado que una: esta política es **idempotente**. Son propiedades concretas, no una prueba de que cualquier normalización sea lingüísticamente correcta.

## Una coincidencia nueva no siempre corrige toda la consulta

En Q10, «anios retencion», el buscador literal no encuentra ningún documento. Con fold recupera D20, «Año de retención», en primera posición. Su score BM25 es aproximadamente 3,408851.

La explicación por término revela algo fácil de pasar por alto: la coincidencia procede de `retencion`, no de `anios`. No hemos corregido `anios` a `año`. La tilde de «retención» dejó de impedir esa otra coincidencia.

Esta distinción importa al revisar resultados. Ver el documento esperado en primera posición no demuestra que el buscador entienda cada palabra de la consulta. Podría estar acertando gracias a una sola pista que desaparezca en otra pregunta.

## El analyzer debe ser coherente entre indexación y consulta

Si indexamos `índice` sin fold y después transformamos la consulta a `indice`, las dos representaciones pueden no encontrarse. La misma política debe aplicarse a ambos lados, salvo que diseñemos deliberadamente analyzers distintos compatibles entre sí.

Cambiar la política exige revisar el índice existente. No basta con desplegar una función nueva para las consultas: las claves antiguas ya están almacenadas. En nuestro laboratorio reconstruimos el índice para cada variante, de modo que la comparación no mezcle decisiones de versiones distintas.

También cambian las estadísticas. La colección literal tiene 238 términos distintos; fold tiene 237. Eliminar una diferencia puede unir entradas y modificar **DF** e **IDF**. Reducir el vocabulario no es una medida de calidad por sí misma.

<img src="/assets/interactive/lexical-search/vocabulary.svg" alt="Términos distintos por analyzer: 238 literal, 237 fold, 223 plural, 228 lookup y 598 trigramas. Recuento del corpus completo; no mide calidad ni latencia." width="380" height="310" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Conservar el original evita problemas al mostrar coincidencias

Las posiciones de caracteres de una cadena transformada no tienen por qué coincidir con las del original. Componer caracteres o expandir una representación puede cambiar longitudes y offsets.

Este buscador no implementa resaltado de spans ni utiliza offsets normalizados para cortar el texto original. Si añadimos highlighting, tendremos que conservar una correspondencia entre ambas representaciones o usar un analizador que la proporcione. Reconstruirla a partir de la apariencia visual es frágil.

Tampoco usamos normalización como control de seguridad. Que dos cadenas se busquen de la misma manera no decide si un identificador es válido, si un usuario tiene permiso o si una URL es segura. Esas comprobaciones pertenecen a sus propios contratos.

## Garantías y límites

La política se prueba para los casos declarados y conserva `ñ`. No es un corrector ortográfico, una transliteración general ni un sistema de equivalencias entre todos los idiomas. Se guarda el original y se versiona el procesamiento.

## Ejercicio: separar equivalencia visual y equivalencia de búsqueda

Prepara pares como `índice/indice`, `año/ano` y un identificador cuyo caso importe. Decide cuáles deberían encontrar lo mismo. Escribe esa tabla antes de cambiar el analyzer y comprueba después tanto las coincidencias nuevas como las distinciones perdidas.


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

- [Unicode Standard Annex #15: Unicode Normalization Forms](https://www.unicode.org/reports/tr15/).

Siguiente: [Tokenización: qué pierde un buscador al decidir dónde empieza una palabra](/posts/tokenizacion-texto-palabras-identificadores-negacion).
