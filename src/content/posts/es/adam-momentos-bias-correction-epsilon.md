---
id: "DL-ADAM"
title: "Adam: dos estimaciones por parámetro y una escala que cambia"
published: "2026-10-25T20:03:00Z"
locale: "es"
translationKey: "training-dynamics-dl-adam"
slug: "adam-momentos-bias-correction-epsilon"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-MOMENTUM"]
description: "Qué hacen los dos momentos de Adam y cómo verificar la bias correction. Código probado, curvas reales y límites explícitos."
author: "Luis Ramírez Calle"
series: "Optimizar una red: batches, estado y tamaño del paso"
tags: ["deep-learning", "optimizers", "numpy", "pytorch"]
---

**Adam** no decide un único tamaño de paso a partir del gradiente actual. Mantiene dos estimaciones por coordenada y las utiliza para modificar la escala de la actualización. Eso no elimina la necesidad de elegir un learning rate ni garantiza que vaya a superar a SGD.

Después de [momentum](/posts/momentum-gradientes-estado-optimizador), la primera estimación resulta familiar. La segunda requiere más cuidado: elevar gradientes al cuadrado no equivale a calcular su varianza.

## Dos medias con descuento, de g y de g al cuadrado

Para cada parámetro usamos `m_t = β₁m_anterior + (1−β₁)g_t` y `v_t = β₂v_anterior + (1−β₂)g_t²`. Los cuadrados y las operaciones siguientes son elemento a elemento.

m conserva información de signo y dirección. v conserva una escala de magnitud, porque los cuadrados son no negativos. Es una estimación del segundo momento sin centrar; para hablar de varianza habría que considerar también el cuadrado de la media y las condiciones del estimador.

El código de `packages/training-dynamics/optimizers.py` mantiene arrays de las mismas shapes que los parámetros:

```python
                self.m[i] = self.b1 * self.m[i] + (1 - self.b1) * g
                self.v[i] = self.b2 * self.v[i] + (1 - self.b2) * g * g
                m_hat = self.m[i] / (1 - self.b1 ** self.t)
                v_hat = self.v[i] / (1 - self.b2 ** self.t)
                direction = m_hat / (np.sqrt(v_hat) + self.epsilon)
```

Finalmente restamos `η·direction`. Aquí β₁=0,9, β₂=0,999 y ε=1e-8. No usamos AMSGrad ni gradientes sparse.

<img src="/assets/visuals/training-dynamics/DL-ADAM.svg" alt="Qué hacen los dos momentos de Adam y cómo verificar la bias correction. El diagrama identifica qué se calcula, qué estado se conserva y cuándo se actualizan los parámetros." width="274" height="1008" loading="lazy" style="width:100%;max-width:274px;height:auto" />

[Ampliar la figura](/assets/visuals/training-dynamics/DL-ADAM.svg).

## La bias correction compensa el arranque desde cero

Como m y v empiezan en cero, sus primeros valores quedan reducidos por la inicialización. Las correcciones dividen por `1−β₁ᵗ` y `1−β₂ᵗ`; t cuenta optimizer steps y empieza en 1 para el primer update.

Con g₁=2, m₁=0,2 y v₁=0,004. Tras corregir, m̂₁=2 y v̂₁=4. La dirección inicial es aproximadamente 1, por lo que η=0,01 desplaza el parámetro aproximadamente 0,01, en lugar de 0,02 como haría SGD con ese gradiente y tasa.

La corrección no vuelve insesgada cualquier estimación posible en una red no estacionaria. Su justificación habitual estudia el efecto de iniciar esas medias en cero. Omitirla crea otra variante y cambia especialmente los primeros updates.

## Adaptar la escala no significa saber qué coordenada importa más

Una coordenada con historial de gradientes grandes tiende a tener un denominador mayor. Otra con magnitudes menores puede recibir una escala relativa distinta. El cociente combina ese historial con la dirección estimada por m.

No conviene traducirlo a «Adam da más importancia a los parámetros importantes». El algoritmo no observa esa importancia semántica ni la métrica de negocio. Sus estadísticas vienen del gradiente de la loss que hemos definido.

El learning rate sigue multiplicando todo el cociente. Un valor inadecuado puede producir pasos malos aunque v esté bien calculado. ε evita dividir por cero y afecta al comportamiento cuando la escala estimada es muy pequeña; su posición fuera de la raíz pertenece a la variante implementada.

## Qué añade al estado y qué comprueban los tests

SGD simple no necesita estos dos buffers por coordenada. Adam sí mantiene m, v y el contador de steps, además de parámetros y gradientes del entrenamiento. Eso añade almacenamiento; el laboratorio no mide el consumo real de un modelo grande ni los buffers temporales de implementaciones fused o foreach.

La prueba compara cuatro updates sucesivos contra `torch.optim.Adam` con float64, `foreach=False`, tasas cambiantes y decay acoplado explícito en una de las variantes. Compara los parámetros, no solo que la loss termine siendo finita.

El test con varios pasos detecta fallos en la persistencia de m/v, el contador o la corrección inicial. El loop se prueba además con batches cuyo tamaño no divide exactamente el número de muestras.

## Las curvas no justifican recomendar siempre Adam

En seed 7, después de 640 updates, Adam con η=0,01 termina con validation BCE 0,020754; momentum con η=0,1 obtiene 0,004123. Los dos alcanzan accuracy 1 en ese split. Las otras dos seeds mantienen el mismo orden en estas configuraciones.

<img src="/assets/interactive/training-dynamics/optimizer-curves.svg" alt="Curvas observadas de validation BCE para cuatro configuraciones y seed7. Momentum usa tasa0,1, Adam y AdamW0,01. Son640updates con muestras y orden idénticos; AdamW además aplica decay0,01." width="380" height="425" loading="lazy" style="width:100%;max-width:380px;height:auto" />

[Ampliar la figura](/assets/interactive/training-dynamics/optimizer-curves.svg).

Esto contradice una regla simplista de «Adam siempre converge mejor», pero tampoco demuestra superioridad general de momentum. No hay búsqueda comparable de hiperparámetros, tareas múltiples ni medidas de tiempo. Las curvas son un punto de partida para diagnosticar este entrenamiento.

Una decisión práctica empieza por una baseline reproducible y un presupuesto de experimentación. Cambiar optimizador, batch y tasa a la vez impide saber qué intervención produjo la diferencia.

## Ejercicio: verifica el primer update sin memorizar la fórmula

En `adam-7`, toma una coordenada del primer gradiente archivado. Calcula m, v, sus correcciones y el desplazamiento usando η=0,01. Repite con el segundo step para comprobar por qué ya no basta con usar el signo del gradiente actual.

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

- [Adam: A Method for Stochastic Optimization](https://arxiv.org/abs/1412.6980).
- [Implementación y opciones de Adam](https://docs.pytorch.org/docs/2.14/generated/torch.optim.Adam.html).

Continúa con [AdamW y weight decay: por qué añadir L2 a Adam cambia otra cosa](/posts/adamw-weight-decay-regularizacion-l2).
