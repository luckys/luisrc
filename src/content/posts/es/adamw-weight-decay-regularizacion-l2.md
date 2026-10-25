---
id: "DL-ADAMW"
title: "AdamW y weight decay: por qué añadir L2 a Adam cambia otra cosa"
published: "2026-10-25T20:04:00Z"
locale: "es"
translationKey: "training-dynamics-dl-adamw"
slug: "adamw-weight-decay-regularizacion-l2"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-ADAM"]
description: "Por qué L2 acoplada y weight decay desacoplado producen updates distintos. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

Añadir `weight_decay=0.01` a **Adam** y a **AdamW** no describe necesariamente la misma actualización. En un caso la penalización entra en las estadísticas adaptativas; en el otro se aplica una contracción separada de los parámetros.

La diferencia se entiende mejor con [los momentos de Adam](/posts/adam-momentos-bias-correction-epsilon) visibles. Así podemos seguir dónde termina cada término en lugar de atribuir el cambio al nombre de la clase.

## En SGD simple, L2 y una contracción pueden coincidir

Si definimos `J(θ) = L_datos(θ) + (λ/2)‖θ‖²`, el gradiente es `g_datos + λθ`. Un paso de SGD sin momentum da `θ_nuevo = θ − η(g_datos + λθ)`.

Reordenando obtenemos `(1−ηλ)θ − ηg_datos`. Es una contracción por `1−ηλ` y un paso de datos. La equivalencia depende de esta regla SGD y de la convención λ/2 en la penalización. Si se escribe λ‖θ‖², aparece un factor 2 en el gradiente.

Con momentum, incorporar λθ al buffer y aplicar una contracción aparte ya no son automáticamente la misma operación. Esa equivalencia algebraica de SGD simple no debe extenderse a cualquier optimizador.

## En Adam acoplado, la penalización también modifica m y v

Nuestra variante Adam usa `g = g_datos + λθ` antes de actualizar los momentos. Por tanto λθ influye tanto en la dirección estimada como en la escala adaptativa.

AdamW conserva g_datos para esos momentos y aplica por separado `θ_base = (1−ηλ)θ`. Después resta el paso adaptativo de datos. El fragmento de `packages/training-dynamics/optimizers.py` que distingue ambas rutas es:

```python
            g = raw if self.kind == 'adamw' else raw + self.decay * p
```

Y al final del step:

```python
            base = p * (1 - lr * self.decay) if self.kind == 'adamw' else p
            result.append(base - lr * direction)
```

La separación propuesta en el trabajo sobre **decoupled weight decay** permite controlar ese término sin introducirlo en las estimaciones adaptativas. No significa que λ deje de necesitar ajuste o que el schedule deje de afectarlo: aquí la contracción contiene ηλ.

<img src="/assets/visuals/training-dynamics/DL-ADAMW.svg" alt="Por qué L2 acoplada y weight decay desacoplado producen updates distintos. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="372" height="817" loading="lazy" style="width:100%;max-width:372px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/DL-ADAMW.svg).

## Un gradiente de datos cero deja ver la diferencia

Tomemos un parámetro inicial θ=2, gradiente de datos cero, η=0,01 y λ=0,1, con estados nuevos. Adam acoplado introduce g=0,2 en sus momentos. Después de la corrección, la dirección inicial es aproximadamente 1 y el parámetro queda en 1,9900000005.

AdamW mantiene momentos de datos cero y aplica la contracción `2·(1−0,01·0,1)`: termina en 1,998. El informe conserva ambos resultados y un test los compara con PyTorch.

Es un tensor de gradiente presente cuyo valor es cero. No es `grad=None`. Nuestra implementación didáctica requiere gradientes densos para todos los parámetros; no modela el comportamiento de parámetros omitidos por el optimizador. Esa distinción importa cuando se congelan capas o no participan en el forward.

## Qué regularizamos en este laboratorio

Aplicamos decay 0,01 a todos los parámetros de la MLP, incluidos bias, para que la comparación tenga una regla visible. No es una recomendación de aplicar decay a cualquier tensor de cualquier arquitectura.

