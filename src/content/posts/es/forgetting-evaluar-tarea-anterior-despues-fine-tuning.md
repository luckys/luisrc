---
id: "DL-FORGETTING"
title: "Forgetting: medir qué cambia en la tarea anterior después de adaptar"
published: "2026-10-26T03:08:00Z"
locale: "es"
translationKey: "model-adaptation-dl-forgetting"
slug: "forgetting-evaluar-tarea-anterior-despues-fine-tuning"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ADAPTERS"]
description: "Cómo separar degradación con el módulo activo, preservación de pesos y recuperación de la base. Código ejecutado, decisiones y límites de un laboratorio CPU reproducible."
author: "Luis Ramírez Calle"
series: "Adaptar modelos: del pretraining a LoRA y forgetting"
tags: ["deep-learning", "pretraining", "fine-tuning", "pytorch"]
---

Mejorar una clasificación y empeorar una tarea anterior pueden ocurrir en el mismo entrenamiento. Para detectar **forgetting** necesitamos volver a medir esa tarea anterior; contar pesos modificados no basta.

Después de [adaptar con una rama residual](/posts/adapters-bottleneck-residual-peft), evaluamos la reconstrucción que aprendió el encoder antes de especializarse. Conservamos el decoder original para no ocultar el cambio entrenando otro que se acomode a la representación nueva.

## Qué se considera tarea anterior en este experimento

El pretraining aprendió a reconstruir observaciones source. La adaptación aprendió una clasificación target. Para medir retención, aplicamos el decoder original a la representación adaptada de filas source test que no participaron en los optimizers.

Esta evaluación produce una **proxy de retención**: cambio de MSEen una tarea definida. No es una medida de todas las capacidades del modelo ni una demostración de catastrophic forgetting en lenguaje natural.

