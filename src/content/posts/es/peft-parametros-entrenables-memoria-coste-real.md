---
id: "DL-PEFT"
title: "PEFT: contar parámetros entrenables sin confundirlos con toda la memoria"
published: "2026-10-26T03:05:00Z"
locale: "es"
translationKey: "model-adaptation-dl-peft"
slug: "peft-parametros-entrenables-memoria-coste-real"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-FULL-TUNING"]
description: "Qué recursos puede ahorrar una adaptación pequeña y cuáles siguen dependiendo del modelo base. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Entrenar 66 parámetros en vez de 298 reduce lo que debe actualizar el optimizer. No significa que el proceso solo necesite almacenar 66 números. El modelo base sigue participando en el cálculo.

Después de [medir full fine-tuning frente a scratch](/posts/full-fine-tuning-adaptar-pesos-sin-perder-baseline), introducimos **PEFT**, parameter-efficient fine-tuning. Antes de elegir una técnica conviene separar el presupuesto de parámetros del presupuesto completo de ejecución.

## Qué intenta ahorrar PEFT

PEFT agrupa estrategias que adaptan una fracción de los parámetros o añaden un conjunto pequeño específico de cada tarea. LoRA y adapters son dos familias; no producen la misma función ni tienen necesariamente el mismo coste de inferencia.

Puede interesar guardar muchas adaptaciones que compartan una base grande. También reducir gradientes y estado del optimizer. El beneficio depende del tamaño del backbone, los módulos elegidos, la precisión y cómo se implementa el backward.

Nuestro modelo es pequeño. Su utilidad está en poder contar todos los elementos y comprobar qué cambia, no en demostrar un ahorro operativo significativo.

<img src="/assets/visuals/model-adaptation/DL-PEFT.svg" alt="Qué recursos puede ahorrar una adaptación pequeña y cuáles siguen dependiendo del modelo base. El diagrama sigue los datos y las operaciones específicas del experimento." width="591" height="856" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## Cuatro componentes que no conviene mezclar

Los **pesos** incluyen la base cargada y los módulos añadidos. Los **gradientes** se necesitan para los parámetros entrenables. Adam mantiene normalmente dos acumuladores por parámetro actualizado, además de otros detalles de implementación.

Las **activaciones** son resultados intermedios necesarios para calcular derivadas. Aunque un peso esté congelado, pueden seguir haciendo falta operaciones y activaciones para propagar gradientes hacia una rama entrenable anterior.

También hay memoria temporal del runtime, buffers, batches, posibles copias de precisión y fragmentación. Contar parámetros no los mide. El apartado GPU del roadmap necesita una medición real de VRAM; estos bytes algebraicos no lo sustituyen.

## Contar lo que realmente participa en la adaptación

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
def parameter_counts(model):
    return dict(total=sum(p.numel() for p in model.parameters()),
        trainable=sum(p.numel() for p in model.parameters() if p.requires_grad))
```

`numel()` cuenta elementos, incluidos bias. En LoRA añadimos 48 parámetros para una actualización de una matriz 16→8 y 18 para el head. En el adapter añadimos 42 para su bottleneck con bias y 18 para el head.

<div role="region" aria-label="Parámetros reales incluidos bias" tabindex="0" style="overflow-x:auto;max-width:100%">

| Modo | Total clasificación | Entrenables finales |
| --- | --- | --- |
| linear | 18 | 18 |
| scratch | 298 | 298 |
| head | 298 | 18 |
| gradual | 298 | 298 |
| full | 298 | 298 |
| lora | 346 | 66 |
| adapter | 340 | 60 |

</div>

LoRA y adapter tienen más parámetros totales de clasificación que full, porque conservan el encoder y añaden módulos. Aun así, tienen menos entrenables. «Más pequeño» necesita un sustantivo: menor checkpoint por tarea, menor estado del optimizer o menor modelo completo son afirmaciones distintas.

El decoder de reconstrucción anterior no está incluido en esta tabla de clasificación. Si mantenemos ambos objetos en memoria para evaluar retención, el proceso conserva también ese decoder y su copia base. El conteo del modelo no equivale al peak memory del runner.

## Un cálculo de bytes útil, siempre con sus supuestos

Si asumimos FP32 para pesos, gradientes y dos estados Adam, cada parámetro entrenable aporta 16 bytes para esos cuatro arrays. Con 298 entrenables son 4768 bytes; con 66,1056. Son cifras analíticas parciales, no memoria observada.

Además habría que contar los pesos congelados. En LoRA, 280 parámetros del encoder base siguen presentes, aunque no necesiten gradientes ni momentos de Adam propios. Hay 72 pesos/bias del decoder en la copia retenida para otra evaluación, y la implementación puede conservar otras copias.

En modelos grandes, activaciones y operaciones temporales pueden dominar parte del coste. Una reducción de entrenables de cierto porcentaje no autoriza a anunciar la misma reducción de VRAM, tiempo o energía.

## Qué conviene guardar para poder servir una adaptación

Un checkpoint específico de tarea debe identificar la base exacta, su arquitectura, el lugar de inserción de los módulos y sus hyperparameters. Guardar solo A/B sin saber a qué proyección corresponden no basta para reconstruir el modelo.

También necesitamos el head nuevo: sus etiquetas y orden de logits forman parte del contrato. En una adaptación de texto añadiríamos tokenizer, preprocessing y versión. Un ahorro de almacenamiento deja de ser útil si la carga depende de convenciones implícitas.

La base puede compartirse entre tareas si el sistema de serving lo soporta. El coste de activar, cargar o intercambiar módulos también merece medirse en el entorno real. No aparece automáticamente en una tabla de parámetros.

## Garantías y límites

Los conteos provienen de los módulos ejecutados y las pruebas verifican los conjuntos congelados. No medimos VRAM ni throughput. Los papers de [LoRA](https://arxiv.org/abs/2106.09685) y [adapters de Houlsby](https://arxiv.org/abs/1902.00751) estudian configuraciones concretas; sus porcentajes no son constantes que podamos trasladar a nuestro modelo.

## Ejercicio: encontrar el dato que falta en una promesa de ahorro

Alguien afirma «hemos reducido los parámetros entrenables un 90%, así que necesitamos un 90% menos de GPU». Enumera qué componentes de memoria quedan fuera de esa cuenta y diseña una medición antes/después con mismo batch, secuencia, precisión y dispositivo. La fórmula es un punto de partida para preguntar, no el resultado de la medición.

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

- [LoRA, Hu et al.](https://arxiv.org/abs/2106.09685).
- [Adapters, Houlsby et al.](https://arxiv.org/abs/1902.00751).

Siguiente: [LoRA: adaptar una matriz con dos factores y comprobar su merge](/posts/lora-rango-bajo-inicializacion-merge).
