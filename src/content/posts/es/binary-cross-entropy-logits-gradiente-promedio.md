---
id: "DL-LOSS-GRADIENT"
title: "Binary cross entropy: de dónde sale el gradiente p menos y"
published: "2026-10-25T19:01:00Z"
locale: "es"
translationKey: "autodiff-foundations-dl-loss-gradient"
slug: "binary-cross-entropy-logits-gradiente-promedio"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P097", "P084"]
description: "Cómo derivar BCE desde logits y aplicar una sola vez el promedio del batch. Deducción, ejemplos ejecutados y límites explícitos."
author: "Luis Ramírez Calle"
series: "Cómo se calcula un gradiente: forward, backward y autodiff"
tags: ["deep-learning", "autodiff", "pytorch", "numpy"]
---

En muchos ejemplos de redes aparece una línea parecida a `dz = prediction - target`. Copiarla sin conocer la loss y su reducción puede producir un gradiente incorrecto que, aun así, tenga la shape esperada.

Después de [seguir los caminos del grafo](/posts/computational-graph-regla-cadena-caminos), vamos a deducir el gradiente de **binary cross entropy desde logits**. La fórmula tiene una explicación concreta y un alcance: depende de cómo construimos la probabilidad, de la pérdida y de si sumamos o promediamos muestras.

## El logit y la probabilidad son valores distintos

La MLP produce un logit z, que puede ser cualquier número real. Para clasificación binaria proponemos `p = sigmoid(z)` y un target y que vale 0 o 1.

La pérdida de una muestra es `ℓ = −y log(p) − (1−y) log(1−p)`. Usamos logaritmos naturales, así que se expresa en nats. Penaliza asignar baja probabilidad a la etiqueta observada.

Al sustituir sigmoid y reorganizar, obtenemos la expresión equivalente `ℓ(z,y) = log(1+exp(z)) − yz`. En el código usamos `logaddexp(0,z)` para evaluar de forma estable esa primera parte, como vimos en [activations y estabilidad](/posts/activations-tanh-sigmoid-relu-no-linealidad).

## La derivada de la loss por logit ya incluye la sigmoid

La derivada de `log(1+exp(z))` es `exp(z)/(1+exp(z))`, que coincide con sigmoid(z). La de yz respecto a z es y, porque el target se trata como constante. Por tanto:

`dℓ/dz = sigmoid(z) − y = p − y`

También podríamos derivar primero respecto a p. En ese recorrido aparece `dℓ/dp = −y/p + (1−y)/(1−p)` y después se multiplica por `dp/dz = p(1−p)`. Al simplificar el producto vuelve a salir p−y.

Esta equivalencia explica un error común: multiplicar p−y otra vez por p(1−p) cuenta la derivada de sigmoid dos veces. La simplificación pertenece a esta combinación de loss y salida; con otra loss, como un error cuadrático sobre p, la derivada no tiene por qué ser p−y.

<img src="/assets/visuals/autodiff-foundations/DL-LOSS-GRADIENT.svg" alt="Cómo derivar BCE desde logits y aplicar una sola vez el promedio del batch. El diagrama distingue valores del forward, sensibilidades del backward y criterios de verificación para no confundir una derivada con una actualización de pesos." width="283" height="829" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar el diagrama](/assets/visuals/autodiff-foundations/DL-LOSS-GRADIENT.svg).

## Mean añade un factor una sola vez

Con n muestras y loss media, `L = (ℓ1 + … + ℓn)/n`. Cada logit participa en una sola de esas pérdidas, así que `dL/dzi = (pi − yi)/n`.

En el ejemplo tenemos una salida por muestra. El código dentro de `backward_trace`, en `packages/autodiff-foundations/manual.py`, es:

```python
    loss = binary_loss(z2, y)
    p = sigmoid(z2)
    dz2 = (p - y) / len(x)
```

La división corresponde a la reducción declarada de la loss. Si hubiéramos definido una suma, no aparecería ese factor. La loss y el backward deben describir la misma función.

La implementación PyTorch en `packages/autodiff-foundations/framework.py` declara la misma reducción:

```python
    loss = binary_cross_entropy_with_logits(logits, targets, reduction='mean')
```

