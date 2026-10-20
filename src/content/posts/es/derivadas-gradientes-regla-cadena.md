---
id: P078
title: 'Derivadas y regla de la cadena: cómo cambia una pérdida al mover un parámetro'
published: 2026-10-18T00:02:00Z
locale: es
translationKey: math-derivatives-chain-rule
slug: derivadas-gradientes-regla-cadena
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P076]
description: 'De la pendiente al gradiente y al Jacobiano: calcula una derivada compuesta y contrástala mediante diferencias finitas.'
author: 'Luis Ramírez Calle'
series: 'Matemáticas y estadística para ingeniería de software'
tags: [matematicas, calculo, gradientes, python]
---

Un modelo predice 6 y el valor esperado era 4. Sabemos calcular su error, pero todavía no sabemos qué cambio en un peso lo reduciría. Probar valores al azar funciona como experimento inicial; la derivada permite formular una pregunta más precisa: ¿cómo cambia la pérdida cerca del valor actual?

Necesitamos conocer [vectores y productos](/posts/vectores-matrices-tensores-similitud). No hace falta memorizar reglas antes de entender qué magnitud describen.

## La derivada describe un cambio local

Para una función de una variable, la razón $(f(x+h)-f(x))/h$ compara cambios en salida y entrada. La **derivative** es el límite de esa razón al hacer $h$ tender a cero, cuando existe.

Eso no significa sustituir $h=0$ en una división. Describe el comportamiento al acercarnos. Para una función diferenciable, $f(x+\Delta x)\approx f(x)+f'(x)\Delta x$ cuando el desplazamiento es suficientemente pequeño.

La palabra «local» importa. Una pendiente favorable no demuestra que un salto grande reduzca la función. Tampoco todas las funciones tienen derivada en todos sus puntos; una esquina necesita otro tratamiento.

## Derivar la pérdida exige seguir todas las dependencias

Usaremos una predicción mínima $u=3w$, un error $e=u-4$ y una pérdida $L=e^2$. Con $w=2$, obtenemos $u=6$, $e=2$ y $L=4$.

La **chain rule** combina los cambios de cada etapa:

$$
\frac{dL}{dw}=\frac{dL}{de}\frac{de}{du}\frac{du}{dw}
=2e\times1\times3=12.
$$

Un fallo frecuente es quedarse en $2e$ y olvidar que el error también cambia cuando cambia $w$. Otra forma de verlo es sustituir primero: $L(w)=(3w-4)^2$ y derivar la expresión completa.

<img src="/assets/visuals/math-series/P078.svg" alt="La cadena w a tres w, error y cuadrado acumula derivadas cuatro por uno por tres; en w igual a dos la derivada total de la pérdida es doce." width="466" height="1159" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/math-series/P078.svg).

## Parciales, gradiente y Jacobiano cambian la forma del resultado

Si $L(w,b)=(3w+b-4)^2$, cada **partial derivative** cambia una variable manteniendo fija la otra. El **gradient** reúne esas parciales: $(6e,2e)$. En $(w,b)=(2,0)$ es $(12,4)$.

El gradiente de una salida escalar tiene una componente por entrada. Para una función con varias salidas, el **Jacobian** reúne las derivadas de cada salida respecto a cada entrada. Una función de $d$ entradas y $k$ salidas tiene Jacobiano $k\times d$ bajo esta convención.

No es una diferencia terminológica menor: multiplicar Jacobianos exige ejes compatibles. Los mismos contratos de dimensiones del primer artículo vuelven a aparecer.

## Una comprobación numérica puede detectar una derivada mal escrita

Las **finite differences** centrales comparan valores a ambos lados de $x$.

Archivo: `mathematics-statistics/foundations.py`, función completa.

```python
def derivative(function, x: float, h: float = 1e-5) -> float:
    if not math.isfinite(h) or h <= 0:
        raise ValueError('h debe ser positivo y finito')
    return (function(x+h)-function(x-h))/(2*h)
```

La prueba aplica esta función a $(3w-4)^2$ en $w=2$ y comprueba un resultado cercano a 12. El archivo de experimentos repite el cálculo con distintos pasos. Con `h=1e-5`, el resultado calculado es aproximadamente 12,00000000026, no una igualdad exacta entre floats.

La implementación completa importa `math`; solo enseñamos aquí la operación que aproxima la derivada. No implementa diferenciación automática ni simbólica.

<img src="/assets/visuals/math-series/derivative-error.svg" alt="Error absoluto al aproximar la derivada del seno en uno con diferentes pasos: reducir demasiado h aumenta cancelación y error de redondeo." width="900" height="460" loading="lazy" style="width:100%;height:auto" />

[Ampliar la gráfica](/assets/visuals/math-series/derivative-error.svg).

## Un paso más pequeño no siempre da una comprobación mejor

La gráfica usa $\sin(x)$ en $x=1$, cuya derivada conocida es $\cos(1)$. Muestra error de aproximación y, con pasos muy pequeños, cancelación y redondeo. La función cuadrática anterior es un caso especial: su diferencia central no tiene el mismo error de truncamiento.

Los [consejos de gradient checking de CS231n](https://cs231n.github.io/neural-networks-3/) explican por qué importa comparar con tolerancias y tener cuidado con puntos no diferenciables. Para entrenar un modelo grande, calcular diferencias por cada parámetro resulta costoso; las usaremos como comprobación, no como motor de entrenamiento.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p078/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/mathematics-statistics
```

## Garantías y límites

[El laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/mathematics-statistics/foundations.py) verifica la derivada de esta función y archiva el barrido de pasos. Una coincidencia numérica no demuestra una fórmula para todas las entradas. Una discrepancia tampoco prueba automáticamente que la derivada analítica esté mal: revisa paso, precisión y diferenciabilidad.

## Ejercicio: comprobar la parcial del bias

Fija $w=2$ y aproxima la derivada respecto a $b$ en cero. Debe acercarse a 4. Después cambia a $b=1$: recalcula el error antes de predecir el resultado. No reutilices una derivada numérica de otro punto como si fuera constante.

El siguiente artículo utiliza el gradiente para [elegir una secuencia de actualizaciones y estudiar cuándo converge](/posts/gradiente-descendente-learning-rate-convergencia).

## Referencias

- [CS231n: gradientes y optimización](https://cs231n.github.io/optimization-1/).
- [CS231n: gradient checking](https://cs231n.github.io/neural-networks-3/).
- [Python: representación de coma flotante](https://docs.python.org/3.12/tutorial/floatingpoint.html).

Fuentes consultadas el 18 de octubre de 2026. Gráfica obtenida de cálculos del laboratorio, no de tiempos de ejecución.
