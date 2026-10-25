---
id: "DL-BACKPROP"
title: "Backpropagation en una MLP: derivar pesos, bias y tanh con sus dimensiones"
published: "2026-10-25T19:02:00Z"
locale: "es"
translationKey: "autodiff-foundations-dl-backprop"
slug: "backpropagation-matrices-dense-bias-tanh"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-LOSS-GRADIENT", "DL-DENSE"]
description: "Cómo reconstruir el backward matricial completo y comprobar transpuestas y sumas. Deducción, ejemplos ejecutados y límites explícitos."
author: "Luis Ramírez Calle"
series: "Cómo se calcula un gradiente: forward, backward y autodiff"
tags: ["deep-learning", "autodiff", "pytorch", "numpy"]
---

Una transpuesta puede arreglar un error de dimensiones y seguir dejando un gradiente matemáticamente equivocado. Y cuando el batch y el ancho oculto tienen ambos tamaño cuatro, algunas operaciones incorrectas ni siquiera fallan por shape.

Vamos a reconstruir el **backward matricial** de la MLP anterior, empezando por [el gradiente de BCE](/posts/binary-cross-entropy-logits-gradiente-promedio). Queremos justificar cada producto y reducción antes de compararlos con PyTorch.

## El forward fija qué dependencias hay que derivar

Usamos `Z1 = XW1 + b1`, `H = tanh(Z1)` y `Z2 = HW2 + b2`. Z2 contiene los logits; la loss es la BCE media.

Para nuestro batch de cuatro puntos, X tiene `(4,2)`, W1 `(2,4)`, b1 `(4,)`, H `(4,4)`, W2 `(4,1)` y b2 `(1,)`. Hay diecisiete parámetros, compartidos entre las muestras.

En general escribiremos n para el batch y h para el ancho oculto. No son la misma dimensión aunque ambos valgan cuatro en el ejemplo principal. Una prueba adicional utiliza n=3 para evitar que esa coincidencia esconda errores.

## La última capa combina las contribuciones de todas las filas

Ya sabemos que `dZ2 = (sigmoid(Z2) − Y)/n`, de shape `(n,1)`.

Para un peso W2[j,0], cada muestra i aporta `H[i,j] × dZ2[i,0]`. La derivada total suma esas contribuciones sobre i. Esa suma es precisamente el producto `dW2 = H.T @ dZ2`, con shape `(h,1)`.

El bias b2[0] se añade a cada logit. Su derivada local es uno en cada fila, por lo que `db2 = dZ2.sum(axis=0)`. No volvemos a promediar: el factor de la loss media ya está en dZ2.

## El backward por H usa los pesos de salida del forward

Para volver a las activaciones ocultas, calculamos `dH = dZ2 @ W2.T`, con shape `(n,h)`. Cada unidad oculta recibe la sensibilidad que llega a través de su peso de salida.

Estos son los pesos con los que se hizo el forward. Cambiarlos antes de terminar el backward haría que el cálculo mezclara dos estados distintos de la red.

Después atravesamos tanh. Su derivada elemento a elemento es `1 − H²`, por lo que `dZ1 = dH * (1 − H²)`. El asterisco significa multiplicación elemento a elemento; en los productos entre capas usamos `@`.

<img src="/assets/visuals/autodiff-foundations/DL-BACKPROP.svg" alt="Cómo reconstruir el backward matricial completo y comprobar transpuestas y sumas. El diagrama distingue valores del forward, sensibilidades del backward y criterios de verificación para no confundir una derivada con una actualización de pesos." width="213" height="845" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar el diagrama](/assets/visuals/autodiff-foundations/DL-BACKPROP.svg).

## La primera capa repite la lógica de suma, no la reducción media

Para W1, cada muestra contribuye con su entrada y su sensibilidad en Z1. Agrupamos todas las contribuciones como `dW1 = X.T @ dZ1`, de shape `(2,h)`.

El bias b1 se comparte entre filas, así que `db1 = dZ1.sum(axis=0)`, de shape `(h,)`. Reducir sobre el eje 1 devolvería una cantidad por muestra, que no corresponde a los parámetros compartidos de la capa.

Estas fórmulas se pueden deducir componente a componente. Hacer que los tamaños encajen es una comprobación útil, pero no reemplaza esa deducción.

