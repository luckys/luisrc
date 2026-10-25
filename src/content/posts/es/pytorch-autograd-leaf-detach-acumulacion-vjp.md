---
id: "DL-AUTODIFF"
title: "Autograd en PyTorch: qué calcula backward y qué puede cortar el grafo"
published: "2026-10-25T19:04:00Z"
locale: "es"
translationKey: "autodiff-foundations-dl-autodiff"
slug: "pytorch-autograd-leaf-detach-acumulacion-vjp"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-GRADCHECK"]
description: "Cómo verificar leaf, acumulación, detach, valores guardados y un producto vector-Jacobiano. Deducción, ejemplos ejecutados y límites explícitos."
author: "Luis Ramírez Calle"
series: "Cómo se calcula un gradiente: forward, backward y autodiff"
tags: ["deep-learning", "autodiff", "pytorch", "numpy"]
---

La loss tiene el valor correcto, pero los pesos de la primera capa no reciben gradiente. O los reciben y, al repetir el paso, el valor se duplica. Para usar autograd con confianza hace falta entender qué operaciones se registran y dónde se acumula su resultado.

Cerramos el bloque de P097 después del [gradient checking](/posts/gradient-checking-diferencias-finitas-epsilon). Usaremos el mismo forward, los mismos pesos y float64 para distinguir derivación automática, estado de los gradientes y actualización de parámetros.

## Autograd deriva el cálculo que hemos ejecutado

PyTorch registra operaciones relevantes para derivar una salida respecto a los tensores que requieren gradiente. En este ejemplo creamos hojas nuevas a partir de los arrays NumPy.

El helper de `packages/autodiff-foundations/framework.py` es:

```python
def parameters(layers: list[Layer]) -> tuple[torch.Tensor, ...]:
    return tuple(torch.tensor(a, dtype=torch.float64, device='cpu', requires_grad=True)
                 for layer in layers for a in (layer.weight, layer.bias))
```

`torch.tensor` crea los tensores de parámetros en CPU con dtype float64 y `requires_grad=True`. No cargamos pesos aleatorios distintos al comparar frameworks. La correspondencia sigue W1,b1,W2,b2.

El cálculo completo de loss y backward en el mismo archivo es:

```python
def torch_gradient(x: np.ndarray, y: np.ndarray, layers: list[Layer]) -> tuple[np.ndarray, float]:
    params = parameters(layers)
    loss, _, _ = torch_forward(x, y, params)
    loss.backward()
    return np.asarray(gradient_values(params)), float(loss.detach())
```

`torch_forward` reproduce tanh y BCE media. La comparación devuelve los diecisiete gradientes y la loss, no una métrica de acierto ni un resultado de optimización.

## Backward acumula gradientes y deja los pesos como estaban

El experimento hace un forward y llama a backward. Después hace **otro forward nuevo** con los mismos pesos y llama a backward otra vez sin reiniciar `.grad`.

Los campos `.grad` contienen el doble de la contribución de un paso. Tras reiniciarlos con `None` y repetir un forward/backward, recuperamos el primer vector. Los pesos permanecen iguales en todas esas operaciones.

Este es el tramo de `graph_checks` en `packages/autodiff-foundations/framework.py`, después del primer backward:

```python
    once = gradient_values(params)
    hidden_shape = list(hidden.grad.shape)
    torch_forward(x, y, params)[0].backward()
    twice = gradient_values(params)
    for p in params:
        p.grad = None
    torch_forward(x, y, params)[0].backward()
    reset = gradient_values(params)
```

La [API de backward](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.backward.html) documenta la acumulación. En un entrenamiento normal se reinician gradientes según la estrategia de actualización; la acumulación deliberada de mini-batches requiere definir escalas y cuándo hacer el paso. Eso corresponde a P098.

## Leaf y non-leaf no guardan necesariamente el mismo estado

Los pesos creados por el helper son **leaf tensors** del grafo. Hidden es un resultado intermedio, un tensor non-leaf.

Sin pedir retención, el experimento observa gradientes en los parámetros después de backward y `hidden.grad` permanece None. Eso no significa que el backward no haya atravesado hidden. En un segundo recorrido, `hidden.retain_grad()` permite conservar su gradiente, con shape `(4,4)`.

[Retain_grad](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.retain_grad.html) sirve para inspeccionar ese resultado intermedio. **Retain_graph** es otra opción: controla la conservación de valores necesarios para volver a derivar usando el mismo grafo. No son dos nombres de la misma funcionalidad.

<img src="/assets/visuals/autodiff-foundations/DL-AUTODIFF.svg" alt="Cómo verificar leaf, acumulación, detach, valores guardados y un producto vector-Jacobiano. El diagrama distingue valores del forward, sensibilidades del backward y criterios de verificación para no confundir una derivada con una actualización de pesos." width="314" height="845" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar el diagrama](/assets/visuals/autodiff-foundations/DL-AUTODIFF.svg).

