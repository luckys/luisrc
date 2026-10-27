---
id: "DL-ADAPTERS"
title: "Adapters: añadir una corrección no lineal a una representación congelada"
published: "2026-10-26T03:07:00Z"
locale: "es"
translationKey: "model-adaptation-dl-adapters"
slug: "adapters-bottleneck-residual-peft"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-LORA"]
description: "Cómo un bottleneck residual aprende una corrección y por qué no equivale a LoRA. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Un encoder congelado puede recibir una corrección aprendida sin cambiar sus matrices originales. Un **adapter** residual aprende esa corrección a partir de la representación y se la suma antes de clasificar.

Después de [factorizar una actualización con LoRA](/posts/lora-rango-bajo-inicializacion-merge), introducimos una alternativa distinta: un bottleneck con una activación no lineal. Esa diferencia importa tanto para aprender como para servir el modelo.

## El bottleneck fuerza a expresar una corrección pequeña

Tomamos una representación h de ocho features, la proyectamos a dos, aplicamos ReLU y volvemos a ocho. La salida es `h + up(ReLU(down(h)))`.

La conexión residual deja un camino directo para la representación original. La rama añadida puede aprender a corregirla. Que tenga un ancho intermedio pequeño limita su capacidad, pero no garantiza que solo elimine información irrelevante.

Los [adapters de Houlsby y colaboradores](https://arxiv.org/abs/1902.00751) motivan la adaptación mediante módulos pequeños. Nuestro adapter se coloca después del encoder MLP, no entre todas las subcapas de un Transformer. No lo presentaremos como una reproducción exacta de esa arquitectura.

<img src="/assets/visuals/model-adaptation/DL-ADAPTERS.svg" alt="Cómo un bottleneck residual aprende una corrección y por qué no equivale a LoRA. El diagrama sigue los datos y las operaciones específicas del experimento." width="462" height="1076" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Por qué la rama empieza devolviendo cero

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
class Adapter(nn.Module):
    def __init__(self, width=8, bottleneck=2):
        super().__init__()
        self.down = nn.Linear(width, bottleneck)
        self.up = nn.Linear(bottleneck, width)
        nn.init.zeros_(self.up.weight)
        nn.init.zeros_(self.up.bias)

    def forward(self, hidden):
        return hidden + self.up(F.relu(self.down(hidden)))
```

`down` tiene 8×2 pesos y 2 bias: 18 parámetros. `up` tiene 2×8 pesos y 8 bias: 24. La suma da 42, a los que añadimos 18 del head para un total de 60 entrenables.

Inicializamos pesos y bias de `up` a cero. La corrección inicial es cero y la representación coincide exactamente con h. La proyección `down` conserva su inicialización aleatoria para que haya activaciones a partir de las que `up` pueda aprender.

En el primer backward, la rama de bajada puede recibir gradiente cero porque la de subida aún es nula. Esto no es un fallo de autograd. Las primeras actualizaciones de `up` abren después el camino. La prueba verifica identidad inicial y un gradiente no nulo en la subida para el caso de control.

## Un adapter no es una matriz LoRA con otro nombre

LoRA añade una composición lineal A/B a una matriz base. Nuestro adapter contiene ReLU, cuya activación depende del input. En general no podemos fusionar esa rama en una única matriz constante del encoder manteniendo igualdad para todas las entradas.

Si ignorásemos ReLU y su posición, cambiaríamos la función. La posibilidad de merge de una actualización lineal no se hereda solo porque ambos métodos usen matrices pequeñas.

El adapter también añade operaciones activas durante inferencia. Podemos compartir la base entre varias tareas y cambiar módulos, pero el coste concreto depende del serving. El laboratorio no mide una penalización de latencia ni afirma que toda implementación de adapters tenga el mismo overhead.

## Qué significan sus resultados frente a LoRA

El adapter logra 96,484%, 93,359% y 94,922% en test para seeds 7, 19 y 31. En seed 7 supera a nuestra LoRA; en seed 19 queda por debajo. No hay un ganador uniforme entre estas dos configuraciones.

El presupuesto tampoco es idéntico en capacidad: 60 entrenables del adapter frente a 66 de LoRA, con ubicaciones y funciones diferentes. Mantener 160 updates no transforma la comparación en un estudio exhaustivo de ambas familias.

Ambos superan al baseline de mayoría y, en varias ejecuciones, al lineal. Eso no borra el resultado del control scratch ni demuestra que necesitásemos pretraining. Una decisión de adaptación exige comparar con la alternativa sencilla que realmente podría desplegarse.

## Base conservada y representación activa son dos contratos

La base congelada no cambia durante entrenamiento. Sin embargo, el decoder original, aplicado después del adapter activo, recibe una representación diferente. La MSE de reconstrucción source aumenta en las tres seeds.

Retirar el adapter permite recuperar h si conservamos el encoder original. Es una propiedad útil para aislar tareas o volver a la base. No equivale a servir todas las capacidades previas mientras el módulo está activo.

También hay que conservar el head correcto. Intercambiar únicamente adapters con heads incompatibles puede cambiar el significado de los logits aunque las dimensiones coincidan.

## Garantías y límites

Las pruebas cuentan los parámetros, verifican la identidad inicial y comprueban que los pesos congelados siguen iguales tras un step. La evaluación de retención usa una tarea concreta de reconstrucción; no representa un test general de conocimiento. La arquitectura es didáctica y solo tiene un adapter final.

## Ejercicio: detectar una equivalencia que no existe

Considera dos inputs que activen conjuntos distintos de unidades ReLU del bottleneck. Explica por qué una única matriz constante no suele representar ambas correcciones. Después describe qué requisito adicional necesitaría una herramienta que prometiese eliminar el adapter en inferencia mediante merge exacto.

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

- [Parameter-Efficient Transfer Learning for NLP](https://arxiv.org/abs/1902.00751).

Siguiente: [Forgetting: medir qué cambia en la tarea anterior después de adaptar](/posts/forgetting-evaluar-tarea-anterior-despues-fine-tuning).
