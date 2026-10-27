---
id: "DL-PRETRAINING"
title: "Pretraining y transfer learning: comprobar si empezar con pesos aprendidos ayuda"
published: "2026-10-26T03:01:00Z"
locale: "es"
translationKey: "model-adaptation-dl-pretraining"
slug: "pretraining-transfer-learning-baseline-test-no-visto"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P104"]
description: "Cómo separar lo aprendido en una tarea previa de la mejora real en la tarea destino. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Una red puede reconstruir muy bien sus datos de origen y aportar poco a una clasificación nueva. **Pretraining** describe una etapa anterior de entrenamiento; no promete una ventaja automática en cualquier problema posterior.

En [self-supervision con denoising](/posts/self-supervision-denoising-aprender-sin-etiquetas) entrenamos un encoder sin etiquetas de clase. Ahora reutilizamos sus pesos y comprobamos si ayudan frente a alternativas que empiezan desde cero.

## Pretraining, transfer learning y fine-tuning nombran decisiones diferentes

**Pretraining** es el entrenamiento previo al objetivo que ahora queremos resolver. Puede ser supervisado o self-supervised. **Transfer learning** consiste en aprovechar algo aprendido en otra tarea o distribución. Podemos transferir un encoder congelado sin actualizar sus pesos.

**Fine-tuning** actualiza parte o todos los pesos transferidos usando el nuevo objetivo. Cambiar únicamente el clasificador suele llamarse entrenamiento del head o linear probing cuando ese head es lineal. El vocabulario puede variar entre herramientas; conviene describir qué parámetros cambian.

Nuestro source aprende reconstrucción. El target pide clasificar el signo de `x0 + 0,5 × x1`. En target, las otras seis features desplazan su media en 0,6. Es una tarea sintética deliberadamente sencilla: una frontera lineal conocida nos obliga a incluir un baseline lineal serio.

<img src="/assets/visuals/model-adaptation/DL-PRETRAINING.svg" alt="Cómo separar lo aprendido en una tarea previa de la mejora real en la tarea destino. El diagrama sigue los datos y las operaciones específicas del experimento." width="660" height="1075" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Transferimos un encoder, no el significado de una clase

El decoder del autoencoder devuelve ocho números reconstruidos. No sabe producir las dos clases nuevas. Lo retiramos del camino de clasificación y añadimos un **head** lineal de ocho entradas y dos logits.

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
class Classifier(nn.Module):
    def __init__(self, encoder, adapter=None):
        super().__init__()
        self.encoder = encoder
        self.adapter = adapter if adapter is not None else nn.Identity()
        self.head = nn.Linear(8, 2)

    def representation(self, features):
        return self.adapter(self.encoder(features))

    def forward(self, features):
        return self.head(self.representation(features))
```

`encoder` puede ser una copia del encoder aprendido o uno nuevo para el control scratch. El head empieza con los mismos pesos en los modos MLP de una misma seed. Así evitamos atribuir a la transferencia una diferencia que en realidad proceda de otro clasificador inicial.

Un head aleatorio sin entrenar no es un baseline semántico útil para estas etiquetas. En esta arquitectura no existe una capacidad **zero-shot** que traduzca directamente la reconstrucción en clases. Por eso el baseline congelado también recibe entrenamiento supervisado del head.

## El protocolo se fija antes de mirar los resultados

Source usa 800/160/256 filas para train/validation/test. Target usa 96/128/256. Las filas de test son nuevas; los generadores, la frontera de clase y las distribuciones son conocidos por diseño. No estamos probando una distribución arbitraria ni clases desconocidas.

Se ejecutan siete estrategias con seeds 7, 19 y 31: linear, scratch, head congelado, unfreeze gradual, full, LoRA y adapter. Cada una recibe 160 updates downstream con batch 32. Los modos transferidos acumulan además 400 updates de pretraining. Esa inversión previa forma parte del coste.

Usamos el checkpoint del último update fijado. Registramos validation, pero no elegimos configuraciones con esas curvas. Todos los optimizers terminan antes de evaluar test. Se archivan predicciones y etiquetas para poder reconstruir cada accuracy, no solo confiar en una media publicada.

## La transferencia no ganó en este problema

<div role="region" aria-label="Accuracy en test reservado de las siete estrategias" tabindex="0" style="overflow-x:auto;max-width:100%">

| Estrategia | Seed 7 | Seed 19 | Seed 31 |
| --- | --- | --- | --- |
| linear | 92,578% | 93,359% | 93,359% |
| scratch | 97,266% | 97,266% | 96,875% |
| head | 93,750% | 93,359% | 91,797% |
| gradual | 96,875% | 95,703% | 96,094% |
| full | 97,266% | 96,484% | 95,703% |
| lora | 95,703% | 94,141% | 94,141% |
| adapter | 96,484% | 93,359% | 94,922% |

</div>

<img src="/assets/interactive/model-adaptation/adaptation.svg" alt="Accuracy media de las tres seeds en las 256 filas target test por estrategia. Scratch supera a full en este problema lineal sintético; no es una clasificación universal de métodos." width="380" height="338" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El control scratch iguala full en la seed 7 y lo supera en 19 y 31. El head congelado tampoco mejora siempre al baseline lineal. Mantener estas observaciones es parte del experimento: cambiar el dataset después de verlas para conseguir una victoria de pretraining invalidaría la comparación que habíamos planteado.

No demuestran que pretraining sea inútil. En una tarea de frontera lineal y ocho features, aprender antes a reconstruir nuisances puede aportar poco. Tampoco prueban que el control lineal haya alcanzado su mejor rendimiento posible: cada modo recibe un presupuesto fijo y ninguna búsqueda de hyperparameters propia.

La **mayoría de train** elige la clase 1. En test acierta 46,48%, no 50% exacto. Es esperable que un conjunto finito no esté perfectamente equilibrado; el baseline se calcula con la clase elegida en train, sin elegir retrospectivamente la más frecuente de test.

## Qué comparación haría falta para decidir en un proyecto

Primero definiría qué se quiere ahorrar: etiquetas, tiempo hasta una calidad mínima, coste de servir varios modelos o almacenamiento por adaptación. Son objetivos distintos y pueden recomendar decisiones diferentes.

Después compararía con un baseline adecuado, mantendría un test reservado y declararía cómo se eligen los hyperparameters. Una sola inicialización no permite separar una mejora estable de variación de entrenamiento. Tres seeds ofrecen una primera vista, no una estimación precisa de incertidumbre en producción.

## Garantías y límites

Los hashes prueban ausencia de filas exactamente repetidas y fijan fuentes/configuración. No prueban ausencia de toda dependencia estadística. El presupuesto iguala updates downstream, no tiempo, cómputo total ni exploración óptima por método. La [guía de transfer learning de PyTorch](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html) ofrece otro contexto, con un modelo de visión; los resultados de nuestro MLP no se extrapolan a él.

## Ejercicio: decidir qué significa una mejora

Elige antes de entrenar una métrica y una restricción: por ejemplo, alcanzar 95% con un número máximo de etiquetas. Explica qué datos nuevos tendrías que recopilar para medirlo. Nuestra tabla final con 96 etiquetas no responde por sí sola a esa pregunta.

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

- [Transfer learning, PyTorch](https://docs.pytorch.org/tutorials/beginner/transfer_learning_tutorial.html).

Siguiente: [Contrastive learning: qué acerca los positivos y qué problema plantean los negativos](/posts/contrastive-learning-positivos-negativos-temperatura).
