# Forward, backward y autodiff: derivar antes de confiar

P097 se desarrolla en cinco drafts españoles, después de la
[serie de fundamentos neuronales](ruta-fundamentos-redes-neuronales.md). El bloque
cubre computational graph, loss, chain rule, reverse-mode y gradient checking,
con derivación manual y contraste ejecutado en PyTorch CPU.

La audiencia conoce matrices, derivadas y el entrenamiento NumPy de P096.
Se mantiene el modelo anterior como referencia, sin reescribir su entrenamiento.
Los artículos son independientes de PaySafe. Ver [manifiesto](autodiff-foundations-series.json),
[glosario](autodiff-foundations-glossary.md) y [revisión](autodiff-foundations-review.md).

## Orden y objetivos verificables

### P097. [Computational graph: seguir los caminos de una pérdida antes de derivarla](../../src/content/posts/es/computational-graph-regla-cadena-caminos.md)

**Pregunta:** Cómo aplicar la regla de la cadena cuando un valor se usa en más de un camino.

Capacidades que se deben comprobar:

- Separar valores del forward y sensibilidades del backward.
- Acumular contribuciones de todos los usos de un nodo.
- Interpretar la semilla de una pérdida escalar.

Errores que se corrigen: Sobrescribir contribuciones en un nodo compartido; Confundir backward con actualizar pesos; Tratar autodiff como diferencias finitas.

### DL-LOSS-GRADIENT. [Binary cross entropy: de dónde sale el gradiente p menos y](../../src/content/posts/es/binary-cross-entropy-logits-gradiente-promedio.md)

**Pregunta:** Cómo derivar BCE desde logits y aplicar una sola vez el promedio del batch.

Capacidades que se deben comprobar:

- Derivar el gradiente por logit paso a paso.
- Distinguir mean y sum en la pérdida.
- Detectar una derivada sigmoid añadida por error.

Errores que se corrigen: Memorizar p-y sin declarar la pérdida; Multiplicar dos veces por la derivada sigmoid; Olvidar la reducción o promediarla dos veces.

### DL-BACKPROP. [Backpropagation en una MLP: derivar pesos, bias y tanh con sus dimensiones](../../src/content/posts/es/backpropagation-matrices-dense-bias-tanh.md)

**Pregunta:** Cómo reconstruir el backward matricial completo y comprobar transpuestas y sumas.

Capacidades que se deben comprobar:

- Derivar dW2, db2, dH, dZ1, dW1 y db1.
- Justificar el eje que reduce el bias.
- Contrastar los diecisiete parámetros con PyTorch.

Errores que se corrigen: Elegir transpuestas solo para que encajen shapes; Volver a dividir por el batch al derivar el bias; Omitir la derivada de la activation oculta.

### DL-GRADCHECK. [Gradient checking: comprobar un backward sin confiar solo en que la loss baje](../../src/content/posts/es/gradient-checking-diferencias-finitas-epsilon.md)

**Pregunta:** Cómo diseñar diferencias finitas y tolerancias que detecten errores sin confundir redondeo.

Capacidades que se deben comprobar:

- Implementar diferencias centrales sin mutar parámetros.
- Explorar siete epsilons en tres configuraciones.
- Rechazar cuatro controles incorrectos con un criterio declarado.

Errores que se corrigen: Hacer epsilon tan pequeño como sea posible; Usar solo error relativo cerca de cero; Elegir tolerancias después de ver el resultado.

### DL-AUTODIFF. [Autograd en PyTorch: qué calcula backward y qué puede cortar el grafo](../../src/content/posts/es/pytorch-autograd-leaf-detach-acumulacion-vjp.md)

**Pregunta:** Cómo verificar leaf, acumulación, detach, valores guardados y un producto vector-Jacobiano.

Capacidades que se deben comprobar:

- Reproducir autograd con los mismos pesos y float64.
- Distinguir gradiente cero de ausencia de trayectoria en el caso.
- Comparar VJP, backward manual y gradcheck.

Errores que se corrigen: Esperar que backward cambie pesos; Confundir retain_grad con retain_graph; Ocultar un None convirtiéndolo automáticamente en cero.

## Escenario y aceptación

Código en `luisrc-blog-examples/packages/autodiff-foundations`. Importa el modelo
canónico y lee el checkpoint de P096; las dos dependencias se incluyen en hashes.
No se modifica el código ni se reemplazan las observaciones de P096 bajo otro runtime.

- Grafo escalar compartido q=w*x,r=q+q,L=r². Forward, semilla1, contribuciones
  sumadas y gradientes cotejados con PyTorch en cuatro entradas declaradas.
- MLP2→4→1,tanh,BCEmean,float64. Cuatro puntos XOR; pesos iniciales7/31 y checkpoint
  entrenado7. Orden W1,b1,W2,b2,17componentes. Traza completa y batch3 adicional en test.
- Diferencias centrales, siete epsilons, criterio por componente declarado antes
  de observar errores. Copias de parámetros sin mutación. Mostrar también rechazos
  por perturbación grande o redondeo, no solo el mejor punto del barrido.
- Cuatro variantes incorrectas rechazadas en los tres casos. Separar estadísticas
  de error, aceptación numérica y la comprobación gradcheck de la función PyTorch.
- Autograd real: leaf/non-leaf después de backward, retain_grad, acumulación2g,
  resetg, pesos inmutados, detach con12None, grafo consumido, no_grad y VJP.
- RuntimeCPU fijado por digest, versiones comprobadas; diez tests Python y tres JS.
  Sin requerir paquetes Python en host o llamadas a servicios de pago.
- Cinco diagramas, dos gráficas y visor dinámico de etapas/epsilon/parámetros.
  None no se vuelve cero; el visor no ejecuta un framework en el navegador.
- Teclado, móvil/escritorio, tablas, escalas, datos/figuras concordantes y error de
  carga explícito. Drafts aislados del build publicado y exports permitidos.

Hay cinco preguntas distintas y cada post queda en torno a1200palabras con código
y metadatos. Se valoró dividir el último: su foco es diagnosticar el estado de
autograd sobre un único forward ya conocido y los casos están ejecutados juntos;
no añade entrenamiento/optimización. Se mantiene esa unidad antes de P098.

## Continuación del roadmap

P098 continúa en [la ruta de optimizadores](ruta-optimizadores-entrenamiento.md), con experimentos sobre idénticas muestras y
comparaciones claras de actualizaciones, epochs, batches, schedules y acumulación.
Los gradientes verificados son su entrada, no una sustitución de ese laboratorio.
P099–P105 continúan pendientes y conservan sus propios criterios de aceptación.
