# Revisión: Matemáticas y estadística

Fecha: 18 de octubre de 2026. Autor: Luis Ramírez Calle. Estado: draft.
Encargo: commit de la entrega anterior y siguiente serie del roadmap.

Commit creado: `21aa2f5`, Frontend y tiempo real, rama posts-series.
Esta nueva serie queda sin commit para revisión. Sin push, publicación, traducciones
o audios nuevos. El siguiente bloque propuesto es Machine Learning clásico.

## Contenido entregado

Diez artículos P076–P085, 8.879 palabras contando metadatos y código, entre 824 y 980
por archivo bajo el mismo recuento. Índice en ruta-matematicas-estadistica.md.
Diez diagramas D2/SVG, cuatro gráficas calculadas y 135 expresiones KaTeX renderizadas.
Laboratorio de ocho archivos descargables, Python 3.12.3 y biblioteca estándar.
Simulador HTML/JavaScript sin dependencias. No hay datos de usuarios o servicios reales.

## Evidencia ejecutada

- `node --test tests/*.test.mjs`: 34 tests del repositorio aprobados, incluidos
  seis nuevos: inventario/drafts/dependencias, enlaces/SVG, extractos de código,
  inventario y bytes de ZIP, reproducción de cálculos y concordancia del simulador.
- Desde examples/matematicas-estadistica: `python3 -m unittest discover -s tests -v`:
  trece tests aprobados. Dimensiones, coseno, PCA y reconstrucción, derivada compuesta,
  convergencia/divergencia, Bayes, bootstrap, permutaciones, H/CE/KL, logits y FFT/DFT.
- **47 tests distintos** en total. Las repeticiones del ZIP no vuelven a sumarse.
  No se han reejecutado aquí integraciones PostgreSQL/Redis o todos los escenarios
  del laboratorio frontend anterior; su evidencia está en sus revisiones.
- Los trece tests Python se escribieron antes de foundations.py y se observó rojo
  por módulo ausente. Después se implementaron y ajustó una igualdad exacta incorrecta
  entre floats a tolerancia absoluta equivalente a diez decimales del valor conocido.
- ZIP extraído en `/tmp/math-zipcheck.*`: los trece tests y experiments.py funcionan
  desde la copia aislada, sin instalar paquetes. Incluye código, tests, simulador,
  documentación y resultados; excluye bytecode y carpetas de caché.
- `node scripts/check-math-drafts.mjs`: diez páginas, 135 fórmulas sin katex-error,
  CSS matemático, quince recursos accesibles, noindex, numeración 1/10–10/10 y anclas TOC.
- Chromium 141 con Playwright ya instalado en el workspace frontend: veinte vistas
  (diez artículos a 1440 y 360 px), sin overflow horizontal global. Las fórmulas largas
  conservan el scroll interno previsto por el CSS existente; no se cambió UI del blog.
- Simulador en Chromium: tres escenarios comprobados mediante sus controles,
  incluyendo teclado: trayectoria inicial, learning rate 1,1 con pérdida creciente,
  y doble pozo desde cero con pérdida estacionaria 1. Responsive a 360 px.
- `pnpm build`: 48 páginas públicas; Pagefind indexa ocho artículos, dos idiomas.
  No se generan rutas públicas de estos diez borradores.
- `git diff --check`: sin errores.

## Procedencia y límites numéricos

results/calculations.json conserva muestras y resultados, versión y semillas.
El test Node vuelve a ejecutar experiments.py y compara el objeto calculado.
Las simulaciones usan semilla 20261018; bootstrap, generador separado con semilla 17.

PCA: seis observaciones 3D→2D; autovalores 7,2/3,2/0,1; varianza retenida 99,0476 %;
error cuadrático 0,5. No se identifica varianza retenida con capacidad predictiva.
Derivadas: expresión cuadrática con valor analítico 12 y barrido independiente para seno.
Descenso: trayectorias de x² y contrapunto estacionario del doble pozo, no entrenamiento.
Bayes: posterior analítica 90/585, simulación 853/5807; no confundir teoría y realización.
Latencia: 1.000 observaciones log-normales sintéticas, método de cuantiles explícito.
Accuracy: 155/200 y bootstrap percentile [0,715, 0,830], sin afirmar cobertura verificada.
A/B: veinte asignaciones enumeradas, efecto 3 y p-value 0,1 bajo nula/diseño definidos.
Información: logaritmos naturales y tratamiento explícito de soporte cero.
FFT: radix-2 frente a DFT directa, picos 5/12 Hz, aliasing y convolución lineal completa.

No se presentan tiempos, comparaciones de rendimiento, calidad de modelos ni tasas
de producción. No se ha realizado power analysis, cobertura repetida o inferencia
sobre datos reales. La biblioteca numérica pequeña no sustituye NumPy/SciPy.

## Incidencias y revisión visual

Se inspeccionaron los diez diagramas y cuatro gráficas como PNG. El primer diagrama
de chain rule era demasiado horizontal; al pasarlo a vertical una arista de retorno
solapaba etiquetas. Se sustituyó por un nodo explícito con el producto final y se
inspeccionó de nuevo `/tmp/math-chain-rule.png`, ya sin superposición.

Las etiquetas decimales largas de ejes logarítmicos se cambiaron a notación científica.
Se revisaron `/tmp/math-derivative-error.png` y `/tmp/math-learning-rates.png` después
del cambio, además de latency-cdf y spectrum. No hay etiquetas recortadas visibles.

Capturas del artículo Bayes a ambos anchos: `/tmp/math-post-1440.png`,
`/tmp/math-post-360.png`; fórmula en `/tmp/math-formula-360.png`; simulador en
`/tmp/math-simulator.png`. Son QA temporal, no baselines automáticos de visual regression.

Una invocación experimental de unittest desde la raíz del blog sin configurar imports
no encontró foundations. La forma documentada, desde el directorio del laboratorio,
funciona tanto en repo como en ZIP; no se presenta el comando erróneo como reproducible.

## Revisión editorial y fuentes

Aplicada la guía de escritura: escenario concreto, explicación de denominadores,
formas y unidades, mecanismo antes de biblioteca, alternativas y límites explícitos,
ejercicios con resultado comprobable. Términos ingleses definidos y destacados.
Sin guiones largos, testimonios inventados, comparaciones de velocidad no medidas
o dependencias de PaySafe.

Fuentes primarias consultadas: MIT OCW, capítulos de Deep Learning, CS231n de Stanford,
ProbabilityCourse, NIST, ASA, Python 3.12, NumPy, SciPy, scikit-learn, Google ML Crash
Course y documentación PyTorch Conv1d. La URL stable de PyTorch redirige: se siguió
al documento 2.14 y se verificó cross-correlation. Una página de Penn State no se
pudo consultar y no se usó como referencia; CLT se contrastó con ProbabilityCourse.
Sin citas textuales extensas o tablas de rendimiento tomadas de terceros.

## Fuera de alcance

SVD general, autodiff, redes neuronales, whitening, bootstrap BCa, cobertura repetida,
power analysis, tests secuenciales, procesamiento de audio real y STFT. Se describen
solo los conceptos necesarios y no se marcan estas extensiones como implementadas.
No se ha certificado accesibilidad con lectores de pantalla ni probado Safari/Firefox.
No se dejan servidores locales arrancados como parte de la entrega.
