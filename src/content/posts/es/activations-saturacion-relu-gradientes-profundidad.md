---
id: "DL-ACTIVATION-STABILITY"
title: "Activations y gradientes: saturación, ReLU inactiva y productos a través de capas"
published: "2026-10-25T22:03:00Z"
locale: "es"
translationKey: "generalization-stability-dl-activation-stability"
slug: "activations-saturacion-relu-gradientes-profundidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-INITIALIZATION"]
description: "Cómo una derivada local participa en un gradiente profundo sin determinarlo por sí sola. Experimentos ejecutados, código y límites de interpretación."
author: "Luis Ramírez Calle"
series: "Cuando entrenar más deja de ayudar: generalización y estabilidad"
tags: ["deep-learning", "generalization", "pytorch", "training"]
---

Una loss puede tener un camino de gradiente casi plano o uno que amplifica cada contribución. La **activation** interviene en ese recorrido, pero su derivada local no cuenta por sí sola toda la historia de una red profunda.

Después de [revisar initialization](/posts/initialization-xavier-he-simetria-gradientes), separamos saturación, unidades sin gradiente y productos de derivadas.

## Sigmoid y tanh reducen su sensibilidad en los extremos

La derivada de **sigmoid** es `σ(x)(1−σ(x))`, con máximo 0,25. La de **tanh** es `1−tanh(x)²`. Cuando sus salidas se aproximan a sus extremos, pequeñas variaciones de entrada cambian poco la salida.

Esto se llama saturación en este contexto. No significa que la derivada sea matemáticamente cero para cualquier entrada grande finita. Puede ser pequeña, y la representación numérica o las operaciones posteriores añaden sus propias limitaciones.

En `packages/generalization-stability/probes.py` calculamos valores y derivadas con autograd en −5, −1, 0, 1 y 5:

```python
        output = fn(x)
        gradient = torch.autograd.grad(output.sum(),x)[0]
```

Como cada salida depende de su propia coordenada, derivar la suma permite recuperar las derivadas de este probe elemento a elemento. No estamos calculando diferencias finitas.

## ReLU tiene otro tipo de límite

**ReLU** devuelve cero en la rama negativa y x en la positiva. En cero no hay una derivada clásica única; PyTorch usa cero para el backward de esta operación.

Si una unidad permanece en la rama negativa para todos los ejemplos relevantes, su ruta a través de ReLU puede dejar de recibir gradiente útil. Que una activación aislada valga cero no prueba que la unidad esté permanentemente inactiva.

El control escalar coloca una preactivation en −1 y un target en 1:

```python
        bias = torch.tensor(-1.,dtype=torch.float64,requires_grad=True)
        loss = (fn(bias)-1).square()
        dead.append(float(torch.autograd.grad(loss,bias)[0]))
```

Con ReLU, la pérdida no es cero pero el gradiente de ese bias sí. Con **LeakyReLU** de pendiente negativa 0,01, el gradiente no es cero. La pendiente mantiene una ruta, aunque no garantiza que todo el modelo vaya a optimizarse bien.

<img src="/assets/visuals/generalization-stability/DL-ACTIVATION-STABILITY.svg" alt="Cómo una derivada local participa en un gradiente profundo sin determinarlo por sí sola. El diagrama separa datos, estadísticas y decisiones del experimento para no convertir un diagnóstico local en una garantía de generalización." width="302" height="508" loading="lazy" style="width:100%;max-width:302px;height:auto" />

[Ampliar la figura](/assets/visuals/generalization-stability/DL-ACTIVATION-STABILITY.svg).

## Las capas multiplican más que derivadas de activation

En una composición aparecen Jacobianos de transformaciones lineales y no lineales. Un backward incluye productos como `Wᵀ·diag(φ')`. Sus efectos dependen de direcciones, escalas y del punto evaluado.

Para aislar la intuición, otro control aplica doce veces `h=tanh(3h)` o `h=ReLU(3h)` desde x=1. La primera cadena termina con sensibilidad pequeña; la segunda tiene derivada `3^12=531441`.

Eso no convierte el control escalar en una prueba sobre cualquier arquitectura. En matrices hay varias direcciones y sumas de caminos. La red de pesos grandes/tanh del artículo anterior mostraba precisamente una norma global grande pese a muchas activaciones saturadas.

## Vanishing y exploding no son sinónimos de no aprender

**Vanishing gradients** describe sensibilidades que se reducen mucho a través de ciertas rutas; **exploding gradients**, sensibilidades que crecen. El efecto práctico depende también de la precisión, la escala de la loss y la regla de actualización.

Una red puede aprender lentamente por una tasa pequeña sin que el problema principal sea vanishing. También puede memorizar ruido con gradientes finitos y sin explosión. Conviene observar dónde cambia la señal antes de elegir una intervención.

ReLU evita la saturación positiva de sigmoid o tanh, pero puede anular rutas negativas. LeakyReLU conserva una pendiente en ellas. Ninguna elimina todos los problemas causados por escalas de pesos, datos o profundidad.

## Cambiar activation cambia el modelo y su initialization

No es una sustitución que solo afecte al backward. También cambia la familia de funciones, la distribución de activaciones y la escala inicial apropiada. Por eso el laboratorio mantiene pares declarados de activation e initialization en lugar de presentar una comparación sin contexto.

Las normalizaciones y clipping que veremos después intervienen en lugares diferentes del cálculo. Entender este recorrido ayuda a evitar añadirlos como una lista de opciones sin saber qué se pretende corregir.

## Ejercicio: separa una observación de su explicación

Encuentra en el visor la derivada de ReLU en −1 y la de tanh en 5. Después explica qué información adicional necesitarías para deducir la norma del gradiente de la primera capa de una red de ocho capas. Describe un caso de pérdida alta que no se resolvería cambiando solo la activation.

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

- [Dificultades de gradientes y clipping](https://arxiv.org/abs/1211.5063).
- [He et al.: rectificadores](https://arxiv.org/abs/1502.01852).

Continúa con [BatchNorm: normalizar un canal también introduce estado y dependencia del batch](/posts/batchnorm-estadisticas-batch-running-train-eval).