En un entrenamiento real se pueden crear grupos de parámetros con reglas diferentes. Excluir bias o parámetros de normalización es una decisión que debe documentarse y verificarse; cambiar los grupos sin registrarlo hace difícil reproducir el experimento.

También dejamos explícitos los argumentos de la implementación de referencia. En PyTorch 2.14, Adam ofrece la opción `decoupled_weight_decay`; el contraste de Adam usa su valor falso, mientras AdamW usa la actualización desacoplada. No basta con confiar en una etiqueta informal del experimento.

## Una loss de datos algo mayor no demuestra peor regularización

En seed 7, Adam termina con validation BCE 0,020754 y AdamW con 0,023010. Ambos usan η=0,01 y 640 updates, pero solo AdamW tiene decay en la comparación principal. Además registramos BCE de datos, sin sumarle una penalización L2 a la cifra mostrada.

No sería correcto concluir que «regularizar empeora» ni que AdamW es peor optimizador. Cambiamos la regla de actualización y añadimos decay; la comparación sirve para observar esas configuraciones en un dataset fácil, no para aislar una ganancia de generalización.

El control escalar sí aísla la diferencia mecánica con el mismo λ y gradiente. Para estudiar generalización hacen falta otros experimentos, que se abordarán al introducir overfitting y evaluación de modelos.

## Ejercicio: identifica qué entra en cada buffer

Repite el ejemplo escalar con dos steps de gradiente de datos cero. En Adam acoplado, el segundo término λθ usa el parámetro actualizado. En AdamW, comprueba la contracción repetida. Anota qué estado habría que guardar para continuar cada trayectoria sin reiniciarla.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [laboratorio del monorepo](https://github.com/luckys/luisrc-blog-examples/tree/main/packages/training-dynamics) incluye [optimizadores](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/training-dynamics/optimizers.py), [loop y partición de batches](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/training-dynamics/training.py), protocolo y observaciones. Reutiliza el [modelo NumPy de la serie anterior](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py), sin reemplazar sus resultados originales.

Desde la raíz del repositorio de ejemplos, con Docker y la image CPU fijada en `runtime.json`:

```bash
pnpm --dir packages/training-dynamics test:container
pnpm --dir packages/training-dynamics exercise
pnpm --dir packages/training-dynamics verify
pnpm --dir packages/training-dynamics test
```

Si la image no está preparada, `pnpm --dir packages/training-dynamics runtime:fetch` descarga el digest declarado. No hace falta instalar paquetes Python en el equipo. `verify` vuelve a entrenar y recalcula controles; no se limita a revisar hashes.

## Explorar las curvas observadas

<iframe src="/assets/interactive/training-dynamics/explorer.html" title="Comparar entrenamientos, presupuestos y acumulación con observaciones reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor en una página completa](/assets/interactive/training-dynamics/explorer.html). Las tablas conservan los números de cada checkpoint. Las ablations usan seed 7; la comparación principal permite elegir tres inicializaciones.

## Garantías y límites

Trabajamos con 256 puntos train y 128 validation, generados por separado alrededor de cuatro centros XOR, sin test evaluado. Las curvas se entrenan con **NumPy** en float64. Las reglas de actualización se contrastan con **PyTorch** CPU en tests de varios pasos y gradientes controlados. No hay benchmark de tiempo, medidas de memoria ni evidencia para elegir un optimizador en cualquier tarea.

El informe fija datos, orden, inicializaciones y configuración; publica también resultados que no mejoran la baseline. Las tolerancias numéricas permiten pequeñas diferencias de redondeo. Una curva descendente en este juguete no demuestra calibración, robustez o rendimiento en producción.

## Referencias

- [Decoupled Weight Decay Regularization](https://arxiv.org/abs/1711.05101).
- [Referencia de AdamW](https://docs.pytorch.org/docs/2.14/generated/torch.optim.AdamW.html).
- [Opciones de Adam en PyTorch 2.14](https://docs.pytorch.org/docs/2.14/generated/torch.optim.Adam.html).

Continúa con [Learning rate schedules: poner un reloj al tamaño del paso](/posts/learning-rate-schedules-warmup-cosine-updates).
