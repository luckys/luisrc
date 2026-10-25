---
id: "DL-GRADCHECK"
title: "Gradient checking: comprobar un backward sin confiar solo en que la loss baje"
published: "2026-10-25T19:03:00Z"
locale: "es"
translationKey: "autodiff-foundations-dl-gradcheck"
slug: "gradient-checking-diferencias-finitas-epsilon"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-BACKPROP"]
description: "Cómo diseñar diferencias finitas y tolerancias que detecten errores sin confundir redondeo. Deducción, ejemplos ejecutados y límites explícitos."
author: "Luis Ramírez Calle"
series: "Cómo se calcula un gradiente: forward, backward y autodiff"
tags: ["deep-learning", "autodiff", "pytorch", "numpy"]
---

Una implementación del backward coincide con sus propias pruebas, pero la prueba usa la misma fórmula equivocada. Comprobar solo que la loss disminuye tampoco descarta ese fallo: un gradiente mal escalado puede seguir produciendo pasos útiles.

Después de [derivar las matrices](/posts/backpropagation-matrices-dense-bias-tanh), usaremos **diferencias finitas** como un contraste independiente. Cambiaremos un parámetro cada vez, exploraremos el efecto de epsilon y verificaremos que el criterio rechaza errores deliberados.

## Una diferencia central aproxima la derivada alrededor del mismo punto

Para el parámetro θj, calculamos:

`gj ≈ [L(θ + εej) − L(θ − εej)] / (2ε)`

ej selecciona una sola posición del vector. Los demás parámetros, las entradas y los targets permanecen iguales. Evaluamos la misma loss media dos veces.

Para diecisiete parámetros hacen falta **34 evaluaciones de loss por epsilon** con esta implementación. Es un coste razonable para comprobar una red pequeña, pero no una forma práctica de calcular cada actualización de una red con millones de parámetros.

En `packages/autodiff-foundations/manual.py`:

```python
def finite_gradient(x: np.ndarray, y: np.ndarray, layers: list[Layer], epsilon: float) -> np.ndarray:
    if not np.isfinite(epsilon) or epsilon<=0 or epsilon>0.1:
        raise ValueError('epsilon outside bounded experiment')
    theta = pack(layers)
    result = np.zeros_like(theta)
    for i in range(len(theta)):
        high, low = theta.copy(), theta.copy()
        high[i] += epsilon
        low[i] -= epsilon
        loss_high = binary_loss(forward(x, unpack(layers, high))[0], y)
        loss_low = binary_loss(forward(x, unpack(layers, low))[0], y)
        result[i] = (loss_high - loss_low) / (2 * epsilon)
    return result
```

`unpack` reconstruye las shapes en copias nuevas. No modifica los pesos originales ni deja una perturbación puesta al pasar al siguiente parámetro. Un test comprueba precisamente que el vector inicial queda intacto después de ejecutar la función.

## Un epsilon grande y uno demasiado pequeño fallan por motivos distintos

Una perturbación grande aproxima la función con un tramo que puede curvarse bastante. Para una función suficientemente suave, la diferencia central tiene error de truncamiento de orden ε² en condiciones adecuadas, pero no es la derivada exacta en un intervalo finito.

Con una perturbación muy pequeña, las dos losses pueden resultar casi iguales a la precisión de los floats. Su resta pierde información y después la dividimos por un número diminuto. Reducir epsilon de forma indefinida puede empeorar el resultado.

El protocolo declara siete valores, de 1e-1 a 1e-13, antes de generar resultados. No elegimos después solo el epsilon que dibuja una coincidencia bonita.

<img src="/assets/visuals/autodiff-foundations/DL-GRADCHECK.svg" alt="Cómo diseñar diferencias finitas y tolerancias que detecten errores sin confundir redondeo. El diagrama distingue valores del forward, sensibilidades del backward y criterios de verificación para no confundir una derivada con una actualización de pesos." width="312" height="829" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar el diagrama](/assets/visuals/autodiff-foundations/DL-GRADCHECK.svg).

<div role="region" aria-label="Barrido observado de epsilon para initial siete" tabindex="0" style="overflow-x:auto">

| Epsilon | Máximo error absoluto, initial-7 | Criterio por parámetro |
| --- | --- | --- |
| 1e-1 | 5,23 × 10⁻⁴ | Rechazado |
| 1e-3 | 5,25 × 10⁻⁸ | Aceptado |
| 1e-5 | 9,92 × 10⁻¹² | Aceptado |
| 1e-9 | 6,88 × 10⁻⁸ | Rechazado |
| 1e-13 | 7,63 × 10⁻⁴ | Rechazado |

</div>

La tabla resume uno de los tres casos; el gráfico y los datos incluyen los siete epsilons para pesos iniciales de seeds 7 y 31 y un checkpoint entrenado de P096. Son errores medidos al evaluar esas funciones en el runtime declarado, no una curva ideal dibujada a mano.

