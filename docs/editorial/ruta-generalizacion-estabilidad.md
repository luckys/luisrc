# Generalización y estabilidad: diez preguntas distintas

P100 se divide en diez drafts españoles,independientes de PaySafe. Audiencia:conoce el loop PyTorch de P099,derivadas ymatrices. Cada post explica mecanismo,decisiones,controles ylímites,con extractos inline ycódigo completo en el monorepo.

Ver [manifiesto](generalization-stability-series.json),[glosario](generalization-stability-glossary.md) y[revisión](generalization-stability-review.md).

## P100. [Overfitting y underfitting: interpretar las curvas antes de cambiar la red](../../src/content/posts/es/overfitting-underfitting-curvas-error-generalizacion.md)

Cómo distinguir ajuste, memorización e inestabilidad sin diagnosticar por una sola loss.

- Comparar train y validation con la misma definición de métrica.
- Detectar sobreajuste sobre una trayectoria observada.
- Separar limitación de representación, optimización y calidad de datos.

Errores que debe distinguir: Tomar una loss train baja como prueba de generalización; Diagnosticar bias con una sola curva; Confundir sobreajuste con divergencia numérica.

## DL-BIAS-VARIANCE. [Bias y variance: qué cambia cuando cambia la muestra de entrenamiento](../../src/content/posts/es/bias-variance-descomposicion-error-muestras.md)

Qué significa la descomposición del error cuadrático y qué puede estimar un experimento finito.

- Derivar bias cuadrado, variance y ruido bajo supuestos explícitos.
- Distinguir sesgo del estimador y bias de una capa.
- Comprobar la identidad sobre un conjunto finito de ajustes.

Errores que debe distinguir: Inferir variance a partir de un único entrenamiento; Aplicar la identidad de MSE sin más a cualquier loss; Tratar una estimación finita como el bias poblacional exacto.

## DL-INITIALIZATION. [Initialization: cómo llegan activaciones y gradientes a la primera actualización](../../src/content/posts/es/initialization-xavier-he-simetria-gradientes.md)

Por qué importan la simetría, fan-in y la escala inicial antes de optimizar.

- Justificar Xavier y He con sus aproximaciones.
- Comprobar activaciones y gradientes por capa.
- Detectar un control con pesos cero que no aprende.

Errores que debe distinguir: Inicializar todas las capas ocultas a cero; Confundir segundo momento y varianza después de ReLU; Deducir el gradiente global solo de la fracción saturada.

## DL-ACTIVATION-STABILITY. [Activations y gradientes: saturación, ReLU inactiva y productos a través de capas](../../src/content/posts/es/activations-saturacion-relu-gradientes-profundidad.md)

Cómo una derivada local participa en un gradiente profundo sin determinarlo por sí sola.

- Relacionar sigmoid, tanh, ReLU y LeakyReLU con sus derivadas.
- Distinguir saturación y una unidad ReLU sin gradiente en los datos.
- Interpretar cadenas escalares sin convertirlas en una garantía para matrices.

Errores que debe distinguir: Afirmar que ReLU elimina todos los vanishing gradients; Confundir muchos ceros con neuronas permanentemente inactivas; Suponer que LeakyReLU resuelve cualquier entrenamiento.

## DL-BATCHNORM. [BatchNorm: normalizar un canal también introduce estado y dependencia del batch](../../src/content/posts/es/batchnorm-estadisticas-batch-running-train-eval.md)

Qué estadísticas usa BatchNorm y por qué cambian entre train y eval.

- Derivar la normalización sobre el eje de muestras.
- Comprobar running mean y variance con su convención real.
- Explicar dependencia del batch y el caso de una sola muestra.

Errores que debe distinguir: Confundir momentum de estadísticas con momentum del optimizador; Suponer que eval siempre usa estadísticas acumuladas; Identificar normalización con una mejora automática de generalización.

## DL-LAYERNORM. [LayerNorm: elegir los ejes que normalizas cambia la representación](../../src/content/posts/es/layernorm-ejes-features-batchnorm-diferencias.md)

Cómo LayerNorm conserva independencia entre muestras y qué información puede eliminar.

- Identificar normalized_shape en tensores de distintas dimensiones.
- Comparar BatchNorm y LayerNorm sobre los mismos valores.
- Separar estadísticas por entrada y parámetros aprendidos.

Errores que debe distinguir: Normalizar el eje de batch por error; Aplicar LayerNorm a un escalar esperando conservar su magnitud; Confundir ausencia de running stats con ausencia de parámetros.

