---
id: P076
title: 'Vectores, matrices y tensores: qué significan las dimensiones de tus datos'
published: 2026-10-18T00:00:00Z
locale: es
translationKey: math-vectors-matrices-tensors
slug: vectores-matrices-tensores-similitud
draft: true
status: draft
math: true
level: intermedio
prerequisites: []
description: 'Dimensiones, productos, normas y similitud: interpreta las operaciones antes de trasladarlas a una biblioteca de Machine Learning.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, algebra-lineal, python, machine-learning]
---

Dos vectores apuntan en la misma dirección, pero uno es diez veces más largo. Un buscador que compara su producto escalar puede tratarlos de forma distinta a otro que compara el coseno. Antes de discutir qué métrica es mejor, hay que entender qué está midiendo cada una.

Esta serie recupera las matemáticas necesarias para razonar sobre datos, modelos e incertidumbre. No exige haber leído los artículos de frontend: empezamos por coordenadas y operaciones, con **Python** y su biblioteca estándar para que el mecanismo quede visible.

## Las dimensiones describen el contrato de una operación

Un **scalar** es un número. Un **vector** reúne coordenadas ordenadas. Una **matrix** organiza valores en dos ejes. En bibliotecas de ML, **tensor** suele referirse a un array de varios ejes: un lote de imágenes puede tener shape `(batch, height, width, channels)`.

Que dos arrays tengan el mismo número total de valores no significa que sus ejes sean intercambiables. Una imagen de alto 20 y ancho 30 no representa lo mismo al interpretar su memoria como alto 30 y ancho 20.

Para una tabla de datos usaremos filas como observaciones y columnas como **features**. Si $X$ tiene shape $(n,d)$ y $W$ tiene shape $(d,k)$, el producto $XW$ tiene shape $(n,k)$. Se contrae el eje compartido $d$: cada resultado combina las mismas features con unos pesos.

Una solución ingenua usa `zip` sin comprobar longitudes. Python dejaría de iterar al terminar la entrada más corta y podría ocultar un error de dimensiones.

Archivo: `matematicas-estadistica/foundations.py`, función completa; `math` se importa al inicio del módulo.

```python
def dot(a: list[float], b: list[float]) -> float:
    if not a or len(a) != len(b):
        raise ValueError('dimensiones incompatibles')
    return math.fsum(x*y for x, y in zip(a, b))
```

La validación expresa un contrato sencillo: queremos vectores no vacíos de la misma dimensión. `fsum` mejora la acumulación de sumas de floats, pero no convierte los números aproximados en aritmética exacta.

## El producto escalar combina magnitud y dirección

Para $a=(1,2)$ y $b=(10,20)$:

$$
a\cdot b = 1\times10+2\times20=50.
$$

El resultado es un scalar. En un modelo lineal, cada feature se multiplica por su peso y las contribuciones se suman. En un producto matricial hacemos esa operación entre cada fila de la primera matriz y cada columna de la segunda.

El laboratorio incluye `matmul` y rechaza matrices irregulares o ejes incompatibles. No hacemos broadcasting implícito: añadirlo ahora escondería parte del contrato que estamos aprendiendo.

<img src="/assets/visuals/math-series/P076.svg" alt="Los vectores uno dos y diez veinte comparten dirección; su producto escalar es 50, su coseno aproximadamente uno y su distancia aproximadamente 20,12." width="1181" height="628" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P076.svg).

## Norma, distancia y coseno responden preguntas diferentes

La **Euclidean norm** mide longitud: $\lVert a\rVert_2=\sqrt{a\cdot a}$. La distancia euclídea entre dos puntos es $\lVert a-b\rVert_2$; tiene en cuenta dónde están, no solo hacia dónde apuntan.

La **cosine similarity** divide el producto escalar por las normas:

$$
\cos(a,b)=\frac{a\cdot b}{\lVert a\rVert_2\lVert b\rVert_2}.
$$

En nuestro ejemplo es aproximadamente 1, mientras que la distancia es aproximadamente 20,12. No hay contradicción: los vectores tienen la misma dirección y distinta magnitud.

Para un vector cero, la dirección no está definida y esta fórmula divide por cero. El laboratorio rechaza el caso en vez de inventar una similitud. La prueba también verifica vectores perpendiculares, cuyo coseno es cero.

## La escala de las features también es una decisión

Si una coordenada representa euros y otra milisegundos, una distancia mezcla sus escalas numéricas. Cambiar euros por céntimos puede alterar el ranking sin cambiar el fenómeno que describimos.

Normalizar o estandarizar puede ser adecuado, pero depende del significado de los datos. Tampoco todas las magnitudes son ruido: a veces el tamaño de un vector contiene información útil. Elegir coseno por costumbre puede eliminarla.

Con **embeddings**, una similitud alta no demuestra equivalencia semántica ni verdad. Es una comparación dentro de la representación aprendida por un modelo. Aquí utilizamos coordenadas inventadas; no evaluamos ningún modelo de embeddings.

El [capítulo de álgebra lineal de Deep Learning](https://www.deeplearningbook.org/contents/linear_algebra.html) sirve como referencia de notación. Para practicar los espacios y productos, el [curso de Gilbert Strang en MIT](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) ofrece un recorrido más amplio.

## Garantías y límites

[Descarga el laboratorio](/assets/examples/matematicas-estadistica-lab.zip). Desde `matematicas-estadistica/`:

```bash
python3 -m unittest discover -s tests -v
python3 experiments.py
```

No necesita instalaciones. Las pruebas comprueban productos, dimensiones y casos límite pequeños. No es un motor de tensores, no usa GPU y no garantiza estabilidad con magnitudes extremas. Para cálculo a escala usaríamos una biblioteca numérica, conservando estos contratos.

## Ejercicio: mismo ángulo, distinto punto

Sustituye $b$ por $(100,200)$. El coseno debe seguir cerca de 1 y la distancia debe crecer. Después usa $(-1,-2)$: el coseno debe ser aproximadamente -1. Escribe las expectativas antes de ejecutar el cálculo.

El siguiente artículo explica [qué se conserva y qué se pierde al proyectar datos sobre menos ejes](/posts/transformaciones-lineales-pca-perdida-informacion).

## Referencias

- [Deep Learning: álgebra lineal](https://www.deeplearningbook.org/contents/linear_algebra.html).
- [MIT OpenCourseWare: Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/).
- [Python 3.12: funciones matemáticas](https://docs.python.org/3.12/library/math.html).

Fuentes consultadas el 18 de octubre de 2026. Cálculos ejecutados con Python 3.12.3.
