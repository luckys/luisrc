# Procedencia del experimento

benchmark.json fue calculado con `node scripts/calculate-algorithms.mjs` el
18 de octubre de 2026. Conserva entorno, carga, checksums, contadores, las nueve
muestras de cada caso y sus medianas. Los artículos y SVG se basan en ese archivo.

Tres tamaños y cuatro patrones: 12 casos; tres variantes y nueve muestras: 324
duraciones individuales, todas en ms por lote de 200 consultas. Cinco warmups de
cada variante para cada caso no forman parte de las muestras publicadas.

- scan incluye las búsquedas lineales y el checksum.
- indexed incluye consultas y checksum, pero no construcción del índice.
- fresh incluye construcción (con validación de IDs), consultas y checksum.
- Fixture, consultas y comprobación del resultado quedan fuera del reloj.

No hay medición separada de construcción; restar medianas no produce su tiempo
exacto. Casos y tamaños se ejecutan en orden fijo. Variantes rotan orden por muestra.
No se fuerza GC, afinidad, frecuencia, estado de cachés ni se aíslan procesos por
caso. Los intervalos muy cortos son especialmente sensibles a ruido y JIT. CPU y
kernel describen el host visible, no la ausencia de otros procesos o límites del
contenedor. No interpretar estas medianas como percentiles de una API de producción.

El explorador cuenta operaciones según entradas conocidas, no tiempos estimados.
