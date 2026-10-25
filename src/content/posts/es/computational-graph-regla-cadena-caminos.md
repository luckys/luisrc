---
id: "P097"
title: "Computational graph: seguir los caminos de una pérdida antes de derivarla"
published: "2026-10-25T19:00:00Z"
locale: "es"
translationKey: "autodiff-foundations-p097"
slug: "computational-graph-regla-cadena-caminos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-REPRESENTATIONS", "P078"]
description: "Cómo aplicar la regla de la cadena cuando un valor se usa en más de un camino. Deducción, ejemplos ejecutados y límites explícitos."
author: "Luis Ramírez Calle"
series: "Cómo se calcula un gradiente: forward, backward y autodiff"
tags: ["deep-learning", "autodiff", "pytorch", "numpy"]
---

La loss baja, pero un parámetro compartido recibe solo la mitad del gradiente que debería. El entrenamiento puede avanzar durante un tiempo y ocultar el error. Para entenderlo conviene mirar qué operaciones dependen de cuáles y por cuántos caminos llega cada contribución.

Continuamos después de [las representaciones de la MLP](/posts/representaciones-aprendidas-limites-aproximacion-universal). En esta serie vamos a deducir su backward y contrastarlo con diferencias finitas y PyTorch. Empezaremos con un grafo escalar lo bastante pequeño como para comprobar cada número a mano.

## Un computational graph representa dependencias de cálculo

Un **computational graph** conecta valores mediante operaciones. Si calculamos `q = w × x`, necesitamos w y x antes de obtener q. Si después usamos q dos veces, ambos usos pertenecen al cálculo de la salida.

Para evitar matrices al principio, definimos:

`q = w × x; r = q + q; L = r²`

Tomamos w=2 y x=3. El forward produce q=6, r=12 y L=144. Esta pérdida cuadrática es un ejemplo para seguir dependencias; la MLP de clasificación utilizará BCE en el siguiente artículo.

El forward contesta qué valor tiene la salida. El backward pregunta cómo cambia L ante una pequeña variación de un valor intermedio o de una entrada, siguiendo [la regla de la cadena](/posts/derivadas-gradientes-regla-cadena).

<img src="/assets/visuals/autodiff-foundations/P097.svg" alt="Cómo aplicar la regla de la cadena cuando un valor se usa en más de un camino. El diagrama distingue valores del forward, sensibilidades del backward y criterios de verificación para no confundir una derivada con una actualización de pesos." width="284" height="963" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar el diagrama](/assets/visuals/autodiff-foundations/P097.svg).

## El recorrido inverso comienza con una sensibilidad igual a uno

La sensibilidad de L respecto a sí misma es `dL/dL = 1`. Esa es la **semilla** del recorrido inverso para esta salida escalar.

Como L=r², la derivada local es `dL/dr = 2r = 24`. Hasta aquí solo hemos pasado por una operación.

r suma dos usos de q. Cada entrada de la suma tiene derivada local 1. Por cada camino llega una contribución de 24 a q, por lo que `dL/dq = 24 + 24 = 48`.

El producto q=w×x transmite a w una derivada local x y a x una derivada local w. Obtenemos `dL/dw = 48 × 3 = 144` y `dL/dx = 48 × 2 = 96`.

Cada número combina una sensibilidad que llega desde la salida con una derivada local. No hemos tenido que expandir toda la expresión antes de derivar cada paso.

## Los caminos se suman; no se elige el último que llegue

Si al procesar el segundo uso de q sobrescribimos su contribución anterior, q conserva 24 en lugar de 48. El gradiente de w sale 72 en lugar de 144.

Este fallo también aparece cuando un parámetro participa en varias operaciones o una capa se reutiliza. La derivada total debe incluir todos los caminos relevantes, no solo el último visitado.

En `packages/autodiff-foundations/manual.py`, el ejemplo hace visible esa suma:

