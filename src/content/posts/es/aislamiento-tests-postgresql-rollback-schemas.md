---
id: INT-ISOLATION
title: 'Aislar tests con PostgreSQL: por qué un rollback no limpia todas las conexiones'
published: 2026-10-22T08:02:00Z
locale: es
translationKey: integration-postgres-test-isolation
slug: aislamiento-tests-postgresql-rollback-schemas
draft: true
status: draft
level: intermedio
prerequisites: [INT-FIXTURES]
description: 'Reproduce el alcance de un rollback con dos conexiones reales. Aísla escenarios mediante schemas propios y comprueba la limpieza también al fallar.'
author: 'Luis Ramírez Calle'
series: 'Integración y contratos: probar acuerdos con dependencias reales'
tags: [testing, postgresql, transactions, isolation]
---

El test abre una transacción y ejecuta un `ROLLBACK` al terminar. Parece una forma cómoda de dejar la base limpia. Pero si una operación utiliza otra conexión y confirma sus cambios, ese rollback no puede deshacerlos.

No es que PostgreSQL haya ignorado la transacción: hemos supuesto que incluía trabajo que nunca perteneció a ella. Después de preparar [fixtures y factories explícitas](/posts/fixtures-factories-datos-prueba-deterministas), necesitamos decidir qué frontera separa los datos de cada escenario.

## Una transacción pertenece a una conexión

Con **node-postgres**, las sentencias de una transacción deben ejecutarse mediante la misma instancia de cliente. Hacer `BEGIN` con una llamada a `pool.query` no reserva ese cliente para todas las llamadas posteriores. La [documentación del driver](https://node-postgres.com/features/transactions) advierte expresamente de esa diferencia.

En el laboratorio obtenemos un cliente con `pool.connect()` y lo mantenemos hasta el final. Mientras tanto, el repositorio y la API pueden pedir otra conexión al pool.

Este extracto de `tests/postgres.test.mjs` comprueba primero que realmente sean distintas:

```javascript
await client.query('BEGIN')
const pidA = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
const pidB = (await fixture.pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
assert.notEqual(pidA, pidB)
```

El pool de esta fixture tiene dos conexiones como máximo. Una permanece reservada por `client`; la consulta mediante el pool utiliza la otra. No estamos representando las conexiones con dos objetos falsos: los PIDs proceden del servidor PostgreSQL real.

## Un rollback no es un botón de deshacer de toda la base

La conexión A inserta `o-1` dentro de su transacción, sin confirmar. La API consulta mediante el repositorio y no lo ve. Después ese repositorio inserta `o-2` desde la otra conexión, fuera del bloque transaccional de A.

El recorrido relevante del mismo test es este:

```javascript
await withApi(fixture.repository, 'baseline', async (origin) => {
  assert.equal(await fetchReceipt(origin, 'o-1'), null)
  await fixture.repository.insert(orderFixture({ id: 'o-2', amountMinor: 9900 }))
  await client.query('ROLLBACK')
  assert.equal(await fetchReceipt(origin, 'o-1'), null)
  assert.equal((await fetchReceipt(origin, 'o-2')).amountMinor, 9900)
})
```

`fetchReceipt` realiza una petición HTTP real. Para `o-1`, el proveedor responde ausencia. Para `o-2`, después del rollback, conserva el importe `9900` confirmado por la otra conexión.

La API de este ejercicio solo lee; la escritura independiente la realiza el repositorio desde el test. No afirmamos haber probado un endpoint de escritura inexistente. La observación demuestra el límite que también habría que considerar si una API o un worker escribiera mediante otra conexión.

En el `finally` se intenta cerrar cualquier transacción pendiente y se devuelve el cliente al pool. Liberar conexiones también forma parte del aislamiento: una conexión retenida puede dejar al siguiente escenario esperando un recurso que nunca recupera.

<img src="/assets/visuals/integration-contracts/INT-ISOLATION.svg" alt="A inserta o-1 sin commit; la API no lo ve. B confirma o-2 y el rollback de A solo deshace o-1. Un schema propio separa los datos de ese escenario." width="350" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/integration-contracts/INT-ISOLATION.svg).

## Rollback, schema y contenedor resuelven problemas diferentes

Para una prueba de repositorio que controla una única conexión, un rollback puede ser suficiente y cómodo. La dificultad aparece cuando el recorrido incluye pools, procesos o tareas que no comparten esa transacción.

Las alternativas tienen costes y límites distintos:

<div role="region" aria-label="Estrategias para separar datos de pruebas y sus límites" tabindex="0" style="overflow-x:auto">

| Estrategia | Qué separa | Qué hay que controlar |
| --- | --- | --- |
| Transacción y rollback | Cambios de esa transacción | Todas sus operaciones deben usar el mismo cliente |
| Schema por escenario | Nombres de tablas y sus datos | Todas las consultas deben apuntar al schema correcto |
| Base por escenario | Un namespace de base más amplio | Creación, conexiones y objetos compartidos del clúster |
| Contenedor por escenario | Instancia de motor y recursos propios | Mayor preparación y cleanup de cada instancia |

