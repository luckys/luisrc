# Laboratorio de Fundamentos de bases de datos

Ejemplos educativos independientes de cualquier producto. Solo datos ficticios.
No conectar a una base de datos real ni sustituir la configuración por credenciales
de otro entorno. Cada capítulo reinicia su esquema `db_*` mediante DROP SCHEMA.

## Requisitos y ejecución

- Docker y Docker Compose.
- Node.js >=22.12 para pruebas y mediciones. Solo usa módulos estándar: no hay
  paquetes que instalar. Si amplías el laboratorio, usa pnpm para las instalaciones.
- PostgreSQL 18.4 y Redis 8 se obtienen de las imágenes fijadas por digest en
  `docker-compose.yml`. No se publican puertos ni se montan datos del host.

Desde esta carpeta:

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/01-modelo.sql
node --test tests/lab.test.mjs
node tools/benchmark.mjs
```

Para abrir una sesión interactiva (dos terminales para experimentos concurrentes):

```bash
docker compose exec postgres psql -X -U lab -d series_lab
```

`\ir` incluye archivos relativos al script actual. Ejecutar con `-f /lab/sql/...`
mantiene esa resolución. No copies esos comandos como SQL de un driver.

## Capítulos

| Archivo               | Experimento                           | Qué comprobar                                            |
| --------------------- | ------------------------------------- | -------------------------------------------------------- |
| 01-modelo.sql         | Clientes, pedidos, productos y líneas | FK, CHECK, PK y unicidad                                 |
| 02-aislamiento.sql    | Setup de cuentas y guardias           | Lecturas por snapshot y write skew con dos sesiones      |
| 03-concurrencia.sql   | Setup de stock y reservas             | Lost update, descuento condicional y versión             |
| 04-consultas.sql      | Vistas de totales                     | 6500 incorrecto al duplicar filas frente a 3500 correcto |
| 05-analitica.sql      | Acumulados y cohortes                 | Dos compras, acumulados 3000/3500, actividad mensual     |
| 06-normalizacion.sql  | Materialized view                     | 3500 obsoleto; 4500 tras refresh                         |
| 07-indices.sql        | 100 000 eventos y B-tree              | Planes y tamaño, no ratio universal                      |
| 08-indices-diseno.sql | Compuesto, parcial e INCLUDE          | Filtrado, ordenación y heap fetches                      |
| 09-planes.sql         | EXPLAIN y estadísticas                | Filas estimadas/reales y distinta selectividad           |
| 10-migraciones.sql    | Expand–migrate–contract               | SQL secuencial; no despliegue distribuido simulado       |
| 11-particionado.sql   | Enero y febrero                       | Límite semiabierto, pruning y detach                     |
| 12-cache.sql          | Setup de precio                       | Carrera entre lector, escritura e invalidación           |
| 13-motores.sql        | Proyección JSON desde relaciones      | Forma de respuesta distinta del modelo persistente       |

Los artículos contienen las secuencias interactivas completas. Los scripts 02,
03 y 12 son setups, no reproducen por sí solos los intercalados. Las pruebas
automatizan esas secuencias con sesiones separadas y barreras de respuesta.
Se ejecutan en serie porque algunos capítulos reinicializan el mismo esquema.

## Método de medición

`tools/benchmark.mjs` reconstruye únicamente `db_perf`. Compara la misma consulta
sin/con índice sobre el mismo dataset: 100 000 filas, 100 coincidencias. Una
ejecución de calentamiento por variante y siete muestras; mediana de Execution
Time del servidor, no tiempo total de proceso ni petición HTTP.

Guarda versión, ajustes, muestras y planes completos en `results/benchmark.json`.
La comparación WAL inserta 10 000 filas en dos tablas nuevas, una sin índice y
otra con uno. Es una pasada por variante: sirve para observar bytes y registros
generados, no para inferir latencia estadística de escritura o desgaste del disco.

Resultados sensibles a caché, instrumentación, CPU, disco y contención del host.
No se ejecutan MongoDB ni DynamoDB; su comparación en el artículo es conceptual.

## Limpiar el entorno

Al terminar, desde esta carpeta, elimina **solo los contenedores y volúmenes del
proyecto luisrc-database-series**:

```bash
docker compose down --volumes
```

No hay persistencia prometida para estos datos de laboratorio. No uses `down`
contra otros proyectos para liberar recursos.
