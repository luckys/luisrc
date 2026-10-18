# Matemáticas y estadística

Laboratorio de P076–P085. **Python 3.12+ y biblioteca estándar**, sin instalaciones,
cuentas, datos externos o servicios de pago. Verificado con Python 3.12.3.

```bash
python3 -m unittest discover -s tests -v
python3 experiments.py
```

`foundations.py` contiene las funciones; `experiments.py` calcula y simula los
ejemplos. Imprime JSON por stdout y no modifica archivos. El resultado archivado
está en `results/calculations.json`. Datos ficticios, semilla 20261018. El bootstrap
utiliza un generador independiente con semilla 17, 2.000 réplicas.

## Qué ejecutar por artículo

| ID   | Funciones / experimento                                     |
| ---- | ----------------------------------------------------------- |
| P076 | dot, matmul, cosine; norma y distancia                      |
| P077 | pca; seis observaciones 3D a 2D, reconstrucción y varianza  |
| P078 | derivative; regla de la cadena frente a diferencias finitas |
| P079 | descend; tres learning rates; simulador local               |
| P080 | bayes_flag; prior ficticio y 100.000 ensayos simulados      |
| P081 | quantile; 1.000 latencias log-normales sintéticas           |
| P082 | bootstrap_mean; 200 etiquetas binarias sintéticas           |
| P083 | permutation_mean; veinte asignaciones exactas               |
| P084 | entropy, cross_entropy, kl_divergence, softmax, nll_logits  |
| P085 | dft, fft radix-2, convolve; señal 5/12 Hz y aliasing        |

## Simulador del learning rate

```bash
python3 -m http.server 4401 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4401/simulator.html`, elegir parábola o doble pozo y
cambiar punto inicial/learning rate con teclado. Detener el servidor con Ctrl+C.
Sirve solo esta carpeta local: no arrancarlo desde un directorio con datos sensibles.
El simulador usa JavaScript nativo, sin npm ni build. La gráfica adapta su eje vertical;
consulta también los valores numéricos. Límite de 30 pasos y |x| <= 1.000.000.

## Qué garantiza y qué no

- PCA admite únicamente 2 o 3 features: eigensolver de Jacobi pequeño, tolerancia
  absoluta 1e-12 y máximo 100 iteraciones. No usar para datos mal condicionados
  ni como sustituto de SVD en una biblioteca científica. No implementa whitening.
- Las matrices deben ser rectangulares y finitas. Vectores de demostración de
  escala moderada; no se garantiza estabilidad para magnitudes extremas.
- Las diferencias finitas comprueban una derivada; no implementan autodiff.
- El descenso es unidimensional, con paso fijo. No implementa mini-batches o Adam.
- El bootstrap percentile supone observaciones adecuadamente independientes y
  representativas. No arregla sesgo ni garantiza cobertura nominal con cualquier muestra.
- El test de permutación enumera todas las asignaciones, con límite 16 observaciones.
  Su interpretación exige un diseño que permita intercambiar etiquetas bajo la nula.
- Las probabilidades son discretas, sobre el mismo soporte. Logs naturales: nats.
  No confundir softmax con calibración de un clasificador.
- FFT solo admite longitudes potencia de dos; no es una implementación optimizada.
  Convolución lineal completa, sin padding implícito de redes neuronales.
- Las cifras son resultados de ejemplos sintéticos, no benchmarks ni datos reales
  de modelos, latencias, usuarios o filtros de spam.
- NumPy, SciPy y scikit-learn se citan como alternativas para trabajo real; no se instalan.

En el repositorio del blog, `node scripts/calculate-math-series.mjs` reemplaza
la copia archivada con una ejecución. `render-math-series.mjs` genera SVG desde
esa copia; no vuelve a simular. Revisa el texto de cifras si cambias datos o semilla.
