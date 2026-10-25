# Entrenamiento PyTorch: siete contratos verificables

P099 se desarrolla en siete drafts españoles independientes de PaySafe. Audiencia: conoce Python,matrix shapes,derivadas y el backward/optimización de P096–P098. Se ejecuta un pipeline real antes de citar cifras,con datos sintéticos yruntime fijado.

Ver [manifiesto](pytorch-training-series.json),[glosario](pytorch-training-glossary.md) y[revisión](pytorch-training-review.md).

## P099. [Tensores en PyTorch: una shape incorrecta puede cambiar el problema](../../src/content/posts/es/pytorch-tensores-shapes-dtype-broadcasting.md)

Cómo controlar shape, dtype, device y broadcasting antes de entrenar.

- Leer cada eje del tensor con su significado.
- Distinguir una copia de memoria compartida con NumPy.
- Detectar broadcasting válido que calcula otra cosa.

Errores que debe distinguir: Tratar (n,) y (n,1) como intercambiables; Suponer que todo tensor usa el dtype del modelo; Confundir forma compatible con operación correcta.

## DL-DATALOADER. [Dataset y DataLoader: quién decide qué muestras llegan al modelo](../../src/content/posts/es/pytorch-dataset-dataloader-orden-batches.md)

Cómo separar acceso a muestras, orden y agrupación sin perder el último batch.

- Implementar un Dataset map-style con contrato explícito.
- Conservar el batch final y registrar cobertura.
- Controlar el generador sin reiniciarlo cada epoch.

Errores que debe distinguir: Confundir Dataset con un batch; Usar drop_last sin registrar las muestras omitidas; Reiniciar el generador y repetir siempre la misma permutación.

## DL-MODULE. [nn.Module: registrar parámetros y construir un forward que devuelve logits](../../src/content/posts/es/pytorch-nn-module-linear-parametros-logits.md)

Qué organiza nn.Module y cómo comprobar que la red implementa el mismo modelo.

- Relacionar Linear con la multiplicación matricial.
- Contar tensores registrados y parámetros escalares.
- Separar logits, loss y probabilidades.

Errores que debe distinguir: Confundir cuatro tensores con cuatro parámetros escalares; Añadir sigmoid antes de BCE con logits; Creer que Module decide cómo entrenar.

## DL-TORCH-LOOP. [Un training loop en PyTorch: qué cambia en zero_grad, backward y step](../../src/content/posts/es/pytorch-training-loop-zero-grad-backward-step.md)

Cómo implementar un loop propio sin mezclar derivación, actualización y métricas.

- Ordenar zero_grad, forward, backward y step.
- Separar loss online de evaluación a pesos fijos.
- Registrar samples, updates y tasas realmente usadas.

Errores que debe distinguir: Esperar que backward actualice los pesos; Sumar gradientes accidentalmente entre batches; Comparar la media online con una loss de checkpoint.

## DL-EVALUATION. [train, eval y no_grad: tres decisiones que no hacen lo mismo](../../src/content/posts/es/pytorch-train-eval-no-grad-validacion.md)

Cómo evaluar sin actualizar pesos ni confundir el modo del módulo con autograd.

- Distinguir el modo de las capas del registro de gradientes.
- Agregar pérdidas por muestra aunque el batch final sea menor.
- Comprobar que la validación conserva parámetros y restaura el modo.

Errores que debe distinguir: Suponer que eval desactiva autograd; Suponer que no_grad activa el modo de evaluación; Promediar medias de batches desiguales.

## DL-CHECKPOINT. [Guardar un modelo PyTorch: recuperar las mismas predicciones](../../src/content/posts/es/pytorch-guardar-cargar-state-dict-predicciones.md)

Qué guardar para inferencia y cómo probar la carga sin depender de un objeto serializado.

- Guardar state_dict y configuración de arquitectura.
- Distinguir referencias en memoria de un snapshot independiente.
- Validar el esquema y comparar logits tras la carga.

Errores que debe distinguir: Guardar solo el nombre de una clase o un objeto completo sin contrato; Retener state_dict como si copiara todos los datos; Confundir cargar pesos con preparar inferencia.

## DL-RESUME. [Reanudar un entrenamiento PyTorch: por qué guardar los pesos no basta](../../src/content/posts/es/pytorch-reanudar-checkpoint-optimizador-scheduler-rng.md)

Cómo reproducir una continuación de entrenamiento en un límite de epoch.

- Conservar optimizador, scheduler y generadores pertinentes.
- Restaurar estado después de construir los objetos.
- Comparar una reanudación completa con controles incompletos.

Errores que debe distinguir: Usar la loss final como única prueba de reanudación; Reiniciar momentum o el generador de batches; Prometer continuidad a mitad de epoch sin guardar el estado necesario.

## Criterios de aceptación

- Tensor: shape/dtype/device explícitos,broadcasting observado4×4frente a4×1,rechazo BCE y copia/alias NumPy.
- Dataset/DataLoader: índices,cobertura completa,colas desiguales,generador dedicado,cero workers y estado reproducible.
- Module: parámetros registrados,shapes,total17escalares yforward inicial contrastado con NumPy,logits sin sigmoid extra.
- Loop propio:zero_grad/backward/step trazados,540updates,loss online separada de evaluación a pesos fijos,scheduler con reloj ytasas usadas/siguientes.
- Eval:no_grad ymodo separados mediante probes,agregación ponderada,parámetros conservados ymodo general restaurado.
- Save/load:archivos reales propios,esquemas explícitos,strict state_dict,carga de inferencia con logits idénticos.
- Resume:comparar continuo con checkpoint epoch30 ycuatro continuaciones; completa exacta localmente,controles incompletos deben desviarse aunque la loss mejore.
- Siete diagramas,dos gráficas,visor dinámico; fuentes/observaciones/exportssincronizados; pruebas yQA en móvil/escritorio; drafts fuera de publicación.

## Continuación

P100 continúa en [generalización y estabilidad](ruta-generalizacion-estabilidad.md):underfit/overfit,bias-variance,initialization,activation,batch/layer norm,dropout,weight decay,early stopping yclipping. Necesita introducir overfitting deliberado ycorregirlo con curvas comparables; los probes de modos de este bloque no cumplen ese laboratorio. Dividir cada pregunta antes de escribir.
