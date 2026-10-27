---
id: "DL-FREEZE"
title: "Freeze y unfreeze: qué deja de aprender y cómo volver a entrenarlo"
published: "2026-10-26T03:03:00Z"
locale: "es"
translationKey: "model-adaptation-dl-freeze"
slug: "freeze-unfreeze-backbone-optimizer-gradientes"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-CONTRASTIVE"]
description: "Cómo congelar pesos y reconstruir la participación del optimizer al descongelarlos. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Cambiar `requires_grad` a `True` no basta para que un encoder vuelva a aprender. Si sus parámetros quedaron fuera del optimizer, nadie aplicará los nuevos gradientes a esos pesos.

Después de [construir una loss contrastiva](/posts/contrastive-learning-positivos-negativos-temperatura), volvemos a las estrategias de adaptación. **Freeze** y **unfreeze** controlan qué puede actualizarse; también necesitamos saber qué hace el optimizer y dónde debe continuar el backward.

## Congelar pesos conserva una representación y limita el ajuste

En el modo `head`, congelamos los 280 parámetros del encoder y entrenamos los 18 del clasificador. La representación sigue calculándose para cada input, pero el entrenamiento no modifica los pesos del encoder.

Eso puede ser suficiente si las features aprendidas ya separan las clases con una frontera lineal. Si la información necesaria se perdió o quedó difícil de extraer, un head lineal tiene un margen limitado para compensarlo.

La **linear probe** mide esa combinación concreta de representación y head. No agota lo que podría aprender otro clasificador más potente, ni prueba que el encoder haya aprendido conceptos interpretables.

<img src="/assets/visuals/model-adaptation/DL-FREEZE.svg" alt="Cómo congelar pesos y reconstruir la participación del optimizer al descongelarlos. El diagrama sigue los datos y las operaciones específicas del experimento." width="448" height="958" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## requires_grad, no_grad y eval resuelven problemas distintos