## El código conserva los valores intermedios para inspeccionarlos

La función completa de `packages/autodiff-foundations/manual.py` es:

```python
def backward_trace(x: np.ndarray, y: np.ndarray, layers: list[Layer]) -> dict:
    if len(layers) != 2:
        raise ValueError('two-layer MLP required')
    z1 = dense(x, layers[0])
    h = np.tanh(z1)
    z2 = dense(h, layers[1])
    loss = binary_loss(z2, y)
    p = sigmoid(z2)
    dz2 = (p - y) / len(x)
    dw2 = h.T @ dz2
    db2 = dz2.sum(axis=0)
    dh = dz2 @ layers[1].weight.T
    dz1 = dh * (1 - h ** 2)
    dw1 = x.T @ dz1
    db1 = dz1.sum(axis=0)
    return {'z1':z1, 'h':h, 'z2':z2, 'p':p, 'loss':loss,
            'dz2':dz2, 'dw2':dw2, 'db2':db2, 'dh':dh, 'dz1':dz1,
            'dw1':dw1, 'db1':db1}
```

`dense`, `sigmoid` y `binary_loss` proceden del modelo canónico de P096, importado mediante `base.py`. Este helper añade una traza explícita del backward para inspección; sus parámetros y forward son los mismos.

El entrenamiento anterior conserva su implementación de `gradients`. Las pruebas exigen que esta traza dé el mismo vector y, además, la contrastan con PyTorch y diferencias finitas. Así evitamos que una copia instrumentada se convierta en otra definición silenciosamente distinta.

## El orden de los parámetros forma parte del contraste

El informe aplana W1, b1, W2 y b2 en ese orden, recorriendo cada array por filas. Obtiene un vector de diecisiete entradas con nombres e índices.

No basta con comparar dos arrays de longitud diecisiete. Si uno usa W1,b1,W2,b2 y el otro W1,W2,b1,b2, compararía parámetros distintos. `pack` y `unpack` tienen una prueba de ida y vuelta y conservan las shapes originales.

El visor permite elegir cada parámetro y ver manual, PyTorch y diferencia finita para la misma entrada. Los valores cercanos a cero se muestran con notación científica cuando hace falta, sin sustituir una trayectoria ausente por cero.

## Los errores deliberados comprueban el recorrido que queremos enseñar

Omitir `1 − H²` deja bien las derivadas de la capa de salida, pero altera las de la primera. Promediar el bias otra vez solo estropea parte del vector. Por eso comprobamos cada parámetro, en lugar de aceptar una norma global que podría ocultar dónde está el fallo.

En las tres configuraciones declaradas, el máximo error absoluto entre el vector manual y autograd queda por debajo de **6 × 10⁻¹⁷**. Son observaciones float64 de este forward en CPU, no una garantía numérica para cualquier arquitectura.

La comparación usa PyTorch 2.14.1+cpu con los mismos pesos, targets y reducción. No hay un nuevo entrenamiento ni una selección del modelo que dé el gradiente más parecido.

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

Se ha implementado y comprobado el backward de una MLP de dos capas densas, tanh oculta y BCE binaria media. No se cubren convoluciones, parámetros compartidos entre múltiples capas, sparse tensors o derivadas de orden superior. El ejemplo escalar anterior sí aísla la acumulación de un nodo reutilizado.

## Ejercicio: volver a derivar el bias

Escribe la derivada de b1[j] como una suma sobre las muestras. Señala dónde aparece el factor 1/n y por qué no debe aparecer otra vez. Después cambia n a tres en las shapes y verifica qué dimensiones cambian y cuáles pertenecen a los parámetros.

Continúa con [Gradient checking: comprobar un backward sin confiar solo en que la loss baje](/posts/gradient-checking-diferencias-finitas-epsilon).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Documentación PyTorch 2.14; runtime exacto 2.14.1+cpu. Las cifras y gráficas proceden del informe ejecutado.

- [Autograd mechanics, PyTorch 2.14](https://docs.pytorch.org/docs/2.14/notes/autograd.html).
- [Torch autograd.grad, PyTorch 2.14](https://docs.pytorch.org/docs/2.14/generated/torch.autograd.grad.html).
