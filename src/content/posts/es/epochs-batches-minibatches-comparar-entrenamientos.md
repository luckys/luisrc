---
id: "P098"
title: "Epochs y batches: qué estás comparando cuando una red aprende antes"
published: "2026-10-25T20:00:00Z"
locale: "es"
translationKey: "training-dynamics-p098"
slug: "epochs-batches-minibatches-comparar-entrenamientos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-AUTODIFF", "P079"]
description: "Cómo comparar entrenamientos sin confundir muestras, epochs y actualizaciones. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

Dos entrenamientos recorren los mismos datos durante 80 **epochs**. Uno termina con una loss mucho menor. Antes de atribuir la diferencia al optimizador, conviene preguntar cuántas veces actualizó los pesos cada uno: podrían ser 80 updates frente a 1280.

Después de [verificar el backward](/posts/pytorch-autograd-leaf-detach-acumulacion-vjp), ya podemos confiar razonablemente en el gradiente de nuestra MLP pequeña. Ahora falta decidir con qué muestras lo calculamos, cuándo cambiamos los pesos y qué presupuesto usamos al comparar resultados.

## Epoch, batch y step cuentan cosas distintas

Una **epoch** es un recorrido del conjunto de entrenamiento. En este laboratorio cada muestra aparece una vez por recorrido, sin reemplazo. Esa definición no se traslada automáticamente a un stream infinito o a un sampler con reemplazo: en esos casos hay que declarar qué se considera una epoch.

Un **batch** es el grupo de muestras procesado conjuntamente. Si usamos todo el conjunto para una actualización, hablamos de **full-batch**. Si tomamos una parte, hablamos de **minibatch**. En la práctica se suele decir batch a ambos; lo que importa es conocer su tamaño.

Un **optimizer step** actualiza los parámetros a partir de un gradiente y, según el algoritmo, de su estado anterior. En nuestro loop inicial hacemos un step por minibatch. Con gradient accumulation esa correspondencia cambiará: varios forwards y backwards pueden alimentar un único step.

<img src="/assets/visuals/training-dynamics/P098.svg" alt="Cómo comparar entrenamientos sin confundir muestras, epochs y actualizaciones. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="284" height="1251" loading="lazy" style="width:100%;max-width:284px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/P098.svg).

## El último batch no tiene por qué estar completo

Con 13 muestras y batch size 5 obtenemos grupos de 5, 5 y 3. El último también participa. Eliminarlo para que todos tengan la misma shape cambiaría el conjunto recorrido; puede ser una decisión válida, pero debe ser explícita.

La función `batches`, en `packages/training-dynamics/training.py`, genera el orden de cada epoch y lo divide después:

```python
    order = np.random.default_rng(np.random.SeedSequence([order_seed, epoch])).permutation(count)
    return [order[start:start + size] for start in range(0, count, size)]
```

Combinar seed y epoch permite repetir cada permutación y obtener otra en el recorrido siguiente. Separar el orden de la partición conserva la secuencia de muestras al cambiar batch size. No conserva los gradientes: los pesos se actualizan en momentos distintos.

El test comprueba cobertura sin duplicados, retención del grupo final, reproducibilidad y cambio de orden entre epochs. Probar solo que la lista tiene tres elementos no detectaría que una muestra se perdió y otra se repitió.

## Una media del batch estima otra media, bajo condiciones

La loss de entrenamiento es la media de las pérdidas por muestra. El gradiente del minibatch promedia un subconjunto de esas contribuciones. Con muestreo uniforme y parámetros fijos, una muestra aleatoria permite construir un estimador del gradiente completo.

Nuestro recorrido baraja sin reemplazo. Dentro de una epoch, los batches restantes dependen de los ya consumidos, y los parámetros también cambian. No conviene convertir la intuición de un estimador insesgado en una afirmación sobre independencia de todos los steps del loop.

Un batch mayor puede reducir variabilidad del gradiente a pesos fijos. También puede requerir más memoria y producir menos updates por epoch. Elegirlo depende del modelo, el hardware y el experimento; aquí no medimos memoria ni throughput.

## Ochenta epochs pueden ocultar dieciséis veces más updates

La MLP tiene 256 muestras train, 128 validation y 17 parámetros. Manteniendo 80 epochs, SGD con tasa 0,1 y seed de pesos 7 da:

<div role="region" aria-label="Comparación de tamaños de batch" tabindex="0" style="overflow-x:auto">

| Batch size | Updates por epoch | Updates totales | Validation BCE final |
| --- | ---: | ---: | ---: |
| 16 | 16 | 1280 | 0,023326 |
| 32 | 8 | 640 | 0,054380 |
| 256 | 1 | 80 | 0,563468 |

</div>

Los tres procesan 20 480 muestras contando repeticiones. El primer run cambia los pesos dieciséis veces por cada update del último. La tabla muestra el resultado de ese protocolo; no demuestra que batch 16 sea la mejor elección general.

<img src="/assets/interactive/training-dynamics/batch-curves.svg" alt="Validation BCE por epoch para SGD con batch16,32 y256. Los tres recorren las mismas muestras, pero completan1280,640 y80 actualizaciones. No se comparan presupuestos de updates iguales." width="380" height="425" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/training-dynamics/batch-curves.svg).

Si la pregunta fuera qué método mejora más tras 640 updates, habría que fijar ese presupuesto y registrar también cuántas muestras procesa cada uno. Si fuera cuánto tarda en alcanzar una calidad mínima, harían falta medidas de tiempo bajo condiciones comparables. Cambiar el eje de una gráfica ayuda a interpretar los datos, pero no crea un experimento que no se ha ejecutado.

## Qué mantenemos igual en la comparación de optimizadores

La comparación principal usa batch 32, 80 epochs y las mismas tres inicializaciones, seeds 7, 19 y 31. Para una seed dada, SGD, momentum, Adam y AdamW parten de pesos idénticos y recorren los mismos índices. Los hashes de los datos y del orden quedan en el informe.

Declaramos las tasas antes de capturar resultados: 0,1 para SGD y momentum; 0,01 para Adam y AdamW. AdamW añade decay 0,01. No hemos buscado la mejor tasa para cada algoritmo ni igualado la regularización. Comparamos configuraciones concretas, no la capacidad máxima de cuatro familias.

La loss de cada checkpoint se vuelve a calcular sobre el split train completo y sobre validation, con los pesos de ese instante. Así evitamos comparar el batch fácil de un run con el difícil de otro. No usamos test para elegir configuraciones ni afirmamos haber completado una evaluación final.

## Ejercicio: elige el presupuesto antes de mirar las curvas

Abre el visor, selecciona batch size y cambia el eje entre epochs, muestras y updates. Explica por qué los extremos coinciden en epochs y muestras, pero no en updates. Después diseña un experimento de 640 updates: anota cuántas epochs y muestras necesitaría cada batch size y qué pregunta respondería.

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

- [SGD y variantes en PyTorch](https://docs.pytorch.org/docs/2.14/generated/torch.optim.SGD.html).
- [Deep Learning, capítulo de optimización](https://www.deeplearningbook.org/contents/optimization.html).

Continúa con [SGD y learning rate: por qué un gradiente correcto puede dar un mal paso](/posts/sgd-learning-rate-diagnosticar-pasos).
