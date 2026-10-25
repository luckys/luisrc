---
id: "DL-WEIGHT-DECAY"
title: "Weight decay: decidir qué contraer y comprobar qué ocurre fuera de train"
published: "2026-10-25T22:07:00Z"
locale: "es"
translationKey: "generalization-stability-dl-weight-decay"
slug: "weight-decay-grupos-parametros-generalizacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-DROPOUT", "DL-ADAMW"]
description: "Cómo aplicar decay de forma explícita sin usar la norma de pesos como sustituto de validación. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Una norma de pesos menor no certifica que un modelo generalice mejor. **Weight decay** modifica los updates; su utilidad se comprueba con el comportamiento que nos interesa fuera de train, no solo mirando si los parámetros se han contraído.

Después de [observar dropout](/posts/dropout-mascaras-escalado-generalizacion), aplicamos otra intervención manteniendo el dataset, las matrices iniciales y el presupuesto.

## La regla del update y el resultado estadístico son preguntas distintas

En AdamW, el decay desacoplado contrae el parámetro mediante un factor como `1−ηλ`, separado del paso adaptativo de datos. La distinción frente a añadir una penalización L2 al gradiente de Adam ya se desarrolla [en el bloque de optimizadores](/posts/adamw-weight-decay-regularizacion-l2).

Aquí la pregunta es qué contraemos y qué cambia en las curvas. Que el mecanismo esté bien implementado no garantiza una mejora de validation para cualquier λ.

Una penalización demasiado fuerte puede dificultar representar la señal. Una demasiado débil puede apenas cambiar la trayectoria. El learning rate y la cantidad de updates también influyen en la contracción acumulada.

## Declaramos los grupos de parámetros

En `packages/generalization-stability/training.py`, el optimizador separa matrices y vectores:

```python
    matrices = [p for p in model.parameters() if p.ndim > 1]
    vectors = [p for p in model.parameters() if p.ndim == 1]
    return torch.optim.AdamW([{'params':matrices,'weight_decay':weight_decay},
                             {'params':vectors,'weight_decay':0.}],lr=lr,foreach=False)
```

En esta arquitectura las matrices son los weights de Linear y los vectores incluyen sus bias. La variante de decay usa λ=0,01 solo en las matrices. Los tests comprueban tanto la pertenencia a cada grupo como sus opciones.

Es una regla explícita para este modelo, no una clasificación universal de cualquier tensor por su número de ejes. Otras arquitecturas pueden requerir grupos distintos. Si se añadieran parámetros escalares u otras estructuras, habría que revisar esa selección.

<img src="/assets/visuals/generalization-stability/DL-WEIGHT-DECAY.svg" alt="Cómo aplicar decay de forma explícita sin usar la norma de pesos como sustituto de validación. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="307" height="508" loading="lazy" style="width:100%;max-width:307px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-WEIGHT-DECAY.svg).

## La comparación no mezcla decay con otra activation

La baseline usa también AdamW, pero con λ=0. La variante solo cambia el decay de matrices a 0,01. No añade Dropout ni normalizaciones. Las dos mantienen tasa 0,01 y 2000 updates full-batch.

Esto permite atribuir la diferencia de trayectoria a esa intervención bajo el protocolo fijado. No equivale a haber ajustado el mejor λ ni a comparar todos los optimizadores disponibles.

En el ejemplo didáctico de AdamW anterior se aplicaba decay a todos los parámetros para aislar la ecuación. Aquí cambiamos deliberadamente el contrato de grupos y lo documentamos; reutilizar un nombre de opción no basta para reproducir una configuración.

## El resultado cambia con la inicialización

En seed 7, validation MSE final pasa de 0,204701 a 0,199838. En seed 19 pasa de 0,205393 a 0,205906; en seed 31, de 0,195268 a 0,204208.

Hay una mejora y dos empeoramientos en estas tres comparaciones. No convertimos la primera en una recomendación general ni eliminamos las otras del informe. Las tres usan el mismo dataset, así que tampoco representan tres muestreos independientes de una población de tareas.

El visor conserva train MSE, validation MSE y norma total de parámetros. Esta última es un diagnóstico del modelo concreto: ni mide directamente complejidad funcional ni garantiza resistencia al ruido.

## Una norma también depende de cómo parametrizamos el modelo

Transformaciones y reescalados pueden relacionar representaciones de una función sin conservar la misma norma de todos sus parámetros. Comparar normas entre arquitecturas que añaden normalizaciones resulta todavía menos directo.

Por eso una tabla de normas no sustituye evaluación. Tampoco se debe interpretar que un peso pequeño representa necesariamente una feature poco importante: el efecto depende de las demás capas y de la escala de las entradas.

En un proyecto fijaría qué métrica se pretende mejorar y un protocolo para comparar λ sin usar el test como mecanismo de elección. El laboratorio no realiza una búsqueda de hiperparámetros ni una evaluación final de un modelo seleccionado.

## Ejercicio: descubre una configuración que un nombre no describe

Enumera qué faltaría saber si un informe dijera únicamente «AdamW, decay 0,01». Incluye grupos, tasa, duración y schedule. Después explica por qué sería injustificado comparar la norma total de la variante BatchNorm con la baseline y concluir que una de las dos es más compleja por ese único número.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [entrenamiento](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/generalization-stability/training.py), los [probes numéricos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/generalization-stability/probes.py), protocolo, tests y observaciones.

Desde su raíz, con Docker y la image CPU fijada por digest:

```bash
pnpm --dir packages/generalization-stability test:container
pnpm --dir packages/generalization-stability exercise
pnpm --dir packages/generalization-stability verify
pnpm --dir packages/generalization-stability test
```

Si falta el runtime, `pnpm --dir packages/generalization-stability runtime:fetch` lo descarga. No requiere paquetes Python instalados en el host. Verify vuelve a entrenar y recalcula controles; no se limita a comparar hashes.

## Explorar curvas y mecanismos

<iframe src="/assets/interactive/generalization-stability/explorer.html" title="Explorar generalización, normalización, initialization y clipping con observaciones reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor completo](/assets/interactive/generalization-stability/explorer.html). Muestra datos archivados; el navegador no entrena ni ejecuta PyTorch. Distingue el último modelo, el mejor observado y el elegido por la política de parada.

## Garantías y límites

Los 18 entrenamientos usan un mismo dataset contaminado y tres inicializaciones emparejadas. El estudio de bias–variance usa otro diseño sin esa contaminación; los controles de capas y clipping son experimentos separados. No se presenta un único mecanismo como explicación de todos los resultados.

No hay test final, GPU, benchmark de tiempo o recomendación universal. Validation se reutiliza para observar y elegir checkpoints: sus mínimos no son una evaluación independiente del modelo seleccionado.

## Referencias

- [Decoupled Weight Decay Regularization](https://arxiv.org/abs/1711.05101).
- [AdamW y sus opciones](https://docs.pytorch.org/docs/2.14/generated/torch.optim.AdamW.html).

Continúa con [Early stopping: detenerse y recuperar el mejor checkpoint son dos decisiones](/posts/early-stopping-patience-mejor-checkpoint).
