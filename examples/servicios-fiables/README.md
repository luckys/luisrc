# Servicios fiables: laboratorio de las cuatro series

Ejemplos ficticios para estudiar contratos, diseño, fallos distribuidos y operación.
No es PaySafe ni una API de pagos. Ningún ejemplo maneja tarjetas ni dinero real.

## Entorno

Node.js 24 y Docker con Compose para los cuatro tests de PostgreSQL. Los 16 tests
del núcleo usan solo módulos integrados, sin instalaciones. Desde esta carpeta:

```bash
node --test tests/core.test.mjs
docker compose up -d --wait
node --test tests/postgres.test.mjs
```

El Compose no publica puertos y fija la imagen PostgreSQL 18 por digest. Usa una
base y credenciales exclusivamente didácticas. Cada test SQL reinicia el esquema
`reliable_lab`: no ejecutar estos scripts en otra base. Los tests no son seguros
para dos ejecuciones simultáneas sobre la misma instancia.

Para comprobar tipos se necesitan dependencias de desarrollo, nunca para ejecutar:

```bash
pnpm install --frozen-lockfile
pnpm exec tsc -p tsconfig.json
```

Si trabajas en el monorepo, ejecutar la instalación desde su raíz. El ZIP incluye
su propio lockfile para trabajar por separado. No hay compilación al ejecutar:
Node borra los tipos, no los comprueba. Los tipos se comprueban con `tsc`.

## Mapa de archivos y lecturas

| Archivos                  | Conceptos                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| `src/money.ts`            | Unidades menores EUR, límites enteros, input allowlist              |
| `src/security.ts`         | Tenant, ownership, origen/CSRF, destino saliente permitido          |
| `src/service.ts`          | Caso de uso, Problem Details, cursor, logs, percentiles y capacidad |
| `src/workflow.ts`         | Transiciones, confirmaciones tardías, compensación y reconciliación |
| `src/distributed.ts`      | Respuesta perdida, dedup local, retries, bulkhead y leases          |
| `src/webhook.ts`          | Protocolo HMAC ficticio, timestamp y bytes exactos                  |
| `sql/01-schema.sql`       | Tablas para persistencia e integridad                               |
| `sql/02-atomic-write.sql` | Operación, clave y Outbox en una transacción                        |
| `sql/03-consume.sql`      | Inbox y cambio local en otra transacción                            |
| `tests/core.test.mjs`     | Fallos, correcciones y secuencias generadas reproducibles           |
| `tests/postgres.test.mjs` | Atomicidad real, unicidad concurrente y redelivery                  |

Los artículos contienen extractos identificados. Estos archivos contienen la
implementación completa y los tests importan esos mismos archivos.

## Límites que no debes perder de vista

- `IdempotencyMemory` y `LeaseQueue` son modelos de UN proceso y pierden datos
  al reiniciar. No sustituyen la DB ni un broker. Una lease vencida no detiene
  por la fuerza al worker antiguo ni evita sus efectos externos.
- `retry` no interrumpe una promesa: la función llamada debe imponer timeout
  con el presupuesto recibido. El fake y el reloj inyectado no prueban una red real.
- Seguridad: no se implementan sesiones, OAuth, TLS, CSP en navegador ni resolución
  DNS segura. Los tests de política no equivalen a una auditoría de seguridad.
- El SQL enseña dos transacciones locales, no un relay completo ni un envío de email.
- Las secuencias generadas usan semilla fija; no hacen shrinking ni fuzzing general.
- Las cifras de capacidad y SLO son calculadas, no un benchmark de producción.

## Limpieza local

```bash
docker compose down --volumes
```

El comando elimina únicamente los contenedores y volúmenes del proyecto Compose
`luisrc-reliable-services`. En este laboratorio no se declaran volúmenes de datos
persistentes: al eliminar PostgreSQL se pierden los datos ficticios.
