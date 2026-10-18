# Resultados locales, 18 de octubre de 2026

experiments.json se genera con `pnpm lab`. Contiene entorno, protocolo, 56 planes
SQL medidos (cuatro profundidades × siete rondas × dos estrategias), muestras sin
agregar y observación de una inserción entre páginas. Las gráficas del blog y la
tabla utilizan las medianas de esas siete muestras, no cifras inventadas.

La ejecución publica 1.000.000 de filas iniciales y 400.000 elegibles en tenant 1/paid.
No se incluyen datos privados. Los tiempos pertenecen al entorno tmpfs/caché caliente
descrito en el README; no comparan rendimiento bajo escrituras simultáneas.
Repetir el experimento sustituye este resultado local. Actualizar después la tabla,
las gráficas y el ZIP, o el test editorial señalará que el post quedó desincronizado.
