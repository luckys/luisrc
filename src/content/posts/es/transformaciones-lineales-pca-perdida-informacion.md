---
id: P077
title: 'Transformaciones y PCA: reducir dimensiones sin confundir varianza con utilidad'
published: 2026-10-18T00:01:00Z
locale: es
translationKey: math-transformations-pca
slug: transformaciones-lineales-pca-perdida-informacion
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P076]
description: 'Transformaciones lineales, autovectores, SVD y PCA mediante una reducción reproducible de tres dimensiones a dos.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, pca, algebra-lineal, machine-learning]
---

Reducimos un dataset a dos dimensiones y conservamos más del 99 % de su varianza. La gráfica queda limpia, pero esa cifra no nos dice si hemos conservado la feature que distingue los casos importantes.

**PCA** ayuda a encontrar una representación de menor dimensión. Para utilizarla con criterio necesitamos entender una proyección y saber interpretar la información que descarta. Partimos de los [vectores, productos y shapes](/posts/vectores-matrices-tensores-similitud).

## Una transformación cambia vectores siguiendo una regla

Un **linear map** satisface $T(ax+by)=aT(x)+bT(y)$. Una matriz permite expresarlo en coordenadas. Rotaciones, escalados y proyecciones lineales son ejemplos; sumar una traslación fija no es lineal, porque deja de enviar cero a cero.

Un **cambio de base** describe el mismo vector utilizando otros ejes. Si conservamos una base completa e invertible, no hemos reducido la información. Proyectar de tres ejes a dos es distinto: ya no podremos recuperar cualquier vector original.

Un **eigenvector**, o autovector, de una matriz mantiene su dirección al transformarse: $Cv=\lambda v$. El **eigenvalue** $\lambda$ indica el factor aplicado en esa dirección. No todas las matrices tienen una base real ortonormal de autovectores; la covarianza simétrica de PCA sí permite ese análisis.

## PCA busca direcciones de variación después de centrar

Restamos la media de cada feature y obtenemos $X_c$. Con observaciones en filas, la covarianza muestral es:

$$
C=\frac{X_c^T X_c}{n-1}.
$$

El centrado importa: queremos estudiar variación alrededor del centro, no elegir ejes porque los valores tienen un offset grande. Los autovectores de $C$ proporcionan las direcciones principales, ordenadas por sus autovalores.

Archivo: `matematicas-estadistica/foundations.py`, extracto de `pca` tras construir los datos centrados.

```python
    columns = [list(column) for column in zip(*centered)]
    covariance = [[dot(a, b)/(n-1) for b in columns] for a in columns]
    values, vectors = symmetric_eigen(covariance)
```

El eigensolver didáctico usa rotaciones de Jacobi y admite solo matrices 2×2 o 3×3. El archivo completo contiene la implementación, el orden de componentes y la reconstrucción. No lo presentamos como solución para grandes matrices o datos mal condicionados.

<img src="/assets/visuals/math-series/P077.svg" alt="Seis observaciones de tres features se centran, se calcula su covarianza y se proyectan sobre dos componentes; conservar 99,05 por ciento de varianza todavía pierde el eje z." width="549" height="934" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P077.svg).

## Seis puntos permiten ver exactamente qué desaparece

El experimento utiliza $(3,3,0)$, $(-3,-3,0)$, $(2,-2,0)$, $(-2,2,0)$, $(0,0,0.5)$ y $(0,0,-0.5)$. Son datos ficticios, con centro cero.

Sus autovalores calculados son **7,2**, **3,2** y **0,1**. Elegir dos componentes conserva $(7.2+3.2)/10.5$, aproximadamente **99,05 %** de la varianza. La dirección descartada es el eje $z$.

Los dos últimos puntos terminan en el mismo lugar proyectado. Si una etiqueta dependiera del signo de $z$, habríamos borrado precisamente esa diferencia. Mucha varianza retenida no garantiza utilidad predictiva: PCA no mira las etiquetas.

Al reconstruir las seis observaciones, el error cuadrático total es **0,5**. Coincide con $(n-1)$ multiplicado por el autovalor descartado en este ejemplo. La prueba comprueba ese valor, la ortogonalidad y la norma de los componentes.

El signo de un componente puede invertirse sin cambiar la proyección como subespacio. Por eso no comprobaría un eigensolver exigiendo un signo arbitrario; comprobaría sus propiedades y la reconstrucción.

## SVD permite obtener la misma estructura sin formar la covarianza

Una **singular value decomposition** expresa $X_c=U\Sigma V^T$. Las columnas de $V$ describen direcciones principales y los cuadrados de los valores singulares, divididos por $n-1$, corresponden a varianzas.

Formar $X_c^T X_c$ puede empeorar el condicionamiento numérico. Para trabajo real preferiría una implementación de biblioteca y elegiría el solver según tamaño y precisión. La [documentación de PCA de scikit-learn](https://scikit-learn.org/stable/modules/decomposition.html#pca) explica su uso de SVD y las decisiones de escalado.

Centrar no equivale a estandarizar. Si una feature cambia de unidad, su varianza cambia y puede dominar la elección. Escalar todas las columnas a varianza uno es otra decisión, no un paso siempre correcto.

## Garantías y límites

[El laboratorio](/assets/examples/matematicas-estadistica-lab.zip) ejecuta una reducción real 3D→2D con reconstrucción. No implementa SVD, whitening o selección de componentes por validación predictiva.

PCA puede ayudar a explorar, comprimir o eliminar redundancia lineal. No demuestra que dos puntos próximos tengan la misma clase, ni preserva todas las relaciones de una estructura no lineal. Ajusta el centrado y los componentes solo con datos de entrenamiento para no filtrar información de evaluación.

## Ejercicio: poca varianza, mucha importancia

Etiqueta los dos puntos del eje $z$ según su signo. Comprueba que su proyección 2D coincide y explica por qué no puedes reconstruir esa etiqueta solo con las coordenadas proyectadas. El criterio no es subir el porcentaje retenido, sino identificar qué información necesita la tarea.

Seguimos con [cómo calcular el efecto de cambiar un parámetro](/posts/derivadas-gradientes-regla-cadena).

## Referencias

- [scikit-learn: PCA y SVD](https://scikit-learn.org/stable/modules/decomposition.html#pca).
- [MIT: materiales de álgebra lineal](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/).

Fuentes consultadas el 18 de octubre de 2026. Los porcentajes describen exclusivamente los seis puntos del experimento.
