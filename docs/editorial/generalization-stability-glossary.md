# Glosario: generalización y estabilidad

| Concepto | Significado aquí | Distinción |
| --- | --- | --- |
| Overfitting | Ajustar detalles train que perjudican fuera de él | No equivale a divergencia numérica |
| Underfitting | Ajuste insuficiente para la estructura buscada | Una loss alta también puede ser fallo de optimización |
| Bias | Predicción media menos señal bajo un diseño | No es el parámetro bias de una neurona |
| Variance | Variabilidad entre ajustes de muestras distintas | No se estima con una sola curva |
| Ruido irreducible | Contribución esperada bajo un generador | No cota de toda MSE finita |
| Fan-in/fan-out | Dimensiones de entrada/salida | Hipótesis de escala,no garantía de Jacobianos |
| Segundo momento | Media de activaciones cuadradas | No es varianza si la media no es cero |
| Saturación | Sensibilidad pequeña en extremos de tanh/sigmoid | No se etiqueta así la rama positiva de ReLU |
| Running stats | Estado acumulado de BatchNorm | Momentum diferente del optimizador |
| Normalized_shape | Últimos ejes de LayerNorm | No equivale al eje de batch |
| Inverted dropout | Máscara ydivisión por1−p en train | Eval identidad,no promedio exacto de toda red |
| Weight decay | Contracción declarada por grupos | Norma pequeña no garantiza generalización |
| Patience | Observaciones sin mejora aceptada | Indicar frecuencia antes de traducir aepochs |
| Last/best/selected | Último entrenado/mejor visto/elegido | No reescribir una curva con los pesos restaurados |
| Gradient clipping | Reescalado de gradientes por norma | No cota universal de un optimizer step |
| Guard de loss | Condición operativa de interrupción | No equivale aobservar un infinito |