La [documentación de BCE con logits](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.binary_cross_entropy_with_logits.html) permite otras reducciones. En problemas con varias salidas por muestra también hay que precisar qué elementos se promedian. Aquí trabajamos con shape `(n,1)` para no mezclar ese tema con el caso binario mínimo.

## El signo indica qué cambio del logit reduciría la loss localmente

Si y=1 y p=0,2, el gradiente por logit de una muestra es −0,8. Restar un pequeño paso en esa dirección aumentaría z, elevando la probabilidad propuesta para la clase positiva.

Si y=0 y p=0,8, el gradiente es +0,8. Restarlo reduciría z. Al promediar cuatro muestras, cada una aporta su término dividido por cuatro antes de combinarlo con los pesos y activaciones anteriores.

Esto es una interpretación local de la derivada. No garantiza que un paso grande mejore la loss total ni que un modelo con baja loss esté calibrado.

## Las tres versiones incorrectas producen problemas distintos

Olvidar el factor 1/n multiplica por cuatro todos los gradientes de nuestro batch de cuatro puntos. Es una derivada de la suma, pero no de la media que hemos escrito.

Promediar de nuevo al calcular un bias divide una segunda vez una contribución que ya tenía 1/n. En el siguiente artículo veremos por qué corresponde sumar sobre las filas.

Añadir sigmoid' otra vez suele reducir el gradiente de salida, porque p(1−p) está entre cero y 0,25. La gráfica compara el vector manual correcto con esa última variante en los mismos pesos iniciales; no compara entrenamientos.

<img src="/assets/interactive/autodiff-foundations/gradient-vector.svg" alt="Diecisiete gradientes con signo comparan el backward manual con una variante incorrecta que vuelve a multiplicar por la derivada sigmoid. Son los mismos pesos y cuatro puntos; la figura no representa curvas de entrenamiento." width="380" height="470" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la comparación](/assets/interactive/autodiff-foundations/gradient-vector.svg).

## Las pruebas deben declarar la función que se deriva

El laboratorio evalúa cuatro puntos XOR, con targets de shape `(4,1)`, loss media y float64. Comprueba configuraciones aleatorias de seeds 7 y 31 y unos pesos entrenados previamente en P096.

Las diferencias finitas rechazan las variantes incorrectas. Eso aporta evidencia de que el test distingue errores reales de escala y de cadena; no basta con comprobar que la implementación correcta produce un número finito.

En un proyecto, dejaría la reducción visible junto a la definición de la loss y probaría un batch de tamaño mayor que uno. Una sola muestra no permite descubrir el factor perdido de 1/n.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [backward instrumentado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/autodiff-foundations/manual.py), el [contraste PyTorch](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/autodiff-foundations/framework.py) y el [modelo canónico de P096](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py). Son datos y pesos de laboratorio, sin credenciales.

Requiere Docker y la image CPU fijada en `runtime.json`; la preparación se hace con `pnpm --dir packages/autodiff-foundations runtime:fetch`. Desde la raíz:

```bash
pnpm --dir packages/autodiff-foundations test:container
pnpm --dir packages/autodiff-foundations exercise
pnpm --dir packages/autodiff-foundations verify
pnpm --dir packages/autodiff-foundations test
pnpm --dir packages/autodiff-foundations render
```

El runner no instala paquetes Python en el host. `verify` vuelve a ejecutar los contrastes y comprueba fuentes, números y controles; el README detalla versiones y tolerancias.

## Garantías y límites

La deducción cubre BCE binaria sin pesos adicionales, desde logits, con la reducción media indicada. No incluye class weights, varias salidas, label smoothing ni otras losses. Cambiar esas decisiones exige volver a derivar o verificar el backward.

## Ejercicio: detectar el promedio equivocado

Para n=4, calcula los gradientes por logit de dos muestras, una con y=1,p=0,2 y otra con y=0,p=0,8. Explica qué ocurriría si olvidaras dividir por cuatro y si además promediaras después cada bias. La siguiente entrega continúa ese recorrido hasta los diecisiete parámetros de la MLP.

Continúa con [Backpropagation en una MLP: derivar pesos, bias y tanh con sus dimensiones](/posts/backpropagation-matrices-dense-bias-tanh).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Documentación PyTorch 2.14; runtime exacto 2.14.1+cpu. Las cifras y gráficas proceden del informe ejecutado.

- [Binary cross entropy with logits, PyTorch 2.14](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.binary_cross_entropy_with_logits.html).
