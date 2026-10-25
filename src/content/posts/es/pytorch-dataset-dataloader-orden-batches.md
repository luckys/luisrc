---
id: "DL-DATALOADER"
title: "Dataset y DataLoader: quién decide qué muestras llegan al modelo"
published: "2026-10-25T21:01:00Z"
locale: "es"
translationKey: "pytorch-training-dl-dataloader"
slug: "pytorch-dataset-dataloader-orden-batches"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P099"]
description: "Cómo separar acceso a muestras, orden y agrupación sin perder el último batch. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Puedes entrenar sin errores y dejar fuera las últimas 16 muestras de cada recorrido. Basta con activar `drop_last=True` por costumbre. **Dataset** y **DataLoader** no solo facilitan leer datos: sus decisiones cambian qué trabajo realiza el entrenamiento.

Con [los contratos de los tensores](/posts/pytorch-tensores-shapes-dtype-broadcasting) definidos, separamos tres responsabilidades: acceder a una muestra, elegir el orden y agrupar muestras en batches.

## Dataset responde qué contiene una muestra

Implementamos un **Dataset map-style**: tiene longitud y permite acceder por índice. Nuestro `PointDataset`, en `packages/pytorch-training/pipeline.py`, copia al inicio las coordenadas y los targets a tensores float64 de CPU.

Sus métodos de acceso son:

```python
    def __len__(self):
        return len(self.x)

    def __getitem__(self, index):
        return self.x[index], self.y[index], index
```

Devolvemos también el índice para auditar el recorrido. El modelo solo recibe x; el target se usa en la loss y el índice queda en el registro. Es una ayuda del laboratorio, no una tercera feature que deba aprender la red.

Cada x individual tiene shape `(2,)` y cada y, `(1,)`. El Dataset no sabe si el entrenamiento agrupará 30 ejemplos o usará todo el conjunto. Tampoco baraja los datos dentro de `__getitem__`.

## DataLoader organiza la iteración y la agrupación

En este caso el **DataLoader** toma índices, pide las muestras y usa su collation por defecto para apilarlas. Treinta pares de tensores se convierten en x `(30,2)`, y `(30,1)` e índices `(30,)`.

La construcción del loader de entrenamiento, en el mismo archivo, es explícita:

```python
    generator = torch.Generator().manual_seed(config['loaderSeed'])
    training = DataLoader(train, batch_size=config['batchSize'], shuffle=True, generator=generator,
                          num_workers=config['numWorkers'], drop_last=config['dropLast'])
```

El protocolo fija batch size 30, `num_workers=0` y `drop_last=False`. Con 256 muestras obtenemos ocho batches de 30 y uno de 16: nueve updates por epoch, si hacemos un step por grupo.

<img src="/assets/visuals/pytorch-training/DL-DATALOADER.svg" alt="Cómo separar acceso a muestras, orden y agrupación sin perder el último batch. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="278" height="1008" loading="lazy" style="width:100%;max-width:278px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/DL-DATALOADER.svg).

El test corto usa 13 muestras y batch size 5 para comprobar grupos 5, 5 y 3. En los entrenamientos completos se comprueba que cada epoch contiene los 256 índices una vez, sin pérdidas ni duplicados.

## Shuffle no significa muestrear con reemplazo

Para este Dataset map-style y la configuración usada, `shuffle=True` hace que el loader utilice un orden aleatorio sin reemplazo. No significa que una muestra pueda repetirse mientras otra no aparece en la misma epoch.

Eso no describe cualquier sampler posible de PyTorch. Un sampler ponderado, con reemplazo o distribuido tendría otras reglas y necesitaría otras pruebas. La afirmación de cobertura pertenece al loader concreto que ejecutamos.

Al iterar una epoch nueva, el generador sigue desde su estado actual. Por eso la secuencia cambia sin perder reproducibilidad. Reinicializarlo con la misma seed antes de cada recorrido repetiría la misma permutación.

## Una seed inicial no describe todo el estado futuro

La seed 420 define el comienzo del generador, no su estado después de treinta epochs. PyTorch utiliza este generador para la selección aleatoria y para aspectos internos de la creación del iterador. No reconstruimos su avance suponiendo cuántos números aleatorios consumió.

Para reanudar guardaremos `generator.get_state()` y lo restauraremos con `set_state`. Es más fiel que «volver a poner la seed» y esperar que el batch siguiente coincida.

