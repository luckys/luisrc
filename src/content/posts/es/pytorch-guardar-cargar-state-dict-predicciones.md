---
id: "DL-CHECKPOINT"
title: "Guardar un modelo PyTorch: recuperar las mismas predicciones"
published: "2026-10-25T21:05:00Z"
locale: "es"
translationKey: "pytorch-training-dl-checkpoint"
slug: "pytorch-guardar-cargar-state-dict-predicciones"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DL-EVALUATION"]
description: "Qué guardar para inferencia y cómo probar la carga sin depender de un objeto serializado. Pipeline ejecutado, ejemplos y límites explícitos."
author: "Luis Ramírez Calle"
series: "Entrenar con PyTorch: de los tensores a una reanudación verificable"
tags: ["pytorch", "deep-learning", "training", "python"]
---

Un archivo de pesos que se carga sin excepciones todavía necesita una prueba útil: producir los mismos logits que el modelo del que salió. Guardar y cargar es una frontera entre ejecuciones, y en esa frontera conviene llevar un contrato explícito.

Después de [separar evaluación y gradientes](/posts/pytorch-train-eval-no-grad-validacion), guardamos un artefacto para **inferencia**. Reanudar entrenamiento exige más estado y tendrá su propio artículo.

## State_dict describe el estado, no el código de la arquitectura

El **state_dict** de esta MLP contiene weights y bias con sus nombres. En otros módulos puede incluir buffers persistentes. No contiene una descripción universal del cálculo que debe realizar cualquier versión futura de nuestra clase.

Por eso guardamos también una versión de esquema, un tipo de artefacto, la arquitectura y el dtype. `save_inference`, en `packages/pytorch-training/checkpoints.py`, construye el payload así:

```python
    atomic_save(path, {'schema':1,'kind':'inference','architecture':config['architecture'],
                      'dtype':config['dtype'],'model':copy.deepcopy(model.state_dict())})
```

La configuración dice que esperamos dos entradas, width 4, una salida y tanh. La función de carga comprueba ese contrato antes de construir `XorMLP`. Si hubiera normalización aprendida o un vocabulario externo, su estado también formaría parte del contrato necesario; este ejemplo no los tiene.

## Un state_dict retenido en memoria puede seguir cambiando

La documentación de Module especifica que el diccionario contiene referencias al estado del módulo. Guardar `best = model.state_dict()` en memoria no crea por sí solo una copia independiente de todos sus tensores.

El control de `packages/pytorch-training/probes.py` conserva una versión superficial y otra profunda:

```python
        shallow = model.state_dict()
        deep = copy.deepcopy(model.state_dict())
        before = deep['hidden.bias'].clone()
        with torch.no_grad():
            model.hidden.bias.add_(1)
```

Tras el cambio, `shallow` refleja el bias actualizado y `deep` conserva el anterior. Si se quiere retener un snapshot mientras el entrenamiento sigue modificando el modelo, esa diferencia importa.

Serializar inmediatamente con `torch.save` ya escribe los valores de ese momento. No hay que confundir el problema de retener referencias en memoria con afirmar que un archivo guardado cambia solo cuando cambia el modelo.

<img src="/assets/visuals/pytorch-training/DL-CHECKPOINT.svg" alt="Qué guardar para inferencia y cómo probar la carga sin depender de un objeto serializado. La figura identifica entradas, estado y fronteras de ejecución del ejemplo probado, sin atribuir al framework decisiones que toma el programa." width="255" height="1008" loading="lazy" style="width:100%;max-width:255px;height:auto" />

[Ampliar la figura](/assets/visuals/pytorch-training/DL-CHECKPOINT.svg).

## Guardar primero en un archivo temporal evita dejar el destino a medias

El helper escribe con `torch.save` en una ruta `.pending` y después usa `os.replace` para sustituir el destino dentro del mismo directorio. En nuestro experimento se trabaja con archivos locales propios en un directorio temporal.

Esto reduce el riesgo de que una interrupción durante la escritura deje el nombre final apuntando a un archivo incompleto. No es una estrategia de durabilidad distribuida ni sustituye comprobaciones de almacenamiento, backups o versionado de modelos.

Los archivos `.pt` del experimento se crean, se cargan y se eliminan con su directorio temporal al terminar. El repo conserva las funciones y el informe de verificación; no publica un checkpoint binario como descarga del blog.

## Cargar exige reconstruir el módulo y preparar su modo

`load_inference` llama explícitamente a `torch.load(..., map_location='cpu', weights_only=True)`, valida metadatos, construye la arquitectura y aplica `load_state_dict(..., strict=True)`. Después activa eval.

`strict=True` ayuda a detectar claves incompatibles; las shapes distintas de una red con width 3 también provocan error. No prueba que cualquier cambio de código conserve el significado del modelo, por eso se mantiene la comparación de predicciones.

`weights_only=True` restringe el mecanismo de deserialización. No significa que el archivo solo pueda contener el diccionario de pesos: también admite los tipos compatibles que usamos como metadatos. Tampoco convierte cualquier archivo desconocido en confiable; en este laboratorio solo cargamos archivos que acabamos de generar.

El modo eval se establece al cargar para inferencia, pero el contexto `no_grad` se elige al ejecutar predicciones. Cargar pesos no decide automáticamente todas las condiciones de ejecución del programa que los usa.

## Qué verificamos tras volver a abrir el archivo

Entrenamos el modelo de seed 7, guardamos el archivo, construimos otro módulo y lo cargamos. Los logits sobre las 128 muestras validation tienen error máximo cero dentro de este runtime CPU. El módulo cargado está en eval y conserva 17 valores entrenables.

La prueba corta hace además el recorrido tras dos epochs y rechaza pasar un artefacto de inferencia a la función de reanudación. Tener dos tipos de archivo evita asumir que un modelo listo para predecir contiene momentum, reloj y orden de batches.

## Ejercicio: define qué tendría que viajar con el modelo

Añade al diseño, sin cambiar aún el laboratorio, una estandarización de entradas aprendida sobre train. Enumera qué valores deberían guardarse y por qué no deben recalcularse a partir de validation al cargar. Después explica qué demostraría comparar solo las clases predichas y qué fallo pequeño podría detectar comparar logits.

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

- [Semántica de serialización](https://docs.pytorch.org/docs/2.14/notes/serialization.html).
- [state_dict y referencias](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Module.html#torch.nn.Module.state_dict).

Continúa con [Reanudar un entrenamiento PyTorch: por qué guardar los pesos no basta](/posts/pytorch-reanudar-checkpoint-optimizador-scheduler-rng).
