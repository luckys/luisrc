---
id: "DL-EARLY-STOPPING"
title: "Early stopping: detenerse y recuperar el mejor checkpoint son dos decisiones"
published: "2026-10-25T22:08:00Z"
locale: "es"
translationKey: "generalization-stability-dl-early-stopping"
slug: "early-stopping-patience-mejor-checkpoint"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-WEIGHT-DECAY", "DL-CHECKPOINT"]
description: "Cómo implementar paciencia y recuperación sin confundir la mejor observación con una garantía futura. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Detener un entrenamiento no conserva automáticamente su mejor modelo. Puede que el último checkpoint sea peor que uno anterior, y también puede que detenerse en una meseta impida una mejora que habría llegado después.

Tras [comparar weight decay](/posts/weight-decay-grupos-parametros-generalizacion), implementamos **early stopping** como una política comprobable, con frecuencia, paciencia y recuperación explícitas.

## Qué cuenta como mejora debe formar parte del contrato

En `packages/generalization-stability/training.py`, `Tracker.observe` compara la métrica con un mejor valor conservado:

```python
        improved = value < self.best - self.min_delta
        if improved:
            self.best,self.best_epoch,self.wait = value,epoch,0
        else:
            self.wait += 1
        return improved,self.wait >= self.patience
```

La desigualdad es estricta. Un empate no reinicia la paciencia. **Min_delta** es una mejora absoluta en unidades de la métrica, no un porcentaje. El test usa valores que mejoran demasiado poco o empatan el umbral para comprobar ese detalle.

El experimento principal fija min_delta=0 y paciencia de diez observaciones. Se evalúa cada diez epochs: en este loop full-batch eso equivale a 100 epochs sin mejorar la métrica monitorizada.

## La frecuencia de evaluación cambia el significado de patience

Si se evaluara cada batch, cada epoch o cada diez epochs, el mismo entero diez representaría ventanas distintas. Además, las métricas de checkpoints próximos están correlacionadas; aumentar la cantidad de checks no crea nuevas muestras independientes de validation.

Con min_delta=0 conservamos el menor error entre los puntos efectivamente monitorizados. No afirmamos conocer el mínimo entre dos observaciones ni el mejor estado que habría aparecido después de detenerse.

<img src="/assets/visuals/generalization-stability/DL-EARLY-STOPPING.svg" alt="Cómo implementar paciencia y recuperación sin confundir la mejor observación con una garantía futura. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="311" height="508" loading="lazy" style="width:100%;max-width:311px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-EARLY-STOPPING.svg).

## Guardar el mejor estado y detener el loop son acciones distintas

Cuando mejora validation, copiamos de forma independiente el state_dict. La copia evita que el snapshot en memoria cambie al seguir actualizando el modelo. Al cumplirse la paciencia se termina el loop y se restaura ese estado:

```python
            model.load_state_dict(best_state,strict=True)
            selected = checkpoint(model,data,best['epoch'])
            restored = selected['prediction']==best['prediction']
```

El test fuerza una parada sin mejoras aceptadas y comprueba que la predicción restaurada coincide con el snapshot inicial, mientras el último modelo entrenado era distinto. No basta con guardar el número de la mejor epoch.

El informe mantiene separados **last**, **best** y **selected**. La curva observada no se reescribe como si el modelo restaurado hubiera sido el usado en el último update.

## Dos inicializaciones mejoran y otra se detiene demasiado pronto

En seed 7, se detiene en epoch 530 y restaura 430: validation MSE 0,196041 frente a 0,204701 del final continuo. En seed 31, se detiene en 410 y restaura 310: 0,176718 frente a 0,195268.

En seed 19, se detiene en 170 y restaura 70, con validation 0,272863. El control continuo mejora después y termina en 0,205393; su mejor punto observado está en 310, con 0,183186.

La política no está rota: ejecuta el contrato fijado y su prefijo coincide exactamente con el del control continuo. Su paciencia era insuficiente para atravesar esa meseta. Este resultado contradice una expectativa inicial de mejora en las tres seeds, que se documenta como hipótesis rechazada sin cambiar los hiperparámetros.

## El mejor checkpoint visto al final es una comparación retrospectiva

Podemos inspeccionar toda la baseline continua y elegir su mínimo monitorizado. Esa información no estaba disponible cuando una política se detuvo antes. Confundir ambas decisiones haría parecer que early stopping siempre encuentra el mejor instante de una curva que todavía no ha observado.

También se reutiliza validation para tomar una decisión. La calidad estimada al elegir el mínimo puede resultar optimista. Una evaluación final requeriría datos reservados y un protocolo que el laboratorio no ejecuta.

No se presenta un porcentaje de ahorro de tiempo: las variantes hacen distinto número de updates, pero no hemos medido duración. Se informa el trabajo realizado y el resultado, sin convertir epochs en un benchmark de hardware.

## Ejercicio: diferencia un bug de una política que no conviene

En el visor selecciona seed 19 y la variante de parada. Localiza la última observación, el checkpoint elegido y la mejora posterior del control continuo. Explica qué prueba descarta un error de restauración y qué decisión de la política revisarías en otro experimento previamente declarado.

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

- [Recomendaciones prácticas y elección de hiperparámetros](https://arxiv.org/abs/1206.5533).
- [state_dict y snapshots](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Module.html#torch.nn.Module.state_dict).

Continúa con [Gradient clipping: limitar el gradiente no garantiza limitar cualquier optimizer step](/posts/gradient-clipping-norma-paso-estabilidad).