Los loaders de evaluación usan otro generador y `shuffle=False`. Así evaluar no consume el generador que decide el próximo orden de entrenamiento. No hay transformaciones aleatorias en el Dataset.

## Num_workers cero mantiene el primer experimento comprensible

Con `num_workers=0`, el acceso a las muestras ocurre en el proceso principal. Elegimos esa configuración porque el dataset cabe en memoria y queremos verificar primero orden, cobertura y reanudación.

Usar workers puede ayudar cuando el acceso o la preparación de datos limita el entrenamiento, pero añade procesos y fuentes de estado. Aquí no hemos medido throughput ni probado prefetch, workers persistentes o su inicialización aleatoria. No sería correcto presentar cero workers como una optimización universal.

Mantener el último batch también es una decisión. Algunas arquitecturas o estrategias requieren tratarlo de otra forma. Si se decide descartarlo, el número de muestras procesadas debe reflejarlo, y la evaluación no debería perder ejemplos silenciosamente.

## La auditoría del orden ayuda a interpretar una curva

El informe conserva los índices de cada epoch. El visor reconstruye los grupos a partir de ese orden y el batch size declarado, sin volver a muestrear datos. Esto permite ver el batch final y comprobar qué significa «540 updates en 60 epochs».

No afirmamos que ese orden sea el mismo que el del laboratorio NumPy de optimizadores: aquel usaba su propio generador. Conservamos el problema y la arquitectura, pero este bloque tiene un protocolo PyTorch nuevo.

## Ejercicio: predice el efecto de descartar la cola

Calcula cuántas muestras y updates tendría una epoch con batch size 30 si se activara `drop_last=True`. Explica qué información debería cambiar en el informe. Después inspecciona dos epochs del visor y verifica que sus órdenes cambian, pero sus conjuntos de índices coinciden.

## Código completo y pruebas

El [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git) contiene el [pipeline PyTorch](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/pytorch-training/pipeline.py), los [checkpoints](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/pytorch-training/checkpoints.py), probes y tests. Reutiliza el [generador de datos y modelo NumPy anterior](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/neural-foundations/neural.py) para contrastar la implementación inicial.

Con Docker y la image CPU fijada en `runtime.json`, desde la raíz del monorepo:

```bash
pnpm --dir packages/pytorch-training test:container
pnpm --dir packages/pytorch-training exercise
pnpm --dir packages/pytorch-training verify
pnpm --dir packages/pytorch-training test
```

Si falta la image, `pnpm --dir packages/pytorch-training runtime:fetch` descarga el digest declarado. No requiere instalar paquetes Python en el host. El experimento crea sus archivos de checkpoint en un directorio temporal propio y verifica su carga antes de eliminarlo.

## Explorar la ejecución registrada

<iframe src="/assets/interactive/pytorch-training/explorer.html" title="Inspeccionar entrenamiento PyTorch, broadcasting y reanudación con datos reales" loading="lazy" style="width:100%;height:1150px;border:1px solid #475569;border-radius:12px" sandbox="allow-scripts allow-same-origin"></iframe>

[Abrir el visor completo](/assets/interactive/pytorch-training/explorer.html). Selecciona seed y checkpoint para las curvas; la comparación de reanudación corresponde siempre a seed 7. El navegador no entrena ni ejecuta PyTorch.

## Garantías y límites

El protocolo usa 256 muestras train y 128 validation, generadas por separado, con una MLP tanh 2→4→1, BCE media, CPU y float64. No se evalúa test, GPU, workers paralelos o reanudación a mitad de epoch. La MLP entrenada no incluye Dropout; el probe de modos lo usa por separado para comprobar su comportamiento.

Las cifras pertenecen a este dataset sintético y runtime. Los tests y `verify` vuelven a ejecutar el pipeline y el guardado/carga. Reproducir aquí una trayectoria no demuestra generalización en producción ni igualdad entre todas las plataformas.

## Referencias

- [Dataset, DataLoader y generadores](https://docs.pytorch.org/docs/2.14/data.html).
- [Reproducibilidad en PyTorch](https://docs.pytorch.org/docs/2.14/notes/randomness.html).

Continúa con [nn.Module: registrar parámetros y construir un forward que devuelve logits](/posts/pytorch-nn-module-linear-parametros-logits).