## DL-DROPOUT. [Dropout: qué se elimina, qué se escala y por qué no siempre mejora](../../src/content/posts/es/dropout-mascaras-escalado-generalizacion.md)

Cómo funciona inverted dropout y cómo comparar sus métricas sin mezclar modos.

- Derivar la conservación de la media de una activación.
- Distinguir la red aleatoria de train y la red de evaluación.
- Leer resultados que no mejoran la baseline.

Errores que debe distinguir: Multiplicar otra vez las activaciones durante eval; Creer que se conserva exactamente la salida de toda la red; Comparar la loss con máscara y la loss sin máscara como si fueran iguales.

## DL-WEIGHT-DECAY. [Weight decay: decidir qué contraer y comprobar qué ocurre fuera de train](../../src/content/posts/es/weight-decay-grupos-parametros-generalizacion.md)

Cómo aplicar decay de forma explícita sin usar la norma de pesos como sustituto de validación.

- Separar la regla AdamW del resultado de generalización.
- Declarar grupos de parámetros y exclusiones.
- Interpretar tres comparaciones emparejadas sin un ranking universal.

Errores que debe distinguir: Tratar cualquier norma pequeña como garantía de poco overfitting; Ocultar si bias y normalizaciones reciben decay; Comparar configuraciones que cambian varias decisiones a la vez.

## DL-EARLY-STOPPING. [Early stopping: detenerse y recuperar el mejor checkpoint son dos decisiones](../../src/content/posts/es/early-stopping-patience-mejor-checkpoint.md)

Cómo implementar paciencia y recuperación sin confundir la mejor observación con una garantía futura.

- Definir frecuencia de monitorización, paciencia y min_delta.
- Conservar un snapshot independiente y restaurarlo.
- Detectar una parada prematura usando un control continuo.

Errores que debe distinguir: Usar el último modelo como si fuera el mejor; Contar patience sin indicar si son checks o epochs; Prometer que detenerse pronto siempre reduce validation loss.

## DL-GRADIENT-CLIPPING. [Gradient clipping: limitar el gradiente no garantiza limitar cualquier optimizer step](../../src/content/posts/es/gradient-clipping-norma-paso-estabilidad.md)

Qué limita clip_grad_norm y cómo distinguir estabilidad, convergencia y generalización.

- Calcular una norma global y su factor de recorte.
- Colocar clipping después de backward y antes de step.
- Contrastar SGD simple y un contraejemplo con Adam.

Errores que debe distinguir: Recortar cada tensor creyendo limitar la norma global; Esperar que clipping repare un learning rate inestable; Aplicar la cota de SGD simple a Adam o momentum.

## Criterios verificables

- Provocar sobreajuste deliberado en tres inicializaciones ycorregirlo en casos observados;publicar también intervenciones que empeoran. Curvas train/validation comparables ydatos/contaminación declarados.
- Separar underfit representacional,fallo de optimización ydivergencia. Referencia lineal por solución cerrada,controles de capas yparábola con guard.
- Bias/variance:32datasets sin outlier,identidad finita MSE,ruido conocido ylímites estadísticos,sin confundir3seeds con3datasets.
- Initialization/activation:simetría,fan-in,escalas,derivadas ygradientes por capa. Saturación solo donde aplica,no inferir vanishing a partir de una fracción de activaciones.
- BN/LN:fórmulas,ejes,contexto de muestras,running stats,estimadores,variante sin tracking,parámetros ymodos.
- Dropout/decay:reglas ygrupos explícitos,comparaciones emparejadas,sin promesa universal de mejora.
- Early stopping:checks/patience,min_delta,deepcopy/restauración,prefijo idéntico al continuo,parada prematura conservada como resultado negativo.
- Clipping:norma global,in-place,norma previa devuelta,NaN rechazado,cota de SGD simple ycontraejemplo Adam. No se afirma que cure overfitting.
- Diez diagramas,cuatro gráficas,visor dinámico ytablas de observaciones;teclado,móvil/escritorio,exports sincronizados ydrafts aislados.

## Continuación

P101 requiere entrenar una CNN pequeña einspeccionar mapas de activación;convolution,kernel,padding,stride,pooling,receptive field,feature maps,arquitecturas ytransfer learning. Separar preguntas yusar datos/runtime reproducibles. El experimento de MLP no sustituye esos requisitos.