`requires_grad_(False)` impide acumular gradientes para esos parámetros. `torch.no_grad()` evita registrar operaciones en el grafo de autograd dentro de su bloque. `eval()` cambia el comportamiento de módulos como Dropout o BatchNorm; no congela pesos por sí solo. La [documentación de autograd](https://docs.pytorch.org/docs/2.14/notes/autograd.html) distingue estos mecanismos.

Si todo el encoder es fijo y solo entrenamos un head posterior, podemos calcular la representación sin construir un grafo del encoder. Incluso podríamos cachearla si los inputs y las transformaciones son fijos.

Si insertamos una rama LoRA en medio y después hay capas congeladas, necesitamos que el gradiente atraviese esas capas hasta la rama entrenable. Rodear todo el backbone con `no_grad` cortaría ese camino. Que un peso sea constante no significa que la derivada respecto a la entrada de su operación sea innecesaria.

Nuestro MLP no contiene Dropout ni BatchNorm. Así aislamos congelación de parámetros. En otra arquitectura habría que decidir si preservar estadísticas de BatchNorm y cómo controlar la aleatoriedad de Dropout durante la adaptación.

## Unfreeze también necesita registrar parámetros en el optimizer

La estrategia gradual entrena solo el head durante 80 updates. Antes del update 81 habilita el encoder y lo añade como un grupo nuevo del optimizer:

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
        if mode == 'gradual' and step == config['unfreezeAt']:
            model.encoder.requires_grad_(True)
            optimizer.add_param_group({'params': list(model.encoder.parameters())})
```

La [API de add_param_group](https://docs.pytorch.org/docs/2.14/generated/torch.optim.Optimizer.add_param_group.html) contempla añadir parámetros durante fine-tuning. En nuestro caso el optimizer inicial solo contiene el head. El grupo nuevo hereda su learning rate 0,01; no usamos aquí learning rates discriminativos.

El estado de Adam del head continúa. Los parámetros recién añadidos empiezan su propio estado al recibir gradientes. Reconstruir todo el optimizer también sería una opción, pero podría perder el estado previo del head si no lo trasladamos.

## Qué produjo el calendario fijado

En la seed 7, head congelado consigue 93,75% de accuracy en test; gradual, 96,875%; full desde el primer update, 97,266%. Las otras seeds cambian las diferencias. No escogimos el punto de unfreeze mirando test: 80 era parte del protocolo previo.

La curva del visor muestra 18 parámetros entrenables hasta el checkpoint 80 y 298 a partir del 100, el siguiente que registramos. Los logs se guardan cada 20 updates; no afirmamos observar directamente cada update intermedio.

El conteo final de gradual coincide con full, pero sus trayectorias y estados de optimizer no son iguales. Llamarlos el mismo entrenamiento solo porque terminan con 298 entrenables ocultaría una decisión importante.

## Cómo comprobar que la congelación funciona

Las pruebas guardan los pesos congelados, ejecutan backward y un step, y exigen igualdad exacta después. También verifican que no reciban `.grad`. En las ejecuciones completas archivamos el máximo cambio por tensor entrenado.

Para el modo head, la reconstrucción source con el decoder original permanece exactamente igual: ni encoder ni decoder cambian. Es un control más fuerte que mirar un nombre de configuración, porque observa el efecto de los pesos usados realmente.

## Garantías y límites

El laboratorio comprueba una arquitectura sin estado mutable adicional. No demuestra que cualquier modelo congelado produzca representaciones idénticas si dejamos activas augmentations aleatorias o estadísticas actualizables. Gradual es un calendario fijo, no un algoritmo que detecte automáticamente cuándo descongelar.

## Ejercicio: localizar un unfreeze que no actualiza nada

Imagina que el optimizer se construyó solo con `model.head.parameters()`. Después se habilita `model.encoder.requires_grad_(True)`. Explica por qué podrías ver gradientes no nulos en el encoder y, aun así, pesos idénticos tras cada step. Indica qué comprobarías antes de cambiar el learning rate.

## Explorar las observaciones

El [visor interactivo](/assets/interactive/model-adaptation/explorer.html) muestra las 21 ejecuciones, curvas de validation, predicciones de test, conteos y un probe contrastivo. Cambia estrategia y seed para comparar; la calculadora LoRA es algebraica y no mide memoria.

<iframe src="/assets/interactive/model-adaptation/explorer.html" title="Laboratorio interactivo de pretraining y adaptación de modelos" loading="lazy" width="100%" height="760" style="border:1px solid #475569;border-radius:8px;max-width:100%"></iframe>

## Código completo y pruebas

El código explicado arriba forma parte de un laboratorio ejecutable. Las fuentes completas y los tests viven en [model-adaptation](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation), fuera del blog.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --filter @luisrc-examples/model-adaptation runtime:fetch
pnpm --filter @luisrc-examples/model-adaptation test:container
pnpm --filter @luisrc-examples/model-adaptation verify
```

Se necesita Docker y el runtime PyTorch fijado por digest. El experimento CPU usa un thread numérico, 2 CPUs y 2 GiB, sin red durante entrenamiento. `verify` repite tres pretrainings y 21 adaptaciones; compara curvas, deltas y predicciones con tolerancias declaradas. Las comprobaciones de hash fijan el código, no sustituyen repetirlo.

- [data.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/data.py)
- [models.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/models.py)
- [objectives.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/objectives.py)
- [training.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/training.py)
- [protocol.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/protocol.json)
- [tests/test_models.py](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/tests/test_models.py)
- [results/observations.json](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/model-adaptation/results/observations.json)

## Referencias

- [Autograd mechanics, PyTorch](https://docs.pytorch.org/docs/2.14/notes/autograd.html).
- [Optimizer.add_param_group](https://docs.pytorch.org/docs/2.14/generated/torch.optim.Optimizer.add_param_group.html).

Siguiente: [Full fine-tuning: adaptar todos los pesos sin dar por ganada la transferencia](/posts/full-fine-tuning-adaptar-pesos-sin-perder-baseline).
