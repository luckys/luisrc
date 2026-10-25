---
id: "DL-ACCUMULATION"
title: "Gradient accumulation: sumar trabajo pequeño sin cambiar el batch que optimizas"
published: "2026-10-25T20:06:00Z"
locale: "es"
translationKey: "training-dynamics-dl-accumulation"
slug: "gradient-accumulation-microbatches-media-ponderada"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-SCHEDULES", "DL-LOSS-GRADIENT"]
description: "Cuándo varios microbatches reproducen un batch completo y cómo comprobarlo. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

Dividir un batch de 13 muestras en grupos de 5, 5 y 3 parece una reorganización inocente. Si promedias las tres losses medias por igual, las últimas tres muestras reciben más peso que las otras diez. **Gradient accumulation** necesita conservar la función que queremos optimizar, no solo sumar números en un buffer.

Después de [poner un reloj a los updates](/posts/learning-rate-schedules-warmup-cosine-updates), podemos separar la unidad que cabe en memoria de la que determina una actualización.

## Microbatch y batch efectivo tienen responsabilidades distintas

Un **microbatch** es el grupo que procesamos en un forward/backward. El **batch efectivo** reúne las muestras cuyo gradiente queremos usar en un único optimizer step.

Si el efectivo tiene N muestras y el microbatch j tiene nⱼ, su gradiente medio gⱼ debe contribuir con peso nⱼ/N. Por linealidad de la derivada, `g_efectivo = Σⱼ(nⱼ/N)gⱼ`, siempre que se evalúe la misma función por muestra a los mismos parámetros.

Para 5, 5 y 3, los pesos son 5/13, 5/13 y 3/13. Usar 1/3 para todos asigna a cada muestra del último grupo 1/9 del total, frente a 1/15 en los primeros. El peso correcto por muestra sería 1/13.

## Los parámetros permanecen fijos hasta terminar el grupo

Cada microbatch calcula su gradiente con los mismos pesos. Los sumamos ponderados y llamamos una sola vez al optimizador. Así también avanza una sola vez el buffer de momentum, el contador de Adam, el weight decay y el schedule.

En `packages/training-dynamics/training.py`, `accumulated_gradient` utiliza las derivadas medias del modelo canónico:

```python
    chunks = [(x[i:i+micro_size], y[i:i+micro_size]) for i in range(0, len(x), micro_size)]
    total = [np.zeros_like(a) for a in arrays(layers)]
    for mx, my in chunks:
        weight = 1 / len(chunks) if naive else len(mx) / len(x)
        for acc, g in zip(total, arrays(gradients(mx, my, layers))):
            acc += weight * g
    return layers_from(total)
```

`naive=True` activa intencionadamente el promedio incorrecto para comprobar que las pruebas lo distinguen. El loop de entrenamiento usa la versión ponderada. La función no actualiza los parámetros: devuelve gradientes con las shapes de weights y bias.

<img src="/assets/visuals/training-dynamics/DL-ACCUMULATION.svg" alt="Cuándo varios microbatches reproducen un batch completo y cómo comprobarlo. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="301" height="1008" loading="lazy" style="width:100%;max-width:301px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/DL-ACCUMULATION.svg).

## Por qué el último grupo necesita su propio denominador

Supón que intentas acumular cuatro microbatches de ocho muestras. Si solo quedan diez al final del recorrido, el batch efectivo será de ocho y dos. No debes dividir sus losses por cuatro por costumbre: ni hay cuatro grupos ni todos tienen el mismo tamaño.

Nuestro loop forma primero cada batch efectivo, conserva el final incompleto y después lo divide en microbatches. Así conoce N antes de ponderar. En otras implementaciones puede ser preferible acumular gradientes de losses sumadas y normalizarlos una sola vez por el total real. Lo importante es evitar promediar dos veces o usar un denominador imaginario.

En PyTorch, `backward()` acumula en `.grad`, pero esa propiedad no decide la ponderación correcta. Hay que vaciar los gradientes antes del grupo, escalar las contribuciones y hacer `step()` al terminar. Si se aplica clipping, para reproducir el clipping del gradiente efectivo tendría que hacerse después de completar y normalizar la acumulación, no sobre cada parte por separado.

## Los controles muestran tanto la equivalencia como su fallo

Con los mismos 13 puntos y parámetros, el error absoluto máximo entre el gradiente completo y el ponderado es 1,388e-17. La versión que promedia las tres medias por igual llega a un error de 0,045714. El test exige que la correcta se aproxime y que el control incorrecto se aleje.

Después entrenamos cinco epochs con batch efectivo 32, comparando un cálculo completo con microbatches 10, 10, 10 y 2. Repetimos con SGD, momentum, Adam y AdamW. En ambos recorridos hay 40 optimizer steps; el mayor error final de parámetros entre los pares es 5,552e-16.

Son discrepancias de redondeo en float64 bajo este runtime, no una promesa de igualdad bit a bit entre equipos o librerías. Las pruebas cortas añaden batches efectivos de tamaño 7 sobre 16 muestras para que el caso final desigual tampoco desaparezca del loop.

## Cuándo ya no estás evaluando la misma función

La MLP del experimento usa dense, tanh y BCE separable por muestra. No tiene BatchNorm, dropout ni transformaciones aleatorias en el forward. Esa simplicidad permite aislar la aritmética de la acumulación.

BatchNorm puede usar estadísticas del grupo procesado: dividirlo altera el forward, incluso con pesos fijos. Dropout puede introducir otras diferencias si no se coordinan sus muestras aleatorias. En modelos con pérdidas que relacionan ejemplos dentro del batch, la descomposición también requiere revisar la propia loss.

En **AMP** hay que coordinar scaling, unscale y los steps que realmente se ejecutan; en **DDP**, además, hay decisiones de sincronización. Este laboratorio no ejecuta esos modos. Tampoco mide ahorro de memoria o rendimiento: procesar grupos menores puede reducir activaciones simultáneas, pero el estado del optimizador sigue existiendo.

## Ejercicio: diseña una prueba que no pase por casualidad

Cambia el microbatch size a 4 para un batch efectivo de 13. Antes de ejecutar nada, calcula los pesos de los cuatro grupos y cuántos steps debería registrar Adam. Explica por qué probar solo grupos de igual tamaño no descubriría el bug del promedio de medias.

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

- [Ejemplos oficiales de acumulación y sus condiciones en AMP](https://docs.pytorch.org/docs/2.14/notes/amp_examples.html#gradient-accumulation).
- [Acumulación de gradientes en autograd](https://docs.pytorch.org/docs/2.14/generated/torch.Tensor.backward.html).

El [bloque de entrenamiento completo en PyTorch](/posts/pytorch-tensores-shapes-dtype-broadcasting) continúa la serie, con Dataset/DataLoader, módulos y checkpoints; este laboratorio deja verificadas las reglas de actualización que usará.
