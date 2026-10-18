# Glosario de Machine Learning clásico

| Término                   | Significado usado en la serie                                                     |
| ------------------------- | --------------------------------------------------------------------------------- |
| Feature / target          | Entrada disponible al decidir / resultado que intentamos predecir                 |
| Sample                    | Unidad observada; aquí un envío, no cualquier fila sin interpretar                |
| Baseline                  | Referencia simple que permite justificar complejidad adicional                    |
| Fit / transform           | Aprender estado de una transformación / aplicarlo sin reaprender                  |
| Leakage                   | Información no disponible o no permitida que contamina ajuste/evaluación          |
| Hyperparameter            | Configuración elegida fuera del ajuste ordinario de parámetros                    |
| Train / validation / test | Ajuste / selección y diagnóstico / evaluación final del procedimiento fijado      |
| Threshold                 | Umbral que convierte un score en clase o acción                                   |
| Precision / recall        | Positivos correctos entre alertas / detectados entre positivos reales             |
| AP                        | Average precision, suma ponderada por incrementos de recall; no trapecios PR      |
| Calibration               | Correspondencia entre probabilidades predichas y frecuencias pertinentes          |
| Brier                     | Media de pérdidas cuadráticas probabilísticas; no descalibración pura             |
| Ablation                  | Retirar una parte manteniendo el resto para estudiar su aportación                |
| Clustering                | Partición por geometría o densidad; no etiquetas reales garantizadas              |
| ARI                       | Comparación de particiones corregida por azar e invariante al nombre de etiquetas |
| Permutation importance    | Dependencia predictiva medida por degradación al barajar una feature              |
| Fairness                  | Evaluación contextual de beneficios/daños y grupos, no un sello por una métrica   |
| Drift                     | Cambio de datos o relaciones respecto al periodo que permitió evaluar el modelo   |
