---
id: "DL-LAYERNORM"
title: "LayerNorm: elegir los ejes que normalizas cambia la representación"
published: "2026-10-25T22:05:00Z"
locale: "es"
translationKey: "generalization-stability-dl-layernorm"
slug: "layernorm-ejes-features-batchnorm-diferencias"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-BATCHNORM"]
description: "Cómo LayerNorm conserva independencia entre muestras y qué información puede eliminar. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Cambiar BatchNorm por **LayerNorm** no es eliminar una dependencia sin alterar nada más. Cambian los ejes usados para calcular las referencias y, con ellos, la información que conserva la representación.

Tras [entender BatchNorm y sus buffers](/posts/batchnorm-estadisticas-batch-running-train-eval), mantenemos los mismos valores y comparamos otra forma de normalizar.

## Normalized_shape indica los últimos ejes de cada entrada

Con una matriz `(N,C)` y `LayerNorm(C)`, calculamos media y varianza sobre C para cada fila. La muestra no necesita mirar las otras filas del batch.

Para una entrada `(batch,tokens,features)` y `LayerNorm(features)`, la operación se aplica sobre las features de cada token. Usar `LayerNorm((tokens,features))` describiría otra normalización, sobre los dos últimos ejes. La shape del constructor es parte del significado del modelo.

En `packages/generalization-stability/probes.py`:

```python
    manual_layer = (a-a.mean(1,keepdim=True))/torch.sqrt(a.var(1,unbiased=False,keepdim=True)+1e-5)
```

El test compara el resultado con PyTorch sin affine. Mantener dimensiones de tamaño uno permite aplicar la resta y división a cada fila mediante broadcasting intencionado.

<img src="/assets/visuals/generalization-stability/DL-LAYERNORM.svg" alt="Cómo LayerNorm conserva independencia entre muestras y qué información puede eliminar. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="294" height="508" loading="lazy" style="width:100%;max-width:294px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-LAYERNORM.svg).

## Cambiar compañeros de batch deja intacta esta muestra

En el probe, la primera fila vale `[1,2,4]`. Los batches A y B conservan esa fila y cambian las demás. Su resultado LayerNorm es idéntico; con BatchNorm, no.

Eso describe la independencia respecto a otras muestras de esta operación. No implica que todo el modelo sea independiente del batch si contiene otras capas que mezclan ejemplos, una loss conjunta o atención entre elementos de ese eje.

El visor permite inspeccionar la misma matriz con ambas normalizaciones. No comparamos ejes distintos usando solo un resumen escalar: los valores por fila y canal dejan ver qué cambia.

## No hay running stats, pero puede haber parámetros aprendidos

LayerNorm usa estadísticas de su entrada tanto en train como en eval. En su configuración habitual tiene escala y bias por elemento de `normalized_shape`, compartidos entre las posiciones no incluidas en esos ejes.

En nuestra MLP el constructor está en `packages/generalization-stability/training.py`:

```python
                return nn.LayerNorm(width, eps=options.get('epsilon',1e-5), dtype=torch.float64)
```

Cada capa oculta añade 64 escalas y 64 bias. Entre las dos, son 256 parámetros adicionales, igual cantidad que en nuestra variante BatchNorm aunque su cálculo sea diferente.

Que no conserve running mean o running variance no significa que no haya estado entrenable que guardar. Y que LayerNorm haga el mismo cálculo de normalización en ambos modos no vuelve innecesario eval si el modelo contiene Dropout u otras capas sensibles al modo.

## Normalizar una única feature puede eliminar su valor útil

Si se aplica LayerNorm a un escalar, la media coincide con ese valor y la parte centrada queda en cero. Tras la transformación affine solo queda el desplazamiento aprendido. No se conserva la magnitud original de la forma que quizá esperaba el programa.

Por eso nuestra regresión no aplica `LayerNorm(1)` directamente a x: normaliza las 64 activaciones ocultas. Incluso allí se modifica la representación y su dependencia de las escalas. Eliminar información de magnitud puede ser deseable o perjudicial según el problema.

Esta decisión requiere entender los ejes antes de buscar una configuración que compile. La misma shape de salida no garantiza la misma información disponible para las capas siguientes.

## Los tres runs no justifican una preferencia universal

La variante termina con validation MSE 0,214689, 0,200828 y 0,205204 para seeds 7, 19 y 31. La baseline correspondiente obtiene 0,204701, 0,205393 y 0,195268: mejora una comparación y empeora dos.

Los datos y matrices iniciales coinciden, pero la arquitectura y su dinámica cambian. No hemos buscado hiperparámetros óptimos para cada una. Elegiría a partir de la estructura de los tensores, la dependencia del batch permitida y experimentos comparables, no del orden en una lista de capas populares.

## Ejercicio: especifica los ejes en palabras

Para `(8,20,64)`, explica qué valores contribuyen a una media con `LayerNorm(64)` y cuáles con `LayerNorm((20,64))`. Después describe por qué aplicar la misma fórmula sobre el eje de ocho muestras sería otra operación aunque la salida conservara su shape.

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

- [Layer Normalization](https://arxiv.org/abs/1607.06450).
- [Contrato de LayerNorm](https://docs.pytorch.org/docs/2.14/generated/torch.nn.LayerNorm.html).

Continúa con [Dropout: qué se elimina, qué se escala y por qué no siempre mejora](/posts/dropout-mascaras-escalado-generalizacion).
