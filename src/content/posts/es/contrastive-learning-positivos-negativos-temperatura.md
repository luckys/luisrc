---
id: "DL-CONTRASTIVE"
title: "Contrastive learning: qué acerca los positivos y qué problema plantean los negativos"
published: "2026-10-26T03:02:00Z"
locale: "es"
translationKey: "model-adaptation-dl-contrastive"
slug: "contrastive-learning-positivos-negativos-temperatura"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-PRETRAINING"]
description: "Cómo un objetivo contrastivo usa identidades de pares y un denominador de alternativas. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Reconstruir una observación puede obligar a conservar detalles que no nos interesan. **Contrastive learning** plantea otra tarea: reconocer qué representaciones corresponden a vistas relacionadas frente a otras alternativas.

Tras [separar pretraining y transferencia](/posts/pretraining-transfer-learning-baseline-test-no-visto), calcularemos una loss contrastiva con tres pares. Es un probe de logits y gradientes; no sustituye el entrenamiento por reconstrucción del laboratorio ni reproduce un experimento de SimCLR.

## Un positivo se define mediante una hipótesis sobre los datos

Podemos generar dos recortes de una imagen y tratarlos como vistas del mismo objeto. También podemos emparejar una pregunta y su respuesta. Esas elecciones no son intercambiables: determinan qué relaciones estamos enseñando.

En un esquema self-supervised, la identidad del positivo puede proceder de dos transformaciones de la misma observación. No necesitamos una etiqueta humana de clase para alinearlas. Existen objetivos contrastivos supervisados con etiquetas explícitas; contrastivo y self-supervised no son sinónimos.

El [trabajo de SimCLR](https://arxiv.org/abs/2002.05709) estudia, entre otros componentes, la elección de augmentations y una proyección antes de la loss. Aquí simplificamos deliberadamente: dos matrices de tres embeddings de dimensión 2, con las parejas alineadas por índice.

<img src="/assets/visuals/model-adaptation/DL-CONTRASTIVE.svg" alt="Cómo un objetivo contrastivo usa identidades de pares y un denominador de alternativas. El diagrama sigue los datos y las operaciones específicas del experimento." width="591" height="846" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La diagonal identifica la pareja correcta

Normalizamos los embeddings para comparar su orientación mediante producto escalar. Cada fila de la matriz de logits representa una vista A frente a las tres vistas B. Su columna correcta es la del mismo índice.

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
def contrastive_loss(first, second, temperature=0.2):
    if temperature <= 0 or first.shape != second.shape or first.ndim != 2 or len(first) < 2:
        raise ValueError('two paired matrices, positive temperature and at least two pairs required')
    first = F.normalize(first, dim=-1)
    second = F.normalize(second, dim=-1)
    logits = first @ second.T / temperature
    positives = torch.arange(len(first))
    return (F.cross_entropy(logits, positives) + F.cross_entropy(logits.T, positives)) / 2
```

`logits` tiene forma `[3,3]`. Para la fila 0, la clase correcta es 0; para la fila 1, es 1. No son clases como «gato» y «perro»: son identidades de pareja dentro del batch. Al cambiar el batch cambian las alternativas y sus índices.

La **cross-entropy** de una fila equivale a restar el logit positivo al `logsumexp` de todos sus logits. El positivo también está incluido en el denominador. La implementación usa la versión numéricamente estable de PyTorch.

Calculamos ambas direcciones: A debe identificar su B y B debe identificar su A. Nuestra loss promedia las dos. Una implementación que solo use una dirección tiene otro objetivo, aunque en ejemplos simétricos pueda dar el mismo número.

## La temperatura cambia cuánto pesan las alternativas

Una **temperature** menor divide los logits por un número menor y acentúa sus diferencias antes de softmax. Si la pareja correcta ya domina, puede reducir mucho la loss; si domina una pareja incorrecta, puede penalizarla con más fuerza.

En los tres pares fijos, T=0,1 produce una loss aproximada 0,000151; T=0,2 da 0,013326 y T=1 da 0,476467. Los embeddings no se han movido entre esos cálculos. Una loss menor entre temperaturas distintas no demuestra una representación mejor.

<img src="/assets/interactive/model-adaptation/contrastive.svg" alt="Loss de tres pares fijos para temperaturas 0,1; 0,2 y 1. Los embeddings no se entrenan entre cálculos; menor loss entre temperaturas no significa una representación mejor." width="380" height="202" loading="lazy" style="width:100%;max-width:380px;height:auto" />

El visor permite seleccionar las tres temperaturas registradas. La tabla de logits conserva explícitamente T=0,2 para no hacer creer que cambia al mismo tiempo. También muestra el control que intercambia dos positivos: la loss pasa a 2,958167. El emparejamiento importa, aunque los vectores sean idénticos a los del caso anterior.

## Qué ocurre si todas las representaciones colapsan

Si todos los embeddings son iguales y no nulos, cada fila asigna la misma similitud a las tres alternativas. La probabilidad de identificar el positivo es 1/3 y la loss es `ln(3)`, aproximadamente 1,098612.

Es un control útil, no una demostración universal de que cualquier sistema contrastivo evitará todo colapso. En puntos simétricos concretos pueden aparecer gradientes poco útiles. Arquitectura, normalización, augmentations, batch y optimizer también afectan al entrenamiento.

Un **false negative** aparece cuando tratamos como alternativa negativa una muestra que comparte la relación semántica que queremos conservar. Dos imágenes del mismo objeto podrían estar alejándose porque sus identidades de instancia son distintas. Aumentar batch no resuelve automáticamente esa definición del problema.

## Elegir vistas requiere conocer la tarea que vendrá después

Recortar una esquina puede preservar un objeto grande y eliminar uno pequeño. Cambiar el color puede ser inocuo para reconocer una silla y destructivo para clasificar una señal cuyo color determina la clase. La transformación define una invariancia que estamos pidiendo aprender.

Por eso no sustituimos el ruido del denoising por augmentations al azar y damos por hecho que todo encaja. Si entrenásemos una variante contrastiva completa, necesitaría su protocolo, sus pares, su presupuesto y una evaluación downstream independiente.

## Garantías y límites

Las pruebas reconstruyen el denominador a mano, comprueban simetría al intercambiar las vistas y verifican gradientes por diferencias finitas. Son pruebas del cálculo de la función. No miden recuperación semántica, accuracy downstream ni beneficios de batches grandes.

## Ejercicio: encontrar un false negative concreto

Propón dos observaciones distintas que tu tarea de instancia trataría como negativas, pero que pertenezcan a la misma categoría útil para el usuario. Decide si quieres conservar esa categoría o distinguir instancias. Esa decisión debe preceder a elegir una loss por su popularidad.

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

- [SimCLR, Chen et al.](https://arxiv.org/abs/2002.05709).
- [CrossEntropyLoss, PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.CrossEntropyLoss.html).

Siguiente: [Freeze y unfreeze: qué deja de aprender y cómo volver a entrenarlo](/posts/freeze-unfreeze-backbone-optimizer-gradientes).
