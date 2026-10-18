# Observaciones del laboratorio

experiments.json: salida de experiments.mjs, Node 24.19.0 sobre Linux x64. El registro
incluye CPU, kernel y número de CPUs lógicas. No se aislaron frecuencia, otras cargas,
JIT o page cache; nueve muestras alternadas y tres calentamientos. No se afirma
latencia física de SSD/RAM. La suma esperada para el fixture de 2 MiB es 262139206.

cache y transport son trazas calculadas de modelos, no contadores del host o tráfico
capturado. El modelo de transporte usa valores hipotéticos declarados en el artículo.

browser.json: Chromium 141, navegación por HTTP/1.1 y recursos loopback; marcas de
eventos, long task e indicadores observados de cookie/CORS. El tiempo hasta el clic
incluye la espera del propio experimento, no debe atribuirse al servidor. Las cifras
son una realización, no una garantía temporal para otra ejecución.

No hay claves TLS, credenciales, sesiones reales o capturas de tráfico de terceros.
