---
id: "P104"
title: "Self-supervision: aprender a reconstruir antes de pedir etiquetas"
published: "2026-10-26T03:00:00Z"
locale: "es"
translationKey: "model-adaptation-p104"
slug: "self-supervision-denoising-aprender-sin-etiquetas"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P092", "P099", "P103"]
description: "Cómo convertir observaciones sin etiquetas en pares de entrenamiento sin filtrar el target. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Conseguir miles de observaciones puede resultar sencillo; conseguir miles de etiquetas fiables, no tanto. **Self-supervision** permite construir una tarea de entrenamiento a partir de los propios datos antes de pedir al modelo que resuelva una clasificación concreta.

Después de [construir la atención y comprobar su causalidad](/posts/causal-attention-transformer-futuro-paralelismo), cambiamos de pregunta: ¿qué objetivo merece la pena optimizar? Usaremos un **MLP** pequeño para ver la señal de aprendizaje sin añadir la complejidad de un modelo de lenguaje.

## Qué significa aprender sin etiquetas de clase

En aprendizaje supervisado, alguien puede etiquetar una medición como «fallo» o «funcionamiento normal». En self-supervision construimos el target a partir de una observación disponible. Por ejemplo, ocultamos parte de una imagen y pedimos reconstruirla, o usamos un prefijo de texto para predecir el siguiente token.

Sigue habiendo un target y una **loss**. Lo que cambia es su procedencia. «Sin etiquetas» suele significar sin anotaciones humanas específicas de la tarea; no significa que el entrenamiento carezca de una respuesta con la que comparar la predicción.

Nuestro objetivo será **denoising**: tomar una observación limpia `x`, añadir ruido al input y reconstruir `x`. La idea tiene antecedentes en los [denoising autoencoders de Vincent y colaboradores](https://jmlr.org/papers/v11/vincent10a.html). El laboratorio usa una sola red pequeña; no reproduce su arquitectura apilada ni sus experimentos.

<img src="/assets/visuals/model-adaptation/P104.svg" alt="Cómo convertir observaciones sin etiquetas en pares de entrenamiento sin filtrar el target. El diagrama sigue los datos y las operaciones específicas del experimento." width="617" height="954" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## La observación limpia se usa como target, no como input auxiliar

Cada muestra tiene ocho números. Dos contienen una señal que luego servirá para clasificar; los otros seis son **nuisance features**, variaciones que no determinan esa clase. En esta primera fase el modelo no recibe la etiqueta de clasificación.

El **encoder** transforma ocho features en dieciséis y después en una representación de ocho. Un **decoder** lineal transforma esa representación de nuevo en ocho valores. Encoder y decoder aprenden juntos.

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
def denoising_loss(model, clean, noise):
    corrupted = clean + noise
    return F.mse_loss(model(corrupted), clean)
```

`noise` tiene la misma forma que `clean`: una matriz `[batch, 8]`. La predicción recibe la suma, pero `mse_loss` la compara con la observación sin ese ruido añadido. Cambiar el segundo argumento por `corrupted` entrenaría otra tarea: reproducir también la perturbación que acabamos de introducir.

La **MSE** promedia los errores cuadrados sobre ejemplos y features. Si una coordenada se equivoca por 0,5, aporta 0,25 antes del promedio. La loss no distingue por sí sola qué coordenadas serán relevantes para una clasificación posterior.

## Denoising no obliga a descubrir la semántica que nos interesa

Aquí no hay un bottleneck dimensional estricto: la representación tiene tantas coordenadas como la entrada. El ruido y la transformación intermedia introducen restricciones, pero la red sigue teniendo capacidad para conservar información que no ayudará al siguiente objetivo.

Por eso no presentaremos una reconstrucción buena como prueba de una representación óptima. Si una feature irrelevante tiene mucha variación o una escala mayor, reconstruirla puede contribuir más a reducir MSE que conservar otra decisiva para la clase.

La decisión de cómo corromper importa. Un ruido pequeño puede enseñar estabilidad ante perturbaciones pequeñas. Un ruido que borre la señal necesaria puede volver la tarea ambigua. En texto, eliminar una negación puede cambiar el significado en vez de producir una vista equivalente.

## Qué aprendieron las tres ejecuciones

Reservamos 800 observaciones para entrenar y 160 para validation. Cada seed hace 400 updates con batch 64, Adam 0,003 y ruido gaussiano de desviación 0,2. Las coordenadas no se normalizan con estadísticas de test. El generador ya define sus escalas.

La tabla compara reconstrucción de las mismas observaciones limpias de validation antes y después del pretraining. No es una evaluación de clasificación ni una prueba específica de denoising sobre un conjunto de ruido nuevo.

<div role="region" aria-label="Reconstrucción limpia en validation" tabindex="0" style="overflow-x:auto;max-width:100%">

| Seed | MSE inicial | MSE final |
| --- | --- | --- |
| 7 | 0,431608 | 0,018630 |
| 19 | 0,392571 | 0,006330 |
| 31 | 0,458796 | 0,006421 |

</div>

<img src="/assets/interactive/model-adaptation/pretraining.svg" alt="Las tres seeds reducen MSE de reconstrucción limpia en validation durante 400 updates; la curva no mide todavía clasificación ni denoising sobre ruido de test." width="380" height="320" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Las tres redes reducen el error de reconstrucción. La diferencia entre seeds recuerda que compartir arquitectura y presupuesto no garantiza el mismo punto de llegada. Ninguna cifra permite concluir todavía que transferir estos pesos vaya a mejorar el siguiente modelo.

## La fuga de datos también existe antes del fine-tuning

Si el pretraining usa exactamente las filas reservadas para test downstream, la evaluación ya no representa el protocolo inductivo que afirmamos medir. Algunas investigaciones estudian escenarios transductivos, pero deben declararlo y compararlos como tales.

Aquí source y target tienen splits generados con seeds diferentes. Se guardan hashes de cada fila y se rechazan solapamientos exactos entre los seis splits. Esa prueba detecta duplicados; por sí sola no detectaría personas repetidas, documentos casi idénticos o mediciones de una misma sesión repartidas entre conjuntos reales.

## Garantías y límites

El laboratorio verifica que el target de reconstrucción es la observación limpia y que los splits contienen filas distintas. No mide calidad de imágenes, lenguaje, utilidad clínica ni capacidad general. Las etiquetas sintéticas existen para la fase posterior, pero la función de pretraining solo consume las features.

## Ejercicio: cambiar el target cambia lo que aprende la red

Antes de ejecutar otra variante, escribe qué ocurriría si la red recibiera el dato limpio y también tuviera que reconstruirlo. Después identifica qué información debe conservar y qué incentivo tendría para ignorar una nuisance feature. Formula una hipótesis; una loss más baja no basta como explicación de transferencia útil.

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

- [Denoising autoencoders, Vincent et al.](https://jmlr.org/papers/v11/vincent10a.html).
- [MSELoss, PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MSELoss.html).

Siguiente: [Pretraining y transfer learning: comprobar si empezar con pesos aprendidos ayuda](/posts/pretraining-transfer-learning-baseline-test-no-visto).
