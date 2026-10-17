# Medición archivada

`dom.json` conserva la ejecución del 17 de octubre de 2026. Node 24.19.0,
Chromium 141.0.7390.37, Linux, Intel Core Ultra 9 285H, viewport 1280×720,
sin CPU throttling configurado. No se controla carga externa del host.

Una ronda por variante de calentamiento, después siete rondas alternando el
orden. Mismo texto y CSS por fila; se cambia cuántas filas se montan.
Intervalo: crear nodos, insertarlos y forzar layout mediante getBoundingClientRect.
No mide toda una interacción ni el tiempo hasta presentar píxeles al usuario.

Medianas observadas: 5.000 nodos de fila, 41,5 ms; 14, aproximadamente 0,3 ms.
No extrapolar un factor de mejora a React ni a dispositivos distintos.
La variante de 14 representa solo una ventana, no acceso simultáneo a todas
las filas con búsqueda o tecnologías de asistencia.

Reproducir: `pnpm exec node tools/measure-dom.mjs` desde el laboratorio.
El comando **reemplaza** las muestras archivadas con las de tu ejecución.
