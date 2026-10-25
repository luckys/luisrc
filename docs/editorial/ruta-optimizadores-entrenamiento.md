# Optimizar una red: siete decisiones que se pueden comprobar

P098 se divide en siete drafts españoles independientes de PaySafe. Audiencia: conoce derivadas, matrices y el backward de la MLP de P096/P097. El laboratorio vuelve a entrenar sobre muestras idénticas y separa mecanismos de recomendaciones generales.

Ver [manifiesto](training-dynamics-series.json), [glosario](training-dynamics-glossary.md) y [revisión](training-dynamics-review.md).

## P098. [Epochs y batches: qué estás comparando cuando una red aprende antes](../../src/content/posts/es/epochs-batches-minibatches-comparar-entrenamientos.md)

Cómo comparar entrenamientos sin confundir muestras, epochs y actualizaciones.

- Distinguir epoch, batch y optimizer step.
- Conservar el último minibatch y el orden de muestras.
- Elegir el presupuesto y los ejes de una comparación.

Errores que debe distinguir: Comparar epochs como si fueran updates; Eliminar el último batch sin declararlo; Atribuir al algoritmo diferencias de datos o learning rate.

## DL-SGD. [SGD y learning rate: por qué un gradiente correcto puede dar un mal paso](../../src/content/posts/es/sgd-learning-rate-diagnosticar-pasos.md)

Cómo interpretar el signo, la escala y la estabilidad de una actualización SGD.

- Derivar la actualización desde una aproximación local.
- Separar estabilidad de convergencia lenta.
- Comparar tres tasas sin afirmar una regla universal.

Errores que debe distinguir: Confundir backward con step; Suponer que una tasa mayor siempre diverge; Comparar losses calculadas sobre batches distintos.

## DL-MOMENTUM. [Momentum: qué recuerda el optimizador entre dos batches](../../src/content/posts/es/momentum-gradientes-estado-optimizador.md)

Cómo interpretar y comprobar el estado que combina gradientes sucesivos.

- Desplegar la recurrencia de momentum.
- Distinguir buffers de gradientes actuales.
- Relacionar learning rate y persistencia del estado.

Errores que debe distinguir: Recrear el optimizador en cada batch; Llamar promedio a una suma sin normalizar; Suponer que la memoria impide cualquier oscilación.

## DL-ADAM. [Adam: dos estimaciones por parámetro y una escala que cambia](../../src/content/posts/es/adam-momentos-bias-correction-epsilon.md)

Qué hacen los dos momentos de Adam y cómo verificar la bias correction.

- Calcular los momentos y su corrección inicial.
- Distinguir segundo momento de varianza.
- Contrastar varios updates con PyTorch.

Errores que debe distinguir: Eliminar el learning rate por ser adaptativo; Omitir la corrección de sesgo inicial; Confundir una curva rápida con mejor generalización.

## DL-ADAMW. [AdamW y weight decay: por qué añadir L2 a Adam cambia otra cosa](../../src/content/posts/es/adamw-weight-decay-regularizacion-l2.md)

Por qué L2 acoplada y weight decay desacoplado producen updates distintos.

- Deducir la equivalencia limitada en SGD simple.
- Separar el gradiente de datos de la contracción.
- Comprobar un paso con gradiente de datos cero.

Errores que debe distinguir: Tratar Adam y AdamW con igual decay como equivalentes; Ocultar si se regularizan los bias; Confundir gradiente cero con gradiente ausente.

## DL-SCHEDULES. [Learning rate schedules: poner un reloj al tamaño del paso](../../src/content/posts/es/learning-rate-schedules-warmup-cosine-updates.md)

Cómo definir el reloj y los extremos de un schedule sin errores de un update.

- Declarar el índice que mueve el schedule.
- Implementar warmup y cosine con extremos probados.
- Comparar tasa constante y variable sin prometer mejoras.

Errores que debe distinguir: Avanzar el schedule por microbatch; Confundir epochs con actualizaciones; Presentar warmup como una mejora automática.

## DL-ACCUMULATION. [Gradient accumulation: sumar trabajo pequeño sin cambiar el batch que optimizas](../../src/content/posts/es/gradient-accumulation-microbatches-media-ponderada.md)

Cuándo varios microbatches reproducen un batch completo y cómo comprobarlo.

- Ponderar las medias por el número de muestras.
- Mantener pesos fijos y hacer un solo optimizer step.
- Probar el último grupo desigual y los límites de equivalencia.

Errores que debe distinguir: Promediar medias de grupos desiguales por igual; Actualizar los pesos entre microbatches; Olvidar que BatchNorm y dropout cambian las condiciones.

## Aceptación del bloque

- Épocas, batches y updates: cobertura y último grupo desigual; mismos datos/orden/pesos por seed. Contadores y ejes hacen visible un presupuesto desigual.
- SGD, momentum, Adam y AdamW: ecuaciones y ejemplos explicados; varios steps y tasas contrastados con torch.optim. Diferenciar L2, decay, buffers y gradiente ausente.
- Diecisiete entrenamientos declarados antes de capturar resultados, sin elegir un ganador por una sola curva. Tres seeds principales y cinco ablations. Sin usar test para configurar.
- Warmup/cosine: reloj por update, extremos probados, tasas realmente usadas. Acumulación ponderada con pesos fijos, último grupo desigual y control incorrecto.
- Ocho recorridos cortos contrastan acumulación durante entrenamiento, no solo un gradiente aislado. Reproducción recalcula y comprueba hashes/tolerancias.
- Siete diagramas, tres gráficos y visor de checkpoints con ejes alternativos, valores, teclado, móvil/escritorio y error explícito. Drafts excluidos del sitio publicado.

## Continuación

P099 continúa en [la ruta de entrenamiento PyTorch](ruta-entrenamiento-pytorch.md): pipeline end-to-end con Dataset/DataLoader, nn.Module, train/eval y save/load. Los tests de torch.optim de este bloque no sustituyen ese laboratorio. P100 conserva diagnóstico de overfitting, normalización, dropout, early stopping y clipping.
