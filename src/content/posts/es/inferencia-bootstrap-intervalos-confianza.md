---
id: P082
title: 'Inferencia y bootstrap: cuánto puedes concluir a partir de una muestra'
published: 2026-10-18T00:06:00Z
locale: es
translationKey: math-inference-bootstrap
slug: inferencia-bootstrap-intervalos-confianza
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P080, P081]
description: 'Población, sesgo, error estándar, CLT e intervalos bootstrap sin convertir una muestra limitada en certeza.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, estadistica, inferencia, bootstrap]
---

Un clasificador acierta 155 de 200 ejemplos y comunicamos «accuracy del 77,5 %». Esa cifra describe la muestra evaluada. No dice por sí sola cuánto cambiaría el resultado con otra muestra ni si esos ejemplos representan a los usuarios que nos importan.

Después de [describir una distribución](/posts/distribuciones-media-percentiles-latencia), necesitamos distinguir variación de los datos, incertidumbre del estimador y sesgo de selección. Aumentar el número de réplicas de un cálculo solo aborda una parte de ese problema.

## Generalizar exige definir primero la población

La **population** es el conjunto objetivo; la **sample** es lo observado. Un **estimator** es una regla, como promediar aciertos; la estimación es el valor obtenido al aplicarla a una muestra concreta.

Si evaluamos solo casos fáciles, podemos obtener una cifra muy precisa sobre la población equivocada. El **bias** de selección no desaparece por ejecutar más veces la misma operación sobre esos datos.

También importa la unidad: 200 mensajes de cinco personas no equivalen necesariamente a 200 personas independientes. Una dependencia fuerte puede hacer que tratarlos como 200 observaciones independientes infravalore la incertidumbre.

## Error estándar no es desviación de las observaciones

La **standard deviation** describe dispersión entre observaciones. El **standard error** describe variación del estimador al repetir el muestreo bajo un modelo.

Para la media de observaciones independientes de la misma distribución y con varianza finita, su varianza es $\sigma^2/n$. Una estimación habitual del error estándar es $s/\sqrt{n}$. La unidad vuelve a ser la de la variable, pero el objeto que describe es otro.

El **central limit theorem**, o **CLT**, justifica una aproximación normal de la media estandarizada bajo condiciones como independencia y varianza finita. No afirma que la distribución original se vuelva normal ni que cualquier muestra de treinta elementos baste. El [capítulo de ProbabilityCourse](https://www.probabilitycourse.com/chapter7/7_1_2_central_limit_theorem.php) formula una versión para variables iid.

## Bootstrap utiliza la muestra como aproximación de la población

El **bootstrap** genera nuevas muestras con reemplazo desde la muestra original. Calculamos el estimador en cada réplica y observamos cómo varía. No aparecen observaciones genuinamente nuevas.

Para accuracy, codificamos cada predicción como 1 si acertó y 0 si falló. La media es la proporción de aciertos. Este es el núcleo del intervalo **percentile bootstrap**.

Archivo: `matematicas-estadistica/foundations.py`, función completa.

```python
def bootstrap_mean(values: list[float], repetitions: int = 2000, seed: int = 17) -> list[float]:
    if not values or repetitions < 2:
        raise ValueError('muestra vacía o pocas réplicas')
    rng = random.Random(seed)
    estimates = [fmean(rng.choices(values, k=len(values))) for _ in range(repetitions)]
    return [quantile(estimates, .025), quantile(estimates, .975)]
```

El módulo importa `random` y `fmean`, y define `quantile` con la convención del artículo anterior. Un generador local evita que otras operaciones aleatorias cambien silenciosamente estas réplicas.

<img src="/assets/visuals/math-series/P082.svg" alt="Una muestra de doscientos resultados con accuracy cero coma setecientos setenta y cinco genera dos mil réplicas bootstrap; el intervalo no corrige selección ni dependencia." width="627" height="1006" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P082.svg).

## El intervalo calculado no tiene una interpretación bayesiana automática

En la ejecución archivada, la accuracy observada es **0,775**, el error estándar estimado bajo independencia es aproximadamente **0,0296** y el intervalo percentile nominal del 95 % es **[0,715, 0,830]**. Se usaron 2.000 réplicas y semilla 17 sobre datos binarios sintéticos.

La interpretación frecuentista de un **confidence interval** describe el procedimiento: al repetir adecuadamente muestreo y construcción, buscamos una cobertura cercana al nivel anunciado. No significa que un parámetro fijo tenga un 95 % de probabilidad posterior de estar en este intervalo concreto. [NIST explica esa interpretación de cobertura](https://www.itl.nist.gov/div898/handbook/prc/section1/prc14.htm).

La cobertura nominal no está garantizada para cualquier bootstrap, tamaño muestral o distribución. Un intervalo de confianza de una media tampoco es un intervalo de predicción para la próxima observación individual.

## Una muestra sin fallos puede producir una falsa sensación de certeza

El test incluye diez unos. Todas sus réplicas siguen siendo diez unos y el intervalo percentile devuelve `[1, 1]`. El programa ha hecho exactamente lo especificado; la conclusión «el modelo jamás falla» seguiría siendo injustificada.

Este caso muestra por qué no basta con envolver cualquier estimador en bootstrap. Para proporciones pequeñas o extremas evaluaría métodos específicos, como intervalos binomiales adecuados. Para grupos dependientes, el remuestreo debería respetar esa estructura, por ejemplo a nivel de usuario.

**SciPy** ofrece [otros métodos bootstrap, incluido BCa](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html). Cambiar de método puede abordar ciertos defectos del intervalo, no recuperar grupos que nunca entraron en la muestra.

## Garantías y límites

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) comprueba reproducibilidad, el caso degenerado y el cálculo de cuantiles. No demuestra cobertura mediante muestreo repetido de muchas poblaciones ni estima incertidumbre del entrenamiento completo: el clasificador de este ejemplo ni siquiera se entrena.

Ejecuta `python3 -m unittest discover -s tests -v`. La semilla reproduce el experimento; no certifica que los supuestos sean correctos.

## Ejercicio: identificar la unidad de remuestreo

Imagina veinte usuarios con diez predicciones cada uno. Diseña un bootstrap que remuestree usuarios completos y conserve sus diez resultados. Explica qué dependencia intenta respetar y por qué no puedes asumir que su intervalo será siempre más ancho en cualquier realización.

La siguiente lectura utiliza una asignación controlada para [comparar alternativas sin confundir efecto y significación](/posts/experimentos-ab-p-value-efecto-potencia).

## Referencias

- [NIST: confidence intervals](https://www.itl.nist.gov/div898/handbook/prc/section1/prc14.htm).
- [ProbabilityCourse: CLT](https://www.probabilitycourse.com/chapter7/7_1_2_central_limit_theorem.php).
- [SciPy: bootstrap](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html).

Fuentes consultadas el 18 de octubre de 2026. El intervalo corresponde solo al ejemplo sintético archivado.
