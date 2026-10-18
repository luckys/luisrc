# Procedencia de cálculos y simulaciones

Archivo: calculations.json. Datos ficticios y sintéticos, sin usuarios, mensajes,
grabaciones o modelos reales. Python 3.12.3, biblioteca estándar.
Semilla general 20261018, bootstrap con generador separado y semilla 17.

- Vectores, PCA, derivadas, trayectorias, pérdidas y FFT: cálculos numéricos.
- Latencia: 1.000 muestras log-normales, log-location ln(50), log-scale 1, en ms.
- Accuracy: 200 Bernoulli generadas con p=0,8; se observaron 155 unos.
- Bayes: 100.000 ensayos generados con prior 0,01, sensibilidad 0,9 y falsas
  alertas 0,05. Resultado: 853 spam entre 5.807 alertas. No es exactamente la
  posterior analítica, por variación de una muestra finita.
- Bootstrap: 2.000 réplicas con reemplazo de las 200 observaciones; percentiles
  0,025 y 0,975 mediante interpolación lineal en (n−1)p.
- A/B: enumeración de las 20 asignaciones posibles de tres unidades a cada grupo,
  puntuaciones 1–6 y dos extremos de magnitud 3. No hay muestreo Monte Carlo en ese test.
- Fourier: 64 muestras a 64 Hz, sinusoides de 5 y 12 Hz. Amplitud unilateral con
  factor dos solo en bins interiores. No se graba ni se reproduce audio.

No son benchmarks y no se controlan tiempos de ejecución o hardware. No se ha
realizado un estudio de cobertura, potencia estadística o calidad de un modelo.

`python3 experiments.py` imprime otra ejecución sin escribir archivos. Desde la
raíz del blog, `node scripts/calculate-math-series.mjs` **reemplaza** este JSON.
Mantiene la misma semilla; las bibliotecas/versiones y el orden del generador pueden
influir. Si cambias algo, revisa cifras de la prosa y regenera las gráficas.