<img src="/assets/interactive/autodiff-foundations/error-sweep.svg" alt="Errores absolutos máximos observados al comprobar diecisiete gradientes con diferencias centrales y siete epsilons. Tres curvas muestran el deterioro en los extremos. Ambos ejes son logarítmicos y no se representa tiempo de rendimiento." width="380" height="425" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar el barrido](/assets/interactive/autodiff-foundations/error-sweep.svg).

## La tolerancia debe combinar escala absoluta y relativa

El protocolo acepta cada componente si `abs(num − manual) ≤ atol + rtol × abs(manual)`, con **atol=1e-8** y **rtol=1e-5**. El contraste principal usa epsilon 1e-5.

Un error absoluto de 5e-8 no implica por sí solo rechazo: depende también de la escala del gradiente y del término relativo. Esa es la razón de que la tabla no use simplemente «máximo error menor que atol».

Cerca de un gradiente cero, dividir solo por su magnitud puede producir un error relativo enorme o indefinido. `error_summary`, en `packages/autodiff-foundations/experiments.py`, conserva estadísticas y un criterio de aceptación separados:

```python
def error_summary(candidate, reference, rtol, atol):
    difference=np.abs(candidate-reference)
    relative=difference/np.maximum(1e-12,np.abs(candidate)+np.abs(reference))
    return {'maxAbsError':float(difference.max()),'maxRelativeError':float(relative.max()),
            'passes':bool(np.allclose(candidate,reference,rtol=rtol,atol=atol))}
```

El suelo de 1e-12 pertenece únicamente a la estadística de error relativo mostrada. La aceptación la decide `np.allclose` con las tolerancias declaradas, no ese suelo ni una cifra global redondeada.

## Una comprobación útil también tiene que rechazar algo incorrecto

Probamos cuatro variantes: olvidar el promedio del batch, omitir la derivada tanh, promediar de nuevo los bias y multiplicar otra vez por sigmoid'. Todas se rechazan frente a la referencia de diferencias finitas con epsilon 1e-5 en los tres casos.

No afirmamos que esos cuatro fallos cubran todos los errores posibles. Sí muestran que el criterio puede distinguir cambios de escala, una regla local omitida y una derivada contada dos veces, sobre los parámetros que les corresponden.

Además ejecutamos **gradcheck de PyTorch** sobre la función implementada en el framework. Usa su propia comprobación numérica, con eps=1e-6,atol=1e-5,rtol=1e-3. Ese resultado comprueba la función PyTorch; el backward NumPy se contrasta aparte con el vector numérico y con autograd.

## El experimento debe ser determinista y estar en un punto adecuado

Una loss con dropout activo, muestreo nuevo en cada llamada o estado mutable puede cambiar por motivos distintos a la perturbación. Para comprobar gradientes conviene fijar entradas y estado y usar precisión suficiente.

En un punto no diferenciable, como el cero de ReLU, una diferencia central no tiene por qué coincidir con la convención que utiliza un framework. Nuestro contraste usa tanh y BCE suaves, en float64, sin entrenamiento entre evaluaciones.

El [documento de gradcheck](https://docs.pytorch.org/docs/2.14/generated/torch.autograd.gradcheck.gradcheck.html) describe estas precauciones y los límites de una comprobación local. No hay una aprobación universal del código porque un punto haya pasado.

<iframe src="/assets/interactive/autodiff-foundations/explorer.html" title="Explorar caminos, gradientes y errores de comprobación" loading="lazy" width="100%" height="2300" style="border:0;border-radius:12px"></iframe>

[Abrir el visor](/assets/interactive/autodiff-foundations/explorer.html).

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

Se comprueban diecisiete componentes en tres configuraciones y se recalculan los resultados archivados. No se prueban todas las entradas, precisiones o implementaciones de la red. El barrido ayuda a diagnosticar el contraste; no sustituye pruebas de shapes, pérdidas, entrenamiento y evaluación.

## Ejercicio: elegir un rechazo que tenga explicación

En el visor, compara initial-7 con epsilon 1e-5 y 1e-13. Explica por qué el segundo rechazo no demuestra que el backward esté mal. Después selecciona «sin promedio del batch» y distingue ese fallo de la pérdida de precisión numérica.

Continúa con [Autograd en PyTorch: qué calcula backward y qué puede cortar el grafo](/posts/pytorch-autograd-leaf-detach-acumulacion-vjp).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Documentación PyTorch 2.14; runtime exacto 2.14.1+cpu. Las cifras y gráficas proceden del informe ejecutado.

- [Gradcheck, PyTorch 2.14](https://docs.pytorch.org/docs/2.14/generated/torch.autograd.gradcheck.gradcheck.html).
- [Gradcheck mechanics, PyTorch 2.14](https://docs.pytorch.org/docs/2.14/notes/gradcheck.html).
