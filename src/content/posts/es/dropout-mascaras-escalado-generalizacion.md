---
id: "DL-DROPOUT"
title: "Dropout: qué se elimina, qué se escala y por qué no siempre mejora"
published: "2026-10-25T22:06:00Z"
locale: "es"
translationKey: "generalization-stability-dl-dropout"
slug: "dropout-mascaras-escalado-generalizacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-LAYERNORM"]
description: "Cómo funciona inverted dropout y cómo comparar sus métricas sin mezclar modos. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Añadir **Dropout** puede aumentar la pérdida de entrenamiento y no mejorar validation. Para interpretar el resultado primero hay que saber qué red estamos evaluando: durante train aplicamos máscaras; en eval usamos otra transformación.

Después de [elegir ejes de normalización](/posts/layernorm-ejes-features-batchnorm-diferencias), añadimos una intervención que modifica aleatoriamente activaciones sin cambiar el número de parámetros de la MLP.

## Inverted dropout conserva una media local

Para una activación a y probabilidad p de eliminarla, usamos una máscara m que vale uno con probabilidad `1−p`. La salida train es `m·a/(1−p)`. Su esperanza, manteniendo a fija, es a.

El factor compensa que algunas activaciones se conviertan en cero. No significa que cada máscara conserve exactamente la media del batch ni que toda la red no lineal produzca la misma salida esperada que su versión sin máscaras.

En eval, el módulo de PyTorch es la identidad. No hay que volver a multiplicar por `1−p` como si utilizáramos otra convención de dropout.

## El probe permite ver ceros y escala sin mezclar entrenamiento

En `packages/generalization-stability/probes.py`:

```python
        dropout = nn.Dropout(.2)
        x = torch.ones(20000,3,dtype=torch.float64)
        y = dropout(x)
        dropout.eval()
```

Sobre 60 000 elementos observamos solo 0 y 1,25. La fracción de ceros es 0,201917 y la media, 0,997604. El modo eval recupera exactamente la entrada de unos.

La cercanía de esa media a uno ilustra el comportamiento del muestreo fijado; no afirma igualdad exacta de cada realización. El valor 1,25 viene de `1/(1−0,2)` y no es un parámetro aprendido.

<img src="/assets/visuals/generalization-stability/DL-DROPOUT.svg" alt="Cómo funciona inverted dropout y cómo comparar sus métricas sin mezclar modos. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="334" height="508" loading="lazy" style="width:100%;max-width:334px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-DROPOUT.svg).

## La MLP usa otra probabilidad declarada

El experimento principal fija p=0,15 después de cada ReLU. En el forward de `packages/generalization-stability/training.py`:

```python
        h = self.dropout(torch.relu(self.norm_first(self.first(x))))
        h = self.dropout(torch.relu(self.norm_second(self.second(h))))
```

Las dos llamadas al módulo generan máscaras nuevas; compartir el objeto no implica compartir una máscara. La comparación parte de las mismas matrices lineales y conserva una seed de dropout separada de la inicialización.

El número de parámetros sigue siendo 4353. Eso no vuelve idénticos los objetivos de train: ahora el gradiente depende también de la máscara aplicada en ese forward.

## Las métricas se comparan en el mismo modo

La loss online registrada durante el update usa el forward con máscara. Los checkpoints vuelven a calcular train y validation en eval, sin máscaras, con los mismos pesos. Comparar esas dos métricas de evaluación resulta más claro que interpretar una diferencia de modos como una brecha de generalización.

Una loss train con dropout mayor que validation no demostraría por sí sola ausencia de sobreajuste. Puede reflejar que el cálculo de entrenamiento se ha hecho deliberadamente más difícil.

Los tests del probe comprueban escala, ceros e identidad eval. Los entrenamientos completos registran además las curvas y predicciones para poder observar qué ocurre en la tarea real del laboratorio.

## En este protocolo, el final no mejora la baseline

Las validation MSE finales son 0,211195, 0,229382 y 0,209394. Las tres superan sus baselines respectivas: 0,204701, 0,205393 y 0,195268.

El resultado no demuestra que Dropout sea inútil. Esta red, cantidad de datos, probabilidad y presupuesto no aportan una mejora final. Su mejor checkpoint observado tampoco es una recomendación lista para usar: elegirlo supone consultar validation a lo largo del recorrido.

La intervención puede limitar ajustes frágiles, pero también dificultar representar la señal. En un dataset pequeño con una observación contaminada, revisar los datos sigue siendo una decisión distinta de regularizar la red.

## Ejercicio: deriva la escala antes de elegir p

Calcula los valores posibles de la salida si a=2 y p=0,25. Después explica por qué conservar la esperanza de esa activación no basta para conservar la esperanza de una pérdida cuadrática aplicada a la salida de toda la red. Compara en el visor loss online y MSE train en eval.

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

- [Dropout, artículo original](https://www.jmlr.org/papers/v15/srivastava14a.html).
- [Dropout en PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Dropout.html).

Continúa con [Weight decay: decidir qué contraer y comprobar qué ocurre fuera de train](/posts/weight-decay-grupos-parametros-generalizacion).