El [trabajo de Kirkpatrick y colaboradores](https://doi.org/10.1073/pnas.1611835114) estudia degradación de tareas anteriores y una forma de proteger pesos relevantes. Nuestro experimento no implementa EWC ni reproduce sus escenarios; toma en serio la necesidad de evaluar antes y después.

<img src="/assets/visuals/model-adaptation/DL-FORGETTING.svg" alt="Cómo separar degradación con el módulo activo, preservación de pesos y recuperación de la base. El diagrama sigue los datos y las operaciones específicas del experimento." width="688" height="832" loading="lazy" style="width:100%;max-width:380px;height:auto" />

## El decoder se mantiene fijo para observar el efecto de la adaptación

Fragmento de las fuentes ejecutadas del [laboratorio completo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/model-adaptation); los imports y el contexto están en los archivos enlazados al final.

```python
def retained_reconstruction(model, pretrained, features):
    # Keep the original reconstruction head; measure the ACTIVE adapted representation.
    with torch.no_grad():
        return F.mse_loss(pretrained.decoder(model.representation(features)), features).item()
```

`representation` incluye el adapter si está activo. En LoRAincluye la actualización A/B del encoder. El decoder sigue siendo el que se entrenó en source. Así medimos la función que obtiene esa tarea previa con el nuevo camino activo.

Podría existir una transformación invertible entre representaciones antiguas y nuevas que otro decoder aprendiera a compensar. Por eso un aumento de MSEcon decoder fijo no demuestra que toda la información haya desaparecido. Sí demuestra que el sistema anterior deja de reconstruir igual si usa la representación adaptada.

Entrenar un decoder nuevo respondería otra pregunta: cuánta información podemos recuperar después mediante readaptation. Necesitaría su propio presupuesto y datos. No debemos mezclar ambas evaluaciones.

## El resultado con seed 7 separa las garantías

<div role="region" aria-label="Retención source test con decoder original" tabindex="0" style="overflow-x:auto;max-width:100%">

| Modo | MSE antes | MSE después |
| --- | --- | --- |
| head | 0,018179 | 0,018179 |
| gradual | 0,018179 | 2,265996 |
| full | 0,018179 | 7,395124 |
| lora | 0,018179 | 4,717292 |
| adapter | 0,018179 | 1,584621 |

</div>

<img src="/assets/interactive/model-adaptation/retention.svg" alt="MSE de reconstrucción source test después de adaptar con seed 7. Head conserva el valor previo; full, gradual, LoRA y adapter activos aumentan el error con el decoder original." width="380" height="270" loading="lazy" style="width:100%;max-width:380px;height:auto" />

Head conserva exactamente el mismo encoder y decoder, por lo que su MSE no cambia. Full modifica el encoder y aumenta mucho el error. LoRA y adapter conservan los pesos base, pero sus módulos activos también elevan MSE.

Scratch queda fuera de esta tabla: nunca aprendió la tarea source. Comparar su reconstrucción con la de otro modelo preentrenado no mediría «olvido». Linear también queda fuera, porque clasifica directamente las ocho features y no tiene una representación compatible con el decoder retenido.

Las otras seeds están disponibles en el visor. No escogemos la que cuente la historia más cómoda: el reporte conserva las tres y sus predicciones target completas.

## Desactivar un módulo recupera una base; no conserva la función activa

En LoRA y adapter podemos mantener una base inmutable y retirar el módulo para volver a su representación original. Eso facilita rollback o servir tareas distintas con diferentes adaptaciones.

Si el requisito es que un único modelo activo conserve la reconstrucción mientras clasifica, retirar el módulo para reconstruir cambia el sistema evaluado. Puede ser una solución válida por routing de tareas, pero hay que explicarla como tal.

La afirmación «no hay forgetting porque los pesos originales siguen intactos» mezcla almacenamiento y comportamiento. Conviene especificar si hablamos de capacidad recuperable al cambiar módulos o capacidad presente con la adaptación seleccionada.

## Qué estrategias podrían preservar la tarea previa

**Replay** mezcla muestras de la tarea anterior durante la adaptación. Puede ayudar a mantener su objetivo, con coste de datos, privacidad y cómputo. **Distillation** penaliza diferencias respecto al modelo anterior; exige elegir qué salidas preservar y no garantiza todos los comportamientos posibles.

**Regularization** puede limitar cuánto cambian pesos considerados importantes. EWC usa una estimación de importancia, no una prohibición general de aprender. Congelar más capas o reducir learning rate también limita cambios, pero puede impedir la mejora target que buscamos.

Los módulos separados permiten conservar la base y elegir una adaptación por tarea. A cambio necesitamos versionado, routing correcto y evaluación de cada combinación. Ninguna mitigación elimina la necesidad de medir retención y calidad target juntas.

No implementamos esas alternativas en el laboratorio actual. Presentarlas como soluciones ya validadas con nuestra tabla inventaría evidencia. Para compararlas habría que fijar de nuevo splits, criterios y presupuesto antes de observar resultados.

## Garantías y límites

El test source es distinto de source train y validation. El test target se consulta después de todos los entrenamientos. Sus métricas tienen unidades distintas: no restamos accuracy de clasificación y MSE de reconstrucción para fabricar una puntuación única.

No se ajustaron hyperparameters tras observar el test. La variación entre tres seeds no basta para cuantificar todos los riesgos de una adaptación real. En un proyecto, la suite de retención debería incluir tareas y fallos concretos que interese evitar, además de métricas agregadas.

## Ejercicio: escribir una condición de aceptación conjunta

Propón una mejora target mínima y una degradación source máxima con unidades explícitas. Decide qué harás si mejora una y empeora la otra. Ese criterio convierte «el modelo parece mejor» en una decisión comprobable antes del siguiente entrenamiento.

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

- [Overcoming catastrophic forgetting, Kirkpatrick et al.](https://doi.org/10.1073/pnas.1611835114).

Para proponer otra adaptación, empieza por conservar este protocolo como referencia y registra uno nuevo antes de consultar sus holdouts. Continúa con [CPU, GPU y CUDA: medir el entrenamiento sin confundir envío y ejecución](/posts/cpu-gpu-cuda-medir-entrenamiento-sincronizacion).
