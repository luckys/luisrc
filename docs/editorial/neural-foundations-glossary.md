# Glosario de fundamentos neuronales

Complementa [matemáticas](math-series-glossary.md) y [ML clásico](ml-series-glossary.md).

| Término | Definición en este bloque |
| --- | --- |
| Neurona/unidad | Combinación de entradas mediante pesos y bias, seguida de la función que se declare. |
| Weight | Parámetro que multiplica una entrada o feature; no demuestra causalidad. |
| Bias | Desplazamiento afín aprendido; distinto de bias como error de un estimador. |
| Perceptrón | Unidad de score afín y decisión de umbral; no confundir su actualización clásica con BCE. |
| Dense layer | Unidades que reciben todas las features anteriores con parámetros propios compartidos entre muestras. |
| Batch | Grupo de muestras procesadas; aquí filas, con features en columnas. |
| Broadcasting | Reglas para operar shapes compatibles; no garantizan la semántica deseada. |
| Activation | Función aplicada a valores de una capa; la no linealidad impide colapsar en general capas afines. |
| Logit | Score real anterior a sigmoid en esta clasificación binaria. |
| Hidden representation | Features calculadas por una capa intermedia; sus índices no tienen semántica fija. |
| Full-batch | Gradiente calculado usando todo train en una actualización. |
| Epoch | Recorrido por train; con nuestro protocolo coincide con una actualización full-batch. |
| Checkpoint | Pesos y métricas guardados en un punto del entrenamiento; no elección del mejor modelo por test. |
| BCE desde logits | Pérdida binaria media calculada con logaddexp y logaritmos naturales, en nats por muestra. |
| Saturación | Región donde una activation cambia poco y su derivada puede transmitir una señal pequeña. |
| Representabilidad | Existencia de parámetros dentro de la familia para aproximar la función considerada. |
| Optimización | Procedimiento para buscar parámetros que reduzcan la loss, con sus límites de convergencia. |
| Generalización | Comportamiento en datos no usados al ajustar, de una población y protocolo relevantes. |
| Universal approximation | Resultado de existencia con hipótesis sobre función, dominio y arquitectura; no garantía de aprender o generalizar. |
| Soporte del generador | Región donde pueden aparecer muestras del dataset declarado; distinto de todo el grid que coloreamos. |
