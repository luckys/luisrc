---
id: "DL-MOMENTUM"
title: "Momentum: qué recuerda el optimizador entre dos batches"
published: "2026-10-25T20:02:00Z"
locale: "es"
translationKey: "training-dynamics-dl-momentum"
slug: "momentum-gradientes-estado-optimizador"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-SGD"]
description: "Cómo interpretar y comprobar el estado que combina gradientes sucesivos. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

Dos batches consecutivos pueden empujar un peso en sentidos distintos. SGD usa el gradiente actual; **momentum** conserva una parte de los anteriores. Esa memoria puede sostener un movimiento útil, pero también prolongar un paso que ya convendría frenar.

Partimos de [la actualización SGD](/posts/sgd-learning-rate-diagnosticar-pasos) y añadimos un buffer por parámetro. Entender qué guarda evita un fallo frecuente: crear un optimizador nuevo en cada batch y borrar justo el estado que queríamos aprovechar.

## El buffer mezcla gradientes de varios momentos

Usamos `b_t = μb_anterior + g_t`, con b inicial cero y μ=0,9. Después actualizamos `θ_t = θ_anterior − η_t b_t`. El buffer tiene las mismas dimensiones que los parámetros.

Al desplegar tres pasos queda `b_3 = g_3 + μg_2 + μ²g_1`. Los gradientes recientes pesan más y los antiguos pierden influencia geométricamente. En el código de `packages/training-dynamics/optimizers.py`:

```python
            elif self.kind == 'momentum':
                self.m[i] = self.beta * self.m[i] + g
                direction = self.m[i]
```

Llamamos `m` al buffer compartido por la implementación didáctica. En momentum es una suma con descuento, no el primer momento normalizado de Adam. Si todos los gradientes fueran g durante mucho tiempo, se aproximaría a `g/(1−μ)`, que para μ=0,9 es 10g.

Esto explica por qué conservar el learning rate de SGD no garantiza conservar la escala de los desplazamientos. Cambiar μ y η son decisiones relacionadas, aunque sus efectos no sean idénticos.

<img src="/assets/visuals/training-dynamics/DL-MOMENTUM.svg" alt="Cómo interpretar y comprobar el estado que combina gradientes sucesivos. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="391" height="609" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/DL-MOMENTUM.svg).

## Qué ocurre cuando el gradiente cambia de signo

Con una sola coordenada, g₁=2 da b₁=2. Si g₂=−2, obtenemos b₂=0,9·2−2=−0,2. El segundo paso usa una dirección mucho menor que la propuesta por g₂ solo.

Si g₁=g₂=2, b₂=3,8: las contribuciones se refuerzan. Esta recurrencia ayuda a comprender por qué una secuencia de gradientes alineados produce un avance sostenido, mientras algunos cambios de signo se compensan.

En un valle con una dirección muy curvada y otra más suave, ese comportamiento puede ser útil. No significa que momentum sepa cuál es la dirección correcta ni que elimine siempre las oscilaciones. Un buffer grande puede seguir empujando después de atravesar una región favorable.

## Hay varias convenciones de momentum

Algunas formulaciones incorporan η dentro del buffer; otras usan `(1−μ)g` al incorporarlo. Con tasa constante ciertas expresiones pueden relacionarse mediante un reescalado. Cuando η cambia, moverla de sitio sin revisar la ecuación puede cambiar el algoritmo.

Nuestra recurrencia coincide con el caso de **PyTorch SGD con momentum**, dampening cero, sin Nesterov y gradientes densos presentes. El primer buffer es g₁; inicializarlo a cero y aplicar nuestra primera recurrencia produce exactamente ese valor. No afirmamos equivalencia con todas las opciones de la clase.

Los tests aplican cuatro gradientes, incluyendo cambios de signo y un cero, con tasas distintas en cada step. Comparan parámetros contra PyTorch con y sin decay. Una prueba de un único paso no distinguiría momentum de SGD porque ambos empiezan con g₁.

## La memoria pertenece al optimizador

En `training.py`, construimos `Optimizer` antes de entrar en el loop. Su `m` sobrevive entre batches. El gradiente se vuelve a calcular en cada uno, a los pesos nuevos; el buffer combina contribuciones evaluadas en puntos distintos del recorrido.

Recrear el optimizador dentro del loop borraría esa memoria y convertiría este caso en SGD. Vaciar los gradientes entre steps, en cambio, no debería borrar el buffer de momentum. Son estados con funciones diferentes.

Al reanudar entrenamiento también hay que conservar el estado del optimizador si se pretende continuar la trayectoria. Restaurar solo los pesos plantea otro experimento. El guardado y la restauración completos se desarrollarán en el bloque de entrenamiento PyTorch.

## Qué cambió en nuestras tres inicializaciones

Tras 640 updates, momentum con μ=0,9 y η=0,1 termina con validation BCE 0,004123, 0,002098 y 0,003829 para seeds 7, 19 y 31. SGD con η=0,1 obtiene 0,054380, 0,072151 y 0,053232.

Los datos, el orden y el presupuesto coinciden por seed. Es evidencia de una mejora de esas configuraciones en este problema sencillo. La ablation SGD con η=1 alcanza 0,004212 en seed 7: ajustar la tasa de una baseline también puede cambiar mucho la comparación.

La clasificación por accuracy ya es perfecta para todos esos runs finales; la BCE sigue distinguiendo sus probabilidades asignadas. No deducimos calibración ni robustez fuera de los cuatro grupos sintéticos a partir de esa diferencia.

## Ejercicio: inspecciona la memoria que SGD no tiene

Lee los tres primeros updates de `momentum-7` en `comparison.json`. Elige una coordenada y reconstruye b₂ y b₃ desde los gradientes y μ. Después compara el desplazamiento con `−ηb`. Explica qué cambiaría si se reiniciara el buffer antes del tercer update.

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

- [Convención e inicialización de momentum en PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.optim.SGD.html).
- [Deep Learning, optimización](https://www.deeplearningbook.org/contents/optimization.html).

Continúa con [Adam: dos estimaciones por parámetro y una escala que cambia](/posts/adam-momentos-bias-correction-epsilon).