</div>

Elegimos un contenedor por ejecución y un **schema por escenario**. Así varias conexiones pueden trabajar sobre los datos del mismo test sin compartirlos con otros escenarios. No necesitamos reiniciar PostgreSQL para cada ejemplo.

## Un nombre aleatorio no basta si la consulta sigue usando public

El fixture crea nombres con el formato `test_` seguido de un UUID sin guiones. El repositorio utiliza nombres de tabla cualificados, no un cambio de `search_path` que pueda perderse al usar otra conexión.

En `src/repository.ts`:

```typescript
export function qualifiedOrders(schema: string): string {
  if (!/^test_[0-9a-f]{32}$/.test(schema)) throw new Error('invalid_schema')
  return `"${schema}".orders`
}
```

Los identificadores SQL no se sustituyen como valores con `$1`. Aquí solo interpolamos un nombre generado por el fixture y validado con un formato cerrado; los datos del pedido siguen utilizando parámetros. Esta función no es una utilidad general para aceptar nombres de schema enviados por usuarios.

Otro test crea dos fixtures, inserta `o-1` en ambas con importes distintos y comprueba que cada repositorio lee su propio valor: `1250` y `9900`. El mismo ID no colisiona porque las tablas pertenecen a namespaces distintos.

Eso acredita separación de datos de prueba, no aislamiento de seguridad entre tenants. Ambos schemas pertenecen a un usuario con permisos amplios dentro de una base efímera. Si ese usuario consulta expresamente el otro schema, esta preparación no se lo impide.

## La limpieza debe pertenecer a quien creó el recurso

Cada fixture devuelve su función `close`. Esta cierra su pool y elimina únicamente su schema, cuyo nombre conserva en una colección de recursos propios. No hay un `TRUNCATE` global de todas las tablas ni un borrado por prefijo en una base compartida.

El wrapper `withSchema` llama al cierre en `finally`. Un escenario adicional lanza un error después de insertar un registro y exige que el schema haya desaparecido. No basta con observar que se limpia al terminar un caso feliz.

Si el callback deja una transacción abierta o un cliente sin liberar, el cleanup puede bloquearse o fallar. No debemos ocultar ese error para que el test parezca aprobado. Los límites de consulta y del proceso ayudan a terminar una ejecución atascada, pero no arreglan la gestión incorrecta de conexiones.

## Tests paralelos no significan escenarios independientes por defecto

Dos tests pueden tener nombres distintos y seguir modificando el mismo registro global. También pueden usar schemas distintos y competir por una secuencia, una extensión o un servicio externo compartido.

Nuestro ejemplo evita estado mutable global en los pedidos. Sin embargo, sigue compartiendo un servidor, CPU, memoria y usuario de base. No lo convertimos en una prueba de carga ni afirmamos ausencia de interferencia en cualquier recurso.

Para explorar una carrera concreta necesitamos controlar el intercalado que nos interesa. Este artículo observa transacciones y namespaces con un orden explícito; no intenta descubrir todas las carreras posibles ejecutando tests muchas veces y esperando que alguna aparezca.

## Código completo y pruebas

Consulta [los archivos del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/int-isolation/README.md) y el [test de dos conexiones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/integration-contracts/tests/postgres.test.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/integration-contracts test:integration
```

Necesitas Docker local y la imagen fijada en el [primer artículo](/posts/testcontainers-postgresql-integracion-ciclo-vida). La evidencia registra las dos conexiones, la invisibilidad de lo no confirmado, la supervivencia del cambio ajeno al rollback y los importes separados por schema.

## Garantías y límites

PostgreSQL real, dos conexiones y esquemas independientes de pruebas. Sin RLS, separación de tenants por permisos, escritores en máquinas distintas o búsqueda exhaustiva de carreras. El cierre es explícito; el wrapper solo recupera contenedores identificados como propios si el proceso hijo termina antes de limpiar.

## Ejercicio: comprobar dónde termina tu transacción

Busca un test que dependa de rollback. Identifica cómo obtiene la conexión cada operación del recorrido. Añade una lectura desde una segunda conexión antes del commit y exige que no vea el registro. Después confirma una escritura independiente y comprueba que el rollback de la primera no la elimina.

El siguiente post utiliza ese aislamiento para [validar contratos de API sin confundir estructura y significado](/posts/schema-tests-contratos-api-semantica).

## Referencias

- [node-postgres: transacciones y uso del mismo cliente](https://node-postgres.com/features/transactions).
- [PostgreSQL 18: transacciones](https://www.postgresql.org/docs/18/tutorial-transactions.html).
- [PostgreSQL 18: schemas y nombres cualificados](https://www.postgresql.org/docs/18/ddl-schemas.html).

Fuentes consultadas el 22 de octubre de 2026. La ejecución del laboratorio utiliza PostgreSQL 18.4 y pg 8.23.1.
