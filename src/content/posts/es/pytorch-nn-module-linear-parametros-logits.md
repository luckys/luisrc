---
id: "DL-MODULE"
title: "nn.Module: registrar parámetros y construir un forward que devuelve logits"
published: "2026-10-25T21:02:00Z"
locale: "es"
translationKey: "pytorch-training-dl-module"
slug: "pytorch-nn-module-linear-parametros-logits"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-DATALOADER", "DL-LOSS-GRADIENT"]
description: "Qué organiza nn.Module y cómo comprobar que la red implementa el mismo modelo. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Una red puede tener el forward correcto y no entregar todos sus parámetros al optimizador. **nn.Module** ayuda a organizar capas y estado, pero conviene comprobar qué registra y qué sigue siendo responsabilidad del programa.

Después de [preparar los batches](/posts/pytorch-dataset-dataloader-orden-batches), trasladamos la MLP NumPy 2→4→1 a PyTorch. Mantenemos la arquitectura y copiamos los mismos pesos iniciales para verificar la correspondencia, sin atribuir una diferencia a inicializaciones distintas.

## Module registra las capas que asignamos como submódulos

La clase de `packages/pytorch-training/pipeline.py` usa `torch` y `nn`, importado mediante `from torch import nn`:

```python
class XorMLP(nn.Module):
    def __init__(self, width):
        super().__init__()
        self.hidden = nn.Linear(2, width, dtype=torch.float64)
        self.output = nn.Linear(width, 1, dtype=torch.float64)

    def forward(self, x):
        hidden = torch.tanh(self.hidden(x))
        return self.output(hidden)
```

`super().__init__()` prepara el registro del módulo. Asignar las capas a atributos permite descubrir sus parámetros mediante `model.parameters()` y sus nombres mediante `model.named_parameters()`.

Para colecciones dinámicas de capas se usarían contenedores como `ModuleList` o `Sequential`; una lista Python ordinaria no sustituye ese registro. Nuestro ejemplo solo necesita dos atributos, así que añadir un contenedor no aporta nada.

## Cuatro tensores contienen diecisiete parámetros escalares

Con width 4, el estado de la red incluye:

<div role="region" aria-label="Parámetros registrados de la MLP" tabindex="0" style="overflow-x:auto">

| Nombre | Shape | Valores escalares |
| --- | --- | ---: |
| `hidden.weight` | `(4,2)` | 8 |
| `hidden.bias` | `(4,)` | 4 |
| `output.weight` | `(1,4)` | 4 |
| `output.bias` | `(1,)` | 1 |

</div>

Hay cuatro tensores de parámetros y 17 valores escalares entrenables. Contar solo cuántos objetos devuelve `parameters()` respondería una pregunta distinta de sumar `p.numel()`.

El test comprueba esos nombres y el total. También contrasta los logits iniciales con NumPy en los 256 puntos train, con tolerancias declaradas. No basta con que la salida tenga shape `(256,1)`.

## Linear almacena el peso en otro orden

En el ejemplo NumPy escribíamos `X @ W + b`, con W de shape `(inputs,outputs)`. **nn.Linear** almacena su weight como `(outputs,inputs)` y evalúa la transformación correspondiente a `X @ weight.T + bias`.

Por eso copiamos la transpuesta al construir el modelo de referencia:

```python
    with torch.no_grad():
        for target, source in zip([model.hidden, model.output], layers):
            target.weight.copy_(torch.tensor(source.weight.T))
            target.bias.copy_(torch.tensor(source.bias))
```

La copia se hace antes de entrenar. `no_grad` evita registrar esta asignación de inicialización como parte de un cálculo diferenciable; no cambia el modo train/eval del modelo.

<img src="/assets/visuals/pytorch-training/DL-MODULE.svg" alt="Qué organiza nn.Module y cómo comprobar que la red implementa el mismo modelo. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="193" height="1008" loading="lazy" style="width:100%;max-width:193px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/DL-MODULE.svg).

