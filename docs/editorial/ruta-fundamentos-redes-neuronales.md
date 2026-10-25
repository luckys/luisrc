# Redes neuronales: empezar por representar y aprender

Primer bloque de Serie10, desarrollado a partir de P096 en cinco drafts españoles.
P097 continúa en la [serie de autodiff](ruta-forward-backward-autodiff.md); P098–P105 siguen pendientes. Audiencia: ingenieros que ya conocen matrices,
derivadas, gradient descent y separación train/validation/test de las series previas.
Los artículos son independientes de PaySafe y construyen un único laboratorio NumPy.

Ver [manifiesto](neural-foundations-series.json), [glosario](neural-foundations-glossary.md)
y [revisión](neural-foundations-review.md). Cada entrega tiene una pregunta distinta;
no se concentra todo en un tutorial largo antes de poder interpretar una capa.

## Orden de lectura y criterios de aprendizaje

### P096. [Perceptrón y neurona artificial: qué pueden decidir unos pesos y un bias](../../src/content/posts/es/perceptron-neurona-pesos-bias-xor.md)

**Pregunta:** Por qué una frontera afín puede resolver unas reglas y no XOR.

Capacidades que se deben comprobar:

- Interpretar weights y bias como una función afín.
- Demostrar la limitación de una frontera para XOR.
- Distinguir construcción manual de aprendizaje.

Errores que se corrigen: Confundir un score con una probabilidad calibrada; Atribuir el fallo de XOR solo al optimizador; Tratar una solución manual como entrenamiento.

### DL-DENSE. [Dense layers: leer una red neuronal como operaciones entre matrices](../../src/content/posts/es/dense-layers-batches-matrices-dimensiones.md)

**Pregunta:** Cómo seguir shapes, broadcasting y parámetros sin esconder errores de dimensiones.

Capacidades que se deben comprobar:

- Calcular shapes de un batch en una MLP.
- Detectar broadcasting accidental en targets y bias.
- Colapsar dos capas afines sin activation.

Errores que se corrigen: Confundir filas de muestras con columnas de features; Aceptar targets con shape ambiguo; Creer que apilar capas afines crea no linealidad.

### DL-ACTIVATIONS. [Activations: qué cambia tanh, sigmoid o ReLU dentro de una red](../../src/content/posts/es/activations-tanh-sigmoid-relu-no-linealidad.md)

**Pregunta:** Por qué las activations cambian la familia de funciones y la sensibilidad del entrenamiento.

Capacidades que se deben comprobar:

- Comparar rango y derivada de tres activations.
- Separar activation oculta de salida probabilística.
- Evitar overflow en sigmoid y binary cross entropy.

Errores que se corrigen: Elegir por la forma de una gráfica aislada; Confundir función diferenciable con gradiente siempre útil; Comparar entrenamientos que no se han ejecutado.

### DL-XOR. [Una MLP con NumPy: entrenar XOR y observar dónde falla](../../src/content/posts/es/mlp-numpy-entrenar-xor-pesos-curvas.md)

**Pregunta:** Cómo entrenar una MLP pequeña con un protocolo fijo y controles negativos reproducibles.

Capacidades que se deben comprobar:

- Reproducir cinco recorridos sobre splits separados.
- Relacionar pesos, loss y actualizaciones full-batch.
- Contrastar la MLP con baseline e inicialización a cero.

Errores que se corrigen: Escoger semilla o epochs mirando test; Confundir accuracy perfecta del juguete con capacidad real; Mostrar curvas calculadas a mano como entrenamiento.

### DL-REPRESENTATIONS. [Representaciones aprendidas: qué significa que una red pueda aproximar una función](../../src/content/posts/es/representaciones-aprendidas-limites-aproximacion-universal.md)

**Pregunta:** Cómo interpretar features ocultas y separar representabilidad, optimización y generalización.

Capacidades que se deben comprobar:

- Inspeccionar activaciones ocultas de pesos entrenados.
- Interpretar el alcance de un teorema de aproximación.
- Reconocer inferencia sin evidencia fuera del soporte.

Errores que se corrigen: Atribuir semántica estable a una unidad oculta; Confundir existencia de pesos con encontrarlos; Interpretar un mapa coloreado como evaluación.

## Alcance experimental y aceptación

Código en `luisrc-blog-examples/packages/neural-foundations`. Nueve extractos Python
explicados dentro de los posts, cinco diagramas D2/SVG y tres gráficas estáticas.
El visor no entrena: recorre pesos archivados y calcula inferencia contrastada con
NumPy. Los controles de activations no cambian el entrenamiento tanh.

El laboratorio debe entrenar realmente la MLP de P096. Por eso se comprueban:

- Shapes, broadcasting, estabilidad de sigmoid/BCE y equivalencia de capas afines.
- Construcción XOR manual sobre bits, diferenciada del aprendizaje sobre puntos.
- Gradientes de los diecisiete parámetros frente a diferencias finitas antes de
  interpretar el descenso de la loss. Esta comprobación no acepta P097 completo.
- Splits independientes y balanceados, seeds y protocolo fijados antes de test.
- Cinco recorridos: baseline, ceros y tres seeds, sin elegir solo el que acierta.
- Reentrenamiento de los cinco casos y comparación de curvas/pesos/inferencias con
  tolerancias declaradas. Resultados del runtime NumPy fijado por digest.
- Inferencia JS frente a NumPy en probes de cada checkpoint y grid final completo.
- Vista de test solo al final, mapas con soporte visible y regiones no evaluadas,
  teclado, móvil/escritorio, error explícito y escalas comunes al comparar pérdidas.

Dataset: cuatro cuadrados uniformes alrededor de(±1,±1), semiancho0,45; train256,
validation128,test256. Tres MLP aciertan256/256test; logística y ceros50%. Esa evidencia
no afirma calibración, extrapolación al hueco o superioridad de redes en proyectos
reales. Tampoco prueba universal approximation, que se explica con una fuente
matemática y sus hipótesis, no se infiere de una figura.

## Qué queda después de este bloque

La [serie P097](ruta-forward-backward-autodiff.md) desarrolla computational graph, loss, chain rule, backpropagation, reverse-mode autodiff,
gradient checking y contraste con framework. Separar el forward/contribuciones,
backward por capa y comprobación numérica cuando sea necesario. No contar los tests
de P096 como sustituto de esos artículos. Después P098 optimizadores y P099 PyTorch,
con sus propios experimentos y sin presentar una simulación como entrenamiento.

Las siguientes fichas P100–P105 incluyen regularización, CNN, secuencias, attention,
transfer/fine-tuning y eficiencia GPU. Requieren evidencia adicional; la existencia
de este laboratorio CPU no las acredita. Conservar los gaps históricos del roadmap.
