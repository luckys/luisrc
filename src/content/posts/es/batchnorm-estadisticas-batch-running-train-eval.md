---
id: "DL-BATCHNORM"
title: "BatchNorm: normalizar un canal también introduce estado y dependencia del batch"
published: "2026-10-25T22:04:00Z"
locale: "es"
translationKey: "generalization-stability-dl-batchnorm"
slug: "batchnorm-estadisticas-batch-running-train-eval"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ACTIVATION-STABILITY", "DL-EVALUATION"]
description: "Qué estadísticas usa BatchNorm y por qué cambian entre train y eval. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

La misma muestra puede producir activaciones normalizadas distintas si cambia el resto de su batch. En **BatchNorm** esa dependencia forma parte de la operación; no es necesariamente un fallo de reproducibilidad.

Después de [seguir activaciones y gradientes](/posts/activations-saturacion-relu-gradientes-profundidad), examinamos qué estadística introduce esta capa y qué estado conserva.

## En una matriz N×C, cada canal usa las muestras del grupo

Para una entrada `(N,C)`, BatchNorm calcula una media μ y una varianza v por canal sobre el eje de muestras. La transformación es `γ·(x−μ)/sqrt(v+ε)+β`, con escala γ y desplazamiento β aprendidos si se habilitan.

Normalizar no obliga a que la salida final tenga siempre media cero y varianza uno: ε modifica la división y γ/β pueden cambiar ambas. Los parámetros permiten que el modelo adapte la transformación.

En `packages/generalization-stability/probes.py`, el cálculo manual del caso sin affine es:

```python
    manual_batch = (a-a.mean(0))/torch.sqrt(a.var(0,unbiased=False)+1e-5)
```

El test lo contrasta con `BatchNorm1d`. Usamos una matriz 4×3 y mantenemos la primera fila mientras multiplicamos por diez las otras tres. La salida normalizada de la primera fila cambia, porque sus referencias también cambiaron.

<img src="/assets/visuals/generalization-stability/DL-BATCHNORM.svg" alt="Qué estadísticas usa BatchNorm y por qué cambian entre train y eval. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="302" height="508" loading="lazy" style="width:100%;max-width:302px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-BATCHNORM.svg).

## La varianza del forward y la acumulada no usan la misma convención

En PyTorch, el forward train de este caso utiliza varianza con divisor N. La actualización de `running_var` usa la estimación con divisor N−1. Conviene declararlo: copiar una fórmula distinta puede producir pequeñas discrepancias que no son ruido de redondeo.

Con momentum de estadísticas 0,1, la actualización es `running_nuevo=0,9·running_anterior+0,1·estadística_batch`. Partimos de media cero y varianza uno; el informe conserva valores esperados y observados tras el primer batch.

Este momentum no es el buffer de momentum de SGD. Coinciden en parte del vocabulario, pero sus estados y ecuaciones cumplen funciones diferentes.

## Eval usa running stats cuando el módulo las conserva

Con el comportamiento habitual `track_running_stats=True`, eval utiliza las estadísticas acumuladas del entrenamiento. Por eso no basta con guardar weights y bias de las capas lineales: los buffers de BatchNorm forman parte del `state_dict`.

Con `track_running_stats=False`, también en eval se usan estadísticas del batch. El probe ejecuta y comprueba ese caso, evitando la regla incompleta de «eval siempre usa las acumuladas».

Una entrada `(1,3)` en modo train no aporta más de un valor por canal y el caso probado se rechaza. La misma forma en eval funciona con running stats disponibles. No generalizamos esta observación a cualquier tensor con batch size uno: dimensiones adicionales pueden aportar otros valores al cálculo.

## Dónde la colocamos en la MLP

En `packages/generalization-stability/training.py`, la fábrica de normalización devuelve:

```python
                return nn.BatchNorm1d(width, eps=options.get('epsilon',1e-5),
                                      momentum=options.get('momentum',.1), dtype=torch.float64)
```

La aplicamos entre Linear y ReLU en ambas capas ocultas. Los 64 canales reciben escala y bias aprendidos, añadiendo 256 parámetros entre las dos capas. La evaluación de curvas usa eval para train y validation, de modo que la métrica comparada tenga el mismo modo.

El objetivo usado durante los updates sigue empleando las estadísticas del batch train. Es otra razón para distinguir loss online y loss a pesos fijos en eval.

## Los resultados no equivalen a una garantía de generalización

En seed 7, la variante termina con validation MSE 0,190381 frente a 0,204701 de la baseline. En las otras dos inicializaciones no mejora su final correspondiente. El protocolo no ajusta tasas específicas para cada arquitectura.

BatchNorm modifica el cálculo y puede afectar a la optimización y a la regularización efectiva. El nombre de la capa no permite deducir cuál de esos efectos domina. Tampoco usamos el experimento para afirmar que funciona mejor con cualquier tamaño de batch.

Antes de añadirla revisaría qué ejes representan canales, si las estadísticas de train son pertinentes en inferencia y qué pasa con los grupos pequeños. En pipelines con distribución cambiante, unas running stats bien guardadas pueden seguir siendo referencias inadecuadas.

## Ejercicio: conserva la muestra y cambia su contexto

En el visor cambia entre los dos batches del probe. Localiza el primer canal de la primera muestra y explica por qué varía con BatchNorm aunque esa entrada no cambie. Después identifica qué valores guardarías para reproducir una predicción en eval.

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

- [BatchNorm original](https://arxiv.org/abs/1502.03167).
- [Contrato de BatchNorm1d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.BatchNorm1d.html).

Continúa con [LayerNorm: elegir los ejes que normalizas cambia la representación](/posts/layernorm-ejes-features-batchnorm-diferencias).
