---
id: P083
title: 'Experimentos A/B: separar tamaño del efecto, incertidumbre y p-value'
published: 2026-10-18T00:07:00Z
locale: es
translationKey: math-ab-tests-p-values
slug: experimentos-ab-p-value-efecto-potencia
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P082]
description: 'Un experimento exacto pequeño para entender hipótesis nula, p-value, potencia y por qué no basta con cruzar un umbral.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, estadistica, experimentacion, ab-testing]
---

La variante B tiene una media mejor y un p-value superior a 0,05. Una persona concluye que no mejora nada; otra que hay que seguir recogiendo datos hasta que el número baje. Ninguna conclusión se desprende automáticamente del resultado.

Después de [estimar incertidumbre desde muestras](/posts/inferencia-bootstrap-intervalos-confianza), necesitamos relacionar el diseño del experimento, el efecto que queremos detectar y la pregunta que realmente responde un test.

## El diseño precede a la fórmula

Definimos una métrica, una unidad de asignación y una regla para comparar grupos. Si una persona visita varias veces el producto, asignar variante por petición puede mezclar tratamientos y generar dependencia. A veces la unidad adecuada será usuario o grupo.

La asignación aleatoria permite razonar sobre comparaciones bajo un diseño controlado. No repara por sí sola errores de instrumentación, pérdidas diferenciales de observaciones o interferencia entre unidades.

Nuestro laboratorio utiliza seis puntuaciones ficticias: A recibe `[1, 2, 3]` y B `[4, 5, 6]`. Mayor puntuación sería mejor. Las medias son 2 y 5; la diferencia observada **B−A es 3**. La escala es inventada, no una métrica de usuarios reales.

## La hipótesis nula define qué etiquetas podemos intercambiar

Para este experimento de asignación, consideramos la hipótesis de que cambiar la variante no altera el resultado de ninguna unidad. Bajo esa nula y una asignación uniforme de tres unidades a cada grupo, podemos enumerar todas las asignaciones posibles.

Hay $\binom{6}{3}=20$. En cada una calculamos la diferencia de medias. Nuestro **test statistic** es esa diferencia, y definimos «tan extremo» utilizando su valor absoluto para una comparación bilateral.

No estamos suponiendo simplemente que cualquier colección de datos observacionales puede permutarse. La validez depende de la asignación o de los supuestos de intercambiabilidad bajo la nula.

<img src="/assets/visuals/math-series/P083.svg" alt="Un diseño fija la asignación y la métrica; con seis observaciones hay veinte asignaciones de grupos y dos diferencias tan extremas como la observada, dando p-value cero coma uno." width="594" height="982" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P083.svg).

## El p-value calcula un resultado condicionado, no la probabilidad de la nula

Dos de las veinte asignaciones producen una diferencia de magnitud al menos 3. El **p-value** bilateral de este procedimiento exacto es **0,1**.

Archivo: `matematicas-estadistica/foundations.py`, cálculo final de `permutation_mean`.

```python
    extreme = sum(abs(value) >= abs(observed)-1e-12 for value in statistics)
    return dict(effect=observed, p_value=extreme/len(statistics), assignments=len(statistics), statistics=statistics)
```

El módulo contiene la enumeración completa; el límite de dieciséis observaciones evita presentarla como algoritmo escalable. La tolerancia numérica incluye empates que podrían diferir por redondeo.

El 0,1 describe cuán frecuente sería una diferencia así de extrema bajo el procedimiento y la nula. No significa «10 % de probabilidad de que no haya efecto», «90 % de que B gane» ni «el efecto tiene una magnitud de 0,1».

La [declaración de la ASA](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf) advierte contra reducir el razonamiento a cruzar un umbral. Conviene comunicar efecto en sus unidades, incertidumbre y limitaciones del diseño, no solo un semáforo.

## Potencia y tamaño muestral dependen del efecto que importa

Un **type I error** rechaza la nula cuando es cierta. Un **type II error** no la rechaza bajo una alternativa concreta. La **power**, potencia, es la probabilidad de rechazar bajo esa alternativa, no la probabilidad de que una hipótesis sea verdadera.

Planificar tamaño muestral exige elegir un efecto mínimo relevante, variabilidad esperada, nivel de error y potencia deseada, además del diseño. No existe un «n suficiente» independiente de esos elementos.

Con seis unidades, que una diferencia observada sea grande no implica un p-value pequeño. Tampoco un resultado no significativo demuestra equivalencia: para sostener que dos opciones difieren menos que un margen habría que diseñar esa pregunta explícitamente.

## Mirar muchas veces también modifica el procedimiento

Si probamos muchas métricas y comunicamos solo la que cruza 0,05, hemos seleccionado una excepción. El mismo problema aparece al detener un test fijo justo en la primera lectura favorable.

Predefine métricas, duración o reglas de parada. Si necesitas observar continuamente, utiliza un diseño secuencial apropiado. Para múltiples comparaciones, el ajuste depende del objetivo de control de errores. No implementamos aquí esos procedimientos ni simulamos su potencia.

## Garantías y límites

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) enumera las veinte asignaciones y verifica efecto y p-value conocidos. No es un cálculo de tamaño muestral, un test de producción o una estimación causal válida para cualquier dato recogido sin aleatorización.

La [API de permutaciones de SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.permutation_test.html) distingue tipos de permutación y alternativas. Elegir una función no sustituye decidir qué aleatorización refleja tu experimento.

## Ejercicio: el mismo efecto en otra escala

Multiplica todas las puntuaciones por diez. La diferencia debe pasar de 3 a 30 y este p-value exacto debe mantenerse. Explica por qué ha cambiado la unidad del efecto sin cambiar el orden relativo de las asignaciones extremas.

Seguimos con [cómo puntuar predicciones probabilísticas antes de convertirlas en etiquetas](/posts/entropia-cross-entropy-kl-logits).

## Referencias

- [ASA: principios sobre p-values](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf).
- [SciPy: permutation_test](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.permutation_test.html).

Fuentes consultadas el 18 de octubre de 2026. Experimento sintético exacto, sin usuarios reales.