## Detach puede mantener la salida y cortar una trayectoria

La variante de fallo aplica `hidden = hidden.detach()` antes de la capa final. Conserva sus valores para calcular logits, pero esa rama ya no conecta la loss con W1 y b1 en el grafo de autograd.

Con hojas nuevas, aparecen **doce componentes sin gradiente acumulado**, los ocho pesos y cuatro bias de la primera capa. Los cinco parámetros de salida sí reciben gradientes. El informe conserva los None, en lugar de convertirlos automáticamente en ceros.

Detach tampoco implica una copia independiente de los datos: el tensor resultante comparte almacenamiento con el original. El control del laboratorio conserva los valores sin modificarlos.

La [documentación de detach](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.detach.html) explica esa separación del historial. Un gradiente matemáticamente cero y un parámetro desconectado en este forward son situaciones diferentes. Que `.grad` sea None también puede tener otras causas; aquí lo interpretamos dentro de este experimento controlado.

## Un grafo consumido y no_grad tienen fallos distintos

Volver a llamar a backward sobre nuestra misma loss, sin conservar los valores guardados, produce un error observado: el primer backward liberó información que este segundo recorrido necesita. Hacer un forward nuevo reconstruye el cálculo para otro paso.

Usar `retain_graph=True` por costumbre puede conservar memoria innecesariamente. La [mecánica de autograd](https://docs.pytorch.org/docs/2.14/notes/autograd.html) ayuda a distinguir creación del grafo y datos guardados; no conviene describirlo simplemente como «todo el grafo desaparece».

El control `no_grad` plantea otro caso: calculamos la loss dentro de ese contexto y luego intentamos derivarla. No tiene el historial requerido y backward se rechaza. [No_grad](https://docs.pytorch.org/docs/2.14/generated/torch.no_grad.html) resulta útil cuando precisamente queremos evitar ese registro; no permite cortar el forward de entrenamiento y recuperar después la trayectoria original.

Los dos fallos utilizan parámetros separados para que no contaminen el experimento de acumulación.

## Un VJP propaga una sensibilidad sin materializar todo el Jacobiano

Los logits forman un vector. Para volver desde ellos hasta los parámetros necesitamos indicar qué sensibilidad llega a cada logit. En nuestra loss esa sensibilidad es `(p−y)/n`.

`vector_product`, en `packages/autodiff-foundations/framework.py`, calcula ese **vector-Jacobian product**:

```python
def vector_product(x: np.ndarray, y: np.ndarray, layers: list[Layer]) -> np.ndarray:
    params = parameters(layers)
    _, _, logits = torch_forward(x, y, params)
    with torch.no_grad():
        upstream = (torch.sigmoid(logits) - torch.tensor(y, dtype=torch.float64)) / len(x)
    result = torch.autograd.grad(logits, params, grad_outputs=upstream)
    return np.concatenate([g.detach().numpy().ravel() for g in result])
```

Calculamos el valor de la sensibilidad en `no_grad` porque se aporta como semilla para este producto de primer orden. El forward de logits conserva su grafo. `torch.autograd.grad` devuelve los gradientes pedidos; no necesitamos acumularlos en `.grad` para compararlos.

El vector resultante coincide con el backward de la BCE y con la derivación manual en los casos ejecutados. La [API de grad](https://docs.pytorch.org/docs/2.14/generated/torch.autograd.grad.html) describe el papel de `grad_outputs`. No estamos comprobando aquí derivadas de orden superior.

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

Los controles se ejecutan en PyTorch 2.14.1+cpu, con NumPy 2.5.4 y float64. Hay comparación numérica, gradcheck y fallos observados, sin entrenamiento adicional, GPU, compilación o garantía para operaciones arbitrarias.

## Ejercicio: diagnosticar tres campos None

Distingue un hidden non-leaf sin retain_grad, los pesos de la primera capa tras detach y unos parámetros recién reiniciados antes del siguiente backward. Explica qué comprobarías en cada caso antes de reemplazar None por cero. El siguiente bloque utilizará gradientes verificados para estudiar optimizadores y dinámica de entrenamiento.

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Documentación PyTorch 2.14; runtime exacto 2.14.1+cpu. Las cifras y gráficas proceden del informe ejecutado.

- [Tensor.backward](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.backward.html).
- [Tensor.detach](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.detach.html).
- [Tensor.retain_grad](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.retain_grad.html).
- [No_grad](https://docs.pytorch.org/docs/2.14/generated/torch.no_grad.html).
- [Autograd mechanics](https://docs.pytorch.org/docs/2.14/notes/autograd.html).
- [Autograd.grad y VJP](https://docs.pytorch.org/docs/2.14/generated/torch.autograd.grad.html).
