# Laboratorio de fundamentos de bases de datos

Ejemplos educativos de ACID y transacciones con datos ficticios. No implementan una
plataforma bancaria ni un sistema de cobros. Incluyen SQL independiente y una
ampliación opcional con TypeScript.

## Requisitos

- Docker con Compose.
- Solo para TypeScript: Node.js >=22.12.0 y pnpm 12.8.1.

## Ejemplos SQL

Desde esta carpeta:

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/setup.sql
docker compose exec -T postgres psql -U lab -d transactions_lab < sql/atomicity.sql
```

El setup restablece únicamente las tablas ficticias de `concept_examples`.
Ejecuta de nuevo el setup antes de cada experimento independiente.

- `sql/atomicity.sql`: débito confirmado por separado, rollback y transferencia completa.
- `sql/consistency.sql`: CHECK rechaza stock negativo.
- `sql/isolation-reader.sql` y `isolation-writer.sql`: dos sesiones y lecturas repetidas.
- `sql/durability.sql`: guardar un documento y comprobar configuración.
- `sql/transactions.sql`: SAVEPOINT y ROLLBACK.

Algunos archivos contienen errores SQL intencionales y permiten continuar a psql
para observar el estado final. No emplees esa configuración como política de migraciones.

### Dos sesiones

Tras ejecutar el setup:

```bash
docker compose cp sql/isolation-reader.sql postgres:/tmp/isolation-reader.sql
docker compose exec postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 -v isolation_level='READ COMMITTED' -f /tmp/isolation-reader.sql
```

Cuando aparezca el mensaje, ejecuta desde otra terminal:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/isolation-writer.sql
```

Pulsa Enter en el lector: muestra 10000 y 10500. Restablece los datos después de
cerrarlo y repite con `isolation_level='REPEATABLE READ'`: muestra 10000 dos veces.

### Reinicio ordenado

Después del setup:

```bash
docker compose exec -T postgres psql -U lab -d transactions_lab -v ON_ERROR_STOP=1 < sql/durability.sql
docker compose restart postgres
docker compose up -d --wait
docker compose exec -T postgres psql -U lab -d transactions_lab -c "SELECT * FROM concept_examples.documents;"
```

Comprueba persistencia tras reiniciar; no es una prueba de corte eléctrico ni pérdida de disco.

## Ampliación TypeScript

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm experiment:atomicity
```

Si construyes el laboratorio copiando los archivos del artículo, ejecuta primero
`pnpm install` para generar tu lockfile. El ZIP ya incluye uno.

Cada ejecución crea y elimina su propio esquema aleatorio. El esquema de pedidos
y pagos internos permite deliberadamente importes negativos para demostrar que
una transacción no inventa reglas de negocio. No se llama a ningún proveedor externo.

## Limpieza

```bash
docker compose down --volumes
```

Elimina los recursos de este laboratorio, incluidos sus datos de demostración.
La conexión de TypeScript usa localhost:55434. Si cambias `TRANSACTIONS_DB_PORT`
para Compose, usa el mismo valor al ejecutar las pruebas y el experimento.

Consulta `docs/results.md` para los resultados y los límites de la validación.
