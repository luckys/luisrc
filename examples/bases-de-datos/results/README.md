# Resultados y alcance

`benchmark.json` es la salida real del script `tools/benchmark.mjs`. Se conserva
para poder inspeccionar las muestras y reproducir la gráfica publicada. Una nueva
ejecución reemplaza ese resultado local; no cambia automáticamente el SVG del blog.

Entorno de la primera ejecución: Node.js 24.19.0, PostgreSQL 18.4 en Docker sobre
el host Linux del autor, sin carga generada de clientes concurrentes. Dataset
sintético determinista de 100 000 eventos, payload de 100 caracteres y 100 filas
por tenant. Sin control de frecuencia de CPU ni vaciado de cachés del sistema.
No es un benchmark representativo de hardware ni capacidad de producción.

Medianas iniciales de Execution Time: sin índice 5.211 ms; con índice 0.729 ms.
WAL generado al insertar 10 000 filas: 1 608 241 bytes sin índice y 2 268 901 con
un B-tree. Una pasada WAL por variante. No extrapolar porcentajes a otros casos.

Las pruebas funcionales no dependen de esos tiempos ni de una forma concreta del
plan. Exigen resultados y errores SQL: así separamos corrección de rendimiento.
