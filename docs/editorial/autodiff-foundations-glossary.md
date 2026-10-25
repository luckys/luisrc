# Glosario de forward, backward y autodiff

Complementa [fundamentos neuronales](neural-foundations-glossary.md) y
[matemáticas](math-series-glossary.md).

| Término | Uso en este bloque |
| --- | --- |
| Computational graph | Dependencias entre valores y operaciones del cálculo considerado. |
| Forward | Evaluación de valores desde las entradas hacia la salida. |
| Backward | Propagación inversa de sensibilidades mediante derivadas locales y suma de caminos. |
| Sensibilidad / adjoint | Derivada de la loss respecto a un valor intermedio en esta notación escalar. |
| Semilla inversa | Sensibilidad aportada a la salida; para L respecto a sí misma vale1. Distinta de una seed aleatoria. |
| Reverse-mode AD | Diferenciación que propaga sensibilidades desde salidas hacia entradas del programa ejecutado. |
| VJP | Producto de una sensibilidad de salida con el Jacobiano; con vectores columna se representa como J.T@v. |
| Logit | Score real previo a sigmoid en nuestro modelo binario. |
| Reducción mean | Promedio de pérdidas que fija la escala de su gradiente; aquí una salida por muestra. |
| Gradient checking | Contraste local de derivadas, por ejemplo con diferencias centrales; no prueba global. |
| Epsilon | Tamaño de perturbación numérica, con error de truncamiento y redondeo a equilibrar. |
| atol / rtol | Tolerancias absoluta y relativa que se aplican por componente, bajo un criterio declarado. |
| Leaf tensor | Tensor que no resulta de una operación registrada; nuestros pesos se crean como hojas entrenables. |
| Non-leaf tensor | Resultado intermedio registrado, como hidden; su gradiente no tiene que conservarse en .grad. |
| Retain_grad | Solicitud de conservar el gradiente de un tensor intermedio para inspección. |
| Retain_graph | Conservación de información necesaria para volver a derivar con el grafo; distinto de retain_grad. |
| Detach | Tensor separado del historial; comparte almacenamiento y no es una copia independiente de datos. |
| no_grad | Contexto que evita registrar operaciones ordinarias del forward para derivación inversa. |
| .grad = None | Reinicio/ausencia de buffer; su significado depende del recorrido. No equivale siempre a derivada cero. |
| Acumulación | Suma de contribuciones en un nodo o buffer; entre pasos requiere decidir cuándo reiniciar y actualizar. |
