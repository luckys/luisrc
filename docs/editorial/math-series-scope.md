# Serie 08: Matemáticas y estadística

Encargo: guardar Frontend y tiempo real y continuar con el siguiente bloque del
roadmap. Commit realizado: `21aa2f5` en posts-series. La nueva entrega es P076–P085,
solo español, draft, autor Luis Ramírez Calle; sin publicación, traducción o audio.

## Público, orden y aceptación

Ingenieros que programan y necesitan interpretar shapes, gradientes e incertidumbre
antes de abordar Machine Learning. No se presupone haber completado todo el catálogo
de computación ni conocer PaySafe. Recuperar solo los fundamentos necesarios.

Orden de lectura en ruta-matematicas-estadistica.md e inventario en math-series.json.
Dependencias conceptuales sin ciclos, aunque el orden de navegación sea lineal.
No hacer depender Bayes de gradiente descendente por aparecer después en el índice.

Cada post: problema concreto, intuición, fórmulas con variables y unidades explicadas,
código con archivo identificado, visual propio, alternativas, garantías/límites,
ejercicio comprobable y referencias primarias. Palabras clave destacadas sin convertir
todo el texto en negrita. Mantener términos ingleses habituales y español natural.

## Objetivos y errores de revisión

| ID   | Tres objetivos                                                               | Tres errores que evitar                                                              |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P076 | Interpretar shapes; calcular dot/matmul; distinguir norma/distancia/coseno   | zip silencioso; coseno igual a distancia; normalizar siempre                         |
| P077 | Centrar y proyectar; reconstruir 3D→2D; explicar varianza perdida            | cambio de base igual a reducción; varianza igual a utilidad; PCA ajustado sobre test |
| P078 | Derivar composición; distinguir gradiente/Jacobiano; comprobar numéricamente | olvidar dependencia; h cero; paso menor siempre mejor                                |
| P079 | Deducir contracción; experimentar con η; reconocer punto estacionario        | paso universal; gradiente cero igual a mínimo; límite numérico igual a convergencia  |
| P080 | Identificar denominador; calcular posterior; contrastar simulación           | invertir condicional; ignorar prior; asumir señales independientes                   |
| P081 | Elegir resúmenes; identificar familias; conservar unidades y cuantiles       | normal para todo; promediar p95; ignorar timeouts                                    |
| P082 | Definir población/unidad; remuestrear; interpretar cobertura                 | bootstrap corrige sesgo; CI igual a posterior; réplicas igual a muestra nueva        |
| P083 | Definir nula/diseño; enumerar; separar efecto/potencia/p-value               | p es P(nula); no significativo igual a equivalencia; parar al cruzar umbral          |
| P084 | Relacionar H/CE/KL; interpretar NLL; estabilizar logits                      | score es probabilidad; KL simétrica; softmax calibra                                 |
| P085 | Recuperar tonos; distinguir DFT/FFT; verificar aliasing/convolución          | padding añade resolución física; FFT recupera alias; igualdad exacta entre floats    |

## Implementación proporcionada

Laboratorio Python 3.12+ sin dependencias externas: evita instalaciones ajenas al
requisito de usar pnpm y deja visibles las operaciones. No se prohíben NumPy/SciPy:
se explican como alternativas preferibles para trabajo científico real.

Trece tests escritos antes de foundations.py y ejecutados en rojo, después solución.
Simulador de optimización HTML/JavaScript nativo y pruebas de concordancia con Python.
Resultados sintéticos archivados, semilla y versión. Diez D2/SVG y cuatro gráficas
generadas desde cálculos, no cifras inventadas ni benchmarks.

## Límites respecto al catálogo

P077 reduce realmente seis observaciones 3D a 2D; eigensolver limitado a 2/3 features,
sin implementar SVD o whitening. P079 incluye simulador de parábola/doble pozo, no
entrenamiento multidimensional. P082 implementa percentile bootstrap, no BCa ni
estudio de cobertura repetida. P083 enumera experimento sintético exacto, no power
analysis o un programa A/B de producción. P085 implementa FFT radix-2 y DFT, no STFT
ni adquisición de señales. No presentar esas extensiones como ya construidas.

Verificación: tests numéricos y editoriales, ZIP extraído, KaTeX renderizado sin errores,
HTML noindex, navegación y responsive, inspección de SVG/gráficas y build. Registrar
solo resultados obtenidos en math-series-review.md. No modificar UI general del blog.
