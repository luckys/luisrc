# Serie 09: Machine Learning clásico

Encargo: commit de Matemáticas y estadística y siguiente serie. Commit anterior
creado: `ffb1a33`. Entrega P086–P095, español, draft, Luis Ramírez Calle. Sin audio,
traducción, publicación o push. La nueva serie queda sin commit para revisión.

## Público y aceptación

Ingenieros que ya programan y conocen las bases matemáticas, pero necesitan aprender
a definir tareas, preparar datos y evaluar predicciones. Ejemplos logísticos ficticios,
independientes de cualquier empresa. No convertir un score en causalidad o equidad.

Diez preguntas centrales, un artículo por pregunta. Cada uno tendrá mecanismo,
alternativas, código probado con ruta, visual propio, límites, ejercicio y fuentes
primarias. Mantener términos ingleses habituales, explicarlos y destacar lo importante.
Datos sintéticos identificados como tales y números calculados, no benchmarks.

| ID   | Objetivos de lectura                                                 | Errores que evitar                                                                            |
| ---- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P086 | Elegir tarea, target, instante y baseline; clasificar diez problemas | Predicción igual a intervención; clustering igual a clase; automatizar sin necesidad          |
| P087 | Auditar tipos, faltantes, duplicados y distribución; delimitar EDA   | Borrar nulos por defecto; correlación causal; explorar test para decidir                      |
| P088 | Ajustar imputación, encoding y scaling dentro de cada fold           | Fit global; feature posterior al resultado; pipeline como garantía total                      |
| P089 | Entender MSE, sigmoid, log loss y penalización; contrastar OLS       | Probabilidad calibrada por usar sigmoid; coeficiente causal; invertir matrices                |
| P090 | Comparar árbol, RF y boosting bajo igual protocolo                   | Más árboles siempre mejor; ganador universal; atribuir resultados a bibliotecas no ejecutadas |
| P091 | Contrastar geometrías, ruido y estabilidad                           | Cluster igual a verdad; silhouette sin ruido; PCA garantiza separación                        |
| P092 | Separar selección y evaluación; elegir split para el despliegue      | Random split siempre inválido; futuro mezclado; test para elegir hiperparámetros              |
| P093 | Relacionar costes, matriz, ranking y unidades                        | Accuracy suficiente; AP igual a trapecios PR; ROC-AUC igual a utilidad                        |
| P094 | Separar ranking, calibración, explicación y grupos                   | SHAP causal; igualdad de una métrica certifica equidad; calibrar en test                      |
| P095 | Fijar protocolo, registrar datos/entorno y analizar errores          | Semilla suficiente; elegir semilla por score; bootstrap i.i.d. para cualquier dependencia     |

## Laboratorio y evidencia prevista

Python con NumPy, pandas, SciPy y scikit-learn reales. Se ha encontrado una imagen
científica ya descargada, fijada por digest en runtime.json. Ejecutar sin red ni
instalación, montaje de solo lectura y filesystem efímero. No usar pip/conda ni
cambiar dependencias del blog; cualquier instalación futura debe respetar pnpm.

Tests primero, dataset CSV versionado, particiones temporales 540/180/180, protocolo
final predefinido, resultados JSON, gráficas desde esos resultados y ZIP autocontenido
en código/datos (no incluye imagen Docker ni librerías). No evaluar producción.

También se ofrece un explorador dinámico de thresholds/costes, enlazado desde P093,
con datos únicamente de validation y comprobación de teclado en navegador.

XGBoost, LightGBM y SHAP se explican como herramientas alternativas, no se afirma
haberlos ejecutado. No hay causal inference implementada, fairness certificada,
tracking remoto, despliegue de modelos ni entrenamiento de Deep Learning.