## Forward devuelve logits y la loss decide cómo usarlos

La capa oculta aplica **tanh** para introducir no linealidad. La salida es afín y produce un logit por muestra. No añadimos sigmoid al final porque la loss usada ya es **BCE desde logits**.

Pasar una sigmoid adicional antes de esa loss cambiaría la función: la API interpretaría como logits valores que ya son probabilidades. La derivación y la estabilidad de la combinación se explican en [el artículo de BCE](/posts/binary-cross-entropy-logits-gradiente-promedio).

Para calcular una probabilidad al presentar una predicción sí puede aplicarse sigmoid. Para decidir la clase con umbral 0,5, basta comparar el logit con cero. Que el clasificador acierte todos los puntos del split no demuestra que sus probabilidades estén calibradas.

## Llamamos al modelo, no directamente a forward

El loop usa `model(x)`. Así pasa por el mecanismo de llamada de Module, incluidos los hooks que puedan estar registrados. `forward` define la operación, pero no conviene saltarse esa interfaz llamándolo directamente por costumbre.

Module tampoco ejecuta un optimizer step ni decide qué loss usar. Organiza parámetros, buffers y comportamiento de las capas; el entrenamiento sigue siendo una secuencia explícita que construiremos después.

El `state_dict` podrá contener buffers persistentes además de parámetros en otros modelos. Esta MLP no tiene BatchNorm u otras capas con ese estado adicional. No debe generalizarse su lista de cuatro claves a todas las redes.

## Ejercicio: cambia una dimensión con una explicación

Calcula cuántos valores entrenables habría con width 3 y qué shapes cambiarían. Explica por qué cargar estrictamente el state_dict de width 4 debe fallar. Después identifica qué dos operaciones habría que revisar si quisieras cambiar de una salida binaria a varias clases.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [pipeline PyTorch](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/pytorch-training/pipeline.py), los [checkpoints](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/pytorch-training/checkpoints.py), probes y tests. Reutiliza el [generador de datos y modelo NumPy anterior](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py) para contrastar la implementación inicial.

Con Docker y la image CPU fijada en `runtime.json`, desde la raíz del monorepo:

```bash
pnpm --dir packages/pytorch-training test:container
pnpm --dir packages/pytorch-training exercise
pnpm --dir packages/pytorch-training verify
pnpm --dir packages/pytorch-training test
```

Si falta la image, `pnpm --dir packages/pytorch-training runtime:fetch` descarga el digest declarado. No requiere instalar paquetes Python en el host. El experimento crea sus archivos de checkpoint en un directorio temporal propio y verifica su carga antes de eliminarlo.

## Explorar la ejecución registrada

<iframe src="/assets/interactive/pytorch-training/explorer.html" title="Inspeccionar entrenamiento PyTorch, broadcasting y reanudación con datos reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor completo](/assets/interactive/pytorch-training/explorer.html). Selecciona seed y checkpoint para las curvas; la comparación de reanudación corresponde siempre a seed 7. El navegador no entrena ni ejecuta PyTorch.

## Garantías y límites

El protocolo usa 256 muestras train y 128 validation, generadas por separado, con una MLP tanh 2→4→1, BCE media, CPU y float64. No se evalúa test, GPU, workers paralelos o reanudación a mitad de epoch. La MLP entrenada no incluye Dropout; el probe de modos lo usa por separado para comprobar su comportamiento.

Las cifras pertenecen a este dataset sintético y runtime. Los tests y `verify` vuelven a ejecutar el pipeline y el guardado/carga. Reproducir aquí una trayectoria no demuestra generalización en producción ni igualdad entre todas las plataformas.

## Referencias

- [nn.Module: registro, llamada y estado](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Module.html).
- [nn.Linear](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Linear.html).
- [BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.14/generated/torch.nn.BCEWithLogitsLoss.html).

Continúa con [Un training loop en PyTorch: qué cambia en zero_grad, backward y step](/posts/pytorch-training-loop-zero-grad-backward-step).