```python
def scalar_trace(w: float, x: float) -> dict[str, float]:
    if not np.isfinite(w) or not np.isfinite(x) or abs(w)>3 or abs(x)>3:
        raise ValueError('bounded scalar inputs required')
    q = w * x
    r = q + q
    loss = r ** 2
    dr = 2 * r
    dq_left = dr
    dq_right = dr
    dq = dq_left + dq_right
    return {'w':w, 'x':x, 'q':q, 'r':r, 'loss':loss, 'dr':dr,
            'dqLeft':dq_left, 'dqRight':dq_right, 'dq':dq, 'dw':dq*x, 'dx':dq*w}
```

Los límites de entrada mantienen acotado el experimento del visor. Las pruebas comparan esos valores con un grafo PyTorch independiente y comprueban también entradas negativas y un caso con w=0.

## Reverse-mode permite trabajar desde una salida hacia muchas entradas

En **reverse-mode autodiff**, se recorre la dependencia desde la salida hacia los valores que la produjeron, combinando derivadas locales y acumulando contribuciones. **Backpropagation** aplica esa idea al cálculo de gradientes de una red.

La distinción entre diferenciación manual, numérica, simbólica y automática se desarrolla en la [revisión de Baydin y colaboradores](https://www.jmlr.org/papers/v18/17-468.html). Autodiff evalúa reglas de derivación sobre el programa ejecutado; no necesita perturbar cada peso con un epsilon como haremos para comprobar resultados.

Esto resulta adecuado para una loss escalar con muchos parámetros. No significa que cualquier programa sea diferenciable ni que los floats produzcan derivadas matemáticamente exactas en todas las circunstancias.

## Backward y actualización de parámetros son pasos distintos

Calcular `dL/dw = 144` no cambia w. Un algoritmo de optimización podría usar ese dato para proponer una actualización, pero necesita su propia regla y sus propios parámetros.

En PyTorch, [backward acumula gradientes](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.backward.html). El laboratorio comprueba que los pesos permanecen sin cambios después de calcularlos. P098 abordará cómo utilizar esos gradientes para actualizar parámetros; aquí necesitamos primero confiar en qué se ha calculado.

## El visor distingue las etapas disponibles

El [visor de caminos y gradientes](/assets/interactive/autodiff-foundations/explorer.html) permite cambiar w y x y recorrer forward y backward con teclado. Al volver a una etapa anterior desaparecen los valores que todavía no se han calculado; no se conservan derivadas de una etapa posterior.

Las entradas libres recalculan las ecuaciones del ejemplo en JavaScript. El contraste PyTorch se ejecutó previamente sobre los casos declarados del informe; el navegador no ejecuta el framework.

En el proyecto de laboratorio, esta separación ayuda a detectar errores de acumulación antes de interpretar una curva de entrenamiento. Un test puede comprobar el gradiente esperado de un grafo compartido aunque una métrica final parezca razonable.

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

El ejemplo permite verificar cada contribución y su suma, y coincide con autograd en los casos ejecutados. No constituye un motor de autodiff general ni comprueba derivadas de programas arbitrarios, control de flujo dinámico o precisión mixta.

## Ejercicio: provocar la pérdida de un camino

Calcula qué gradiente recibiría x si q retuviera solo una contribución. Después cambia w a −1 y x a 2 y sigue el signo de cada derivada. Comprueba los resultados en el visor y explica por qué L puede ser positiva aunque uno de sus gradientes sea negativo.

Continúa con [Binary cross entropy: de dónde sale el gradiente p menos y](/posts/binary-cross-entropy-logits-gradiente-promedio).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Documentación PyTorch 2.14; runtime exacto 2.14.1+cpu. Las cifras y gráficas proceden del informe ejecutado.

- [Baydin y colaboradores, Automatic Differentiation in Machine Learning (2018)](https://www.jmlr.org/papers/v18/17-468.html).
- [Tensor.backward, PyTorch 2.14](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.backward.html).
