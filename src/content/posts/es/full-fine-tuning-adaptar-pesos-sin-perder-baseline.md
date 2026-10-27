---
id: "DL-FULL-TUNING"
title: "Full fine-tuning: adaptar todos los pesos sin dar por ganada la transferencia"
published: "2026-10-26T03:04:00Z"
locale: "es"
translationKey: "model-adaptation-dl-full-tuning"
slug: "full-fine-tuning-adaptar-pesos-sin-perder-baseline"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-FREEZE"]
description: "Qué libertad de ajuste ofrece entrenar todo el encoder y qué comparación permite evaluarla. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Entrenar todo el encoder permite cambiar las features que usa un clasificador. También permite alterar información que antes servía para reconstruir los datos de origen. **Full fine-tuning** ofrece libertad de ajuste; decidir si compensa exige medir ambos efectos.

Tras [entender freeze y unfreeze](/posts/freeze-unfreeze-backbone-optimizer-gradientes), comparamos un encoder preentrenado con otro de arquitectura idéntica inicializado desde cero. Mantenemos el mismo head inicial para que la comparación tenga un control claro.

## Qué significa full en este laboratorio

El autoencoder original tiene 352 parámetros: 280 en el encoder y 72 en el decoder. Para clasificar retiramos el decoder del camino y añadimos un head de 18. El modelo de clasificación tiene 298 parámetros, todos entrenables en modo full.

«Full» se refiere al modelo que participa en esta tarea. El decoder anterior no sigue entrenándose en secreto; se conserva aparte para evaluar reconstrucción después de adaptar. En otros proyectos puede haber componentes deliberadamente excluidos: conviene especificarlos.

<img src="/assets/visuals/model-adaptation/DL-FULL-TUNING.svg" alt="Qué libertad de ajuste ofrece entrenar todo el encoder y qué comparación permite evaluarla. El diagrama sigue los datos y las operaciones específicas del experimento." width="429" height="1024" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La loss nueva modifica también la representación

Calculamos dos logits por ejemplo y los comparamos con la etiqueta mediante cross-entropy. El backward atraviesa head y encoder. El optimizer actualiza todos los parámetros incluidos en su grupo.

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
        optimizer.zero_grad(set_to_none=True)
        loss = F.cross_entropy(model(features), labels)
        loss.backward()
        optimizer.step()
```

Este bloque pertenece a la función común de adaptación. La diferencia entre estrategias está en los módulos y parámetros que se prepararon antes. Evitamos duplicar siete loops de entrenamiento casi iguales: así un cambio accidental en el cálculo de la loss no beneficia solo a una estrategia.

El backbone ya tiene una inicialización aprendida, pero ahora la clasificación manda. Si mover una feature ayuda a separar clases, el optimizer puede hacerlo aunque empeore la reconstrucción. No existe un término de retención en esta loss.

## Scratch es un control imprescindible

El modo scratch utiliza la misma arquitectura encoder+head y el mismo número de updates downstream. Su encoder empieza aleatorio. El head inicial coincide con el de full en cada seed y el generador de batches usa la misma seed.

No es una igualdad total de recursos: full consumió 400 updates previos en source. Tampoco demuestra que el learning rate sea óptimo para los dos modos. Es una comparación acotada de dos puntos de partida bajo un procedimiento downstream fijado.

En test, scratch obtiene 97,266%, 97,266% y 96,875% para seeds 7, 19 y 31. Full obtiene 97,266%, 96,484% y 95,703%. Estos valores no justifican afirmar que el pretraining mejora la generalización de esta tarea.

La tarea se diseñó con frontera lineal. El pretraining aprendió a reconstruir ocho coordenadas, incluidas seis que no determinan la clase. Una inicialización útil para un objetivo no tiene por qué ser una ventaja para otro.

## Un buen resultado final no cuenta toda la historia

Las curvas de validation permiten ver cuándo aprende cada ejecución. Podríamos estudiar tiempo hasta un umbral o estabilidad, pero no publicamos un benchmark de velocidad: no se midió wall time con un protocolo que controle calentamiento y variación del sistema.

Tampoco usamos el mejor checkpoint retrospectivo de test. El último update estaba decidido antes. En un flujo real con selección de checkpoints, validation tendría esa función y test seguiría reservado para la evaluación final de la decisión elegida.

Cambiar el learning rate tras ver que full no gana produciría un experimento nuevo. Habría que declararlo y evitar reutilizar el mismo test como árbitro de cada intento. Un test consultado para tomar decisiones deja de ser una evaluación independiente de esas decisiones.

## Qué se pierde al especializar todos los pesos

En la seed 7, el error de reconstrucción source con decoder original pasa aproximadamente de 0,0182 a 7,3951 MSE después de full tuning. La accuracy de clasificación puede ser buena mientras esa tarea anterior empeora.

Las unidades no son comparables: un punto de accuracy no equivale a un punto de MSE. La decisión exige definir qué capacidad anterior importa conservar y cuánto deterioro resulta aceptable. No hay una conversión universal entre ambas métricas.

En el artículo de forgetting ampliaremos esta evaluación. También distinguiremos el módulo adaptado activo de la posibilidad de recuperar una copia anterior intacta.

## Garantías y límites

Probamos igualdad del head inicial, independencia entre copias del encoder y los conjuntos de parámetros entrenables. Los resultados pertenecen a un MLP sintético CPU con 96 etiquetas. La [guía de fine-tuning de PyTorch](https://docs.pytorch.org/tutorials/beginner/finetuning_torchvision_models_tutorial.html) muestra cómo otras arquitecturas requieren heads y tamaños de entrada específicos.

## Ejercicio: formular una comparación que pueda fallar

Escribe la afirmación que te gustaría probar, por ejemplo: «con el mismo número de etiquetas, la inicialización previa alcanza una accuracy mayor». Define qué resultados la apoyarían y cuáles la contradirían. Si todos los resultados posibles te parecen una victoria del pretraining, la afirmación necesita concretarse.

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

- [Fine-tuning Torchvision Models](https://docs.pytorch.org/tutorials/beginner/finetuning_torchvision_models_tutorial.html).

Siguiente: [PEFT: contar parámetros entrenables sin confundirlos con toda la memoria](/posts/peft-parametros-entrenables-memoria-coste-real).
