# Mediciones y su interpretación

`load.json` contiene una ejecución real del servicio sintético local de
`tools/load.mjs`, Node.js 24.19.0 sobre Linux, cliente y servidor en un proceso.
Incluye todas las muestras, warm-up fuera de la muestra, concurrencias, códigos,
duración y fórmulas de percentil nearest-rank. Cada etapa hace 120 solicitudes.

El servicio introduce intencionadamente una espera de 20 ms y un cupo de 4. No
representa hardware de producción, PostgreSQL, un proveedor real ni una API del
proyecto. No hay repeticiones estadísticas, aislamiento de CPU ni llegadas abiertas.

La gráfica del artículo se genera de este JSON. Repetir `node tools/load.mjs`
reemplaza únicamente el resultado del laboratorio; la gráfica del blog requiere
ejecutar el renderizador de la raíz del repositorio.
