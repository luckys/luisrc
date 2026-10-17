---
id: DB-ISOLATION
title: 'Aislamiento y MVCC en PostgreSQL: por qué dos transacciones ven datos distintos'
published: 2026-10-17T00:01:00Z
locale: es
translationKey: database-isolation-mvcc
slug: aislamiento-mvcc-postgresql
draft: true
status: draft
level: intermedio
prerequisites: [DB-TRANSACTIONS, DB-MODEL]
description: 'Entiende snapshots, READ COMMITTED, REPEATABLE READ y SERIALIZABLE con dos sesiones, un caso de write skew y pruebas reproducibles en PostgreSQL.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'mvcc', 'aislamiento', 'transacciones', 'concurrencia']
---

Dos personas están de guardia. Cada una consulta cuántas siguen disponibles, ve dos y decide desconectarse. Las dos transacciones terminan bien, pero ya no queda nadie de guardia.

No faltaba un `BEGIN`. Faltaba entender qué puede observar una transacción y qué decisiones siguen siendo peligrosas aunque sus lecturas sean estables.

Tras [transacciones](/posts/transacciones-postgresql-ejemplos-practicos) y [modelado e integridad](/posts/modelado-relacional-integridad-datos), esta entrega explica **MVCC**, compara niveles de **isolation** y reproduce un **write skew**. No intentaremos resolver todavía todos los conflictos: el siguiente artículo compara mecanismos concretos.

## MVCC mantiene versiones, no una copia privada de toda la base

**Multiversion Concurrency Control**, o **MVCC**, permite decidir qué versiones de las filas son visibles mediante una **snapshot**, una instantánea lógica. Una lectura ordinaria no tiene por qué esperar a que termine quien actualiza una fila: puede ver una versión anterior confirmada. [Introducción oficial a MVCC](https://www.postgresql.org/docs/18/mvcc-intro.html).

Eso no significa ausencia de bloqueos. Dos escritores sobre la misma fila pueden tener que esperar; los cambios de esquema también pueden bloquear consultas. «Los lectores no bloquean escritores» es una descripción del acceso ordinario a versiones, no una promesa para cualquier operación SQL.

<img src="/assets/visuals/database-series/aislamiento.svg" alt="En READ COMMITTED cada SELECT obtiene su snapshot. En REPEATABLE READ las dos consultas usan la snapshot fijada por la primera consulta de la transacción." width="521" height="868" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/aislamiento.svg).

## Antes de discutir niveles, distingue las anomalías

Una **dirty read** observa datos sin confirmar. Una **non-repeatable read** vuelve a leer una fila y obtiene otro valor confirmado. Una **phantom read** cambia el conjunto de filas que satisface una condición.

Una **lost update** ocurre, por ejemplo, cuando dos clientes calculan a partir del mismo valor y uno sobrescribe el resultado del otro. Un **write skew** permite que decisiones sobre varias filas produzcan un estado que rompe una regla conjunta. No son nombres distintos para el mismo problema.

En PostgreSQL 18, `READ UNCOMMITTED` se comporta como `READ COMMITTED`. `REPEATABLE READ` evita también phantom reads en su implementación, pero no todos los casos de write skew. `SERIALIZABLE` exige que las transacciones confirmadas sean compatibles con algún orden secuencial. Esto describe el comportamiento de este motor, no una tabla universal aplicable sin revisar a otros. [Niveles de aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html).

## Dos sesiones permiten ver cuándo cambia la snapshot

[Descarga el laboratorio](/assets/examples/bases-de-datos-lab.zip), entra en `bases-de-datos/` y ejecuta `docker compose up -d --wait`. Inicializa los datos con:

Archivo: terminal, preparación del capítulo.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/02-aislamiento.sql
```

El archivo crea una cuenta con saldo `10000` y dos personas de guardia. Abre dos terminales con `docker compose exec postgres psql -X -U lab -d series_lab`.

Archivo: sesión A, primera parte.

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM db_isolation.accounts WHERE id=1;
```

Sin cerrar A, ejecuta en B:

Archivo: sesión B.

```sql
UPDATE db_isolation.accounts SET balance=10500 WHERE id=1;
```

En A, repite el `SELECT` y confirma con `COMMIT`. Obtienes `10000` y luego `10500`: cada consulta ordinaria ve una snapshot nueva.

Reinicia el script cuando ambas sesiones hayan terminado y repite usando `BEGIN ISOLATION LEVEL REPEATABLE READ`. Ahora A observa `10000` ambas veces. La snapshot se fija en la primera consulta relevante, no simplemente al escribir `BEGIN`.

## Una visión estable no impide el write skew

Reinicia los datos. Usa `REPEATABLE READ` en ambas sesiones y sigue **este orden exacto**. La regla del experimento dice que solo se puede abandonar la guardia si quedan dos personas activas antes de hacerlo.

<div class="overflow-x-auto" role="region" aria-label="Orden del experimento de guardias" tabindex="0">

| Paso | Sesión A                                                   | Sesión B                                                   |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 1    | `BEGIN ISOLATION LEVEL REPEATABLE READ;`                   |                                                            |
| 2    |                                                            | `BEGIN ISOLATION LEVEL REPEATABLE READ;`                   |
| 3    | `SELECT count(*) FROM db_isolation.on_call WHERE active;`  |                                                            |
| 4    |                                                            | La misma consulta: ambas ven 2.                            |
| 5    | `UPDATE db_isolation.on_call SET active=false WHERE id=1;` |                                                            |
| 6    |                                                            | `UPDATE db_isolation.on_call SET active=false WHERE id=2;` |
| 7    | `COMMIT;`                                                  |                                                            |
| 8    |                                                            | `COMMIT;`                                                  |

</div>

Las filas modificadas son distintas. Ambas transacciones confirman y una consulta nueva encuentra cero personas activas. La condición se comprobó sobre una visión que no incluía la decisión de la otra persona.

Repite desde el setup con **SERIALIZABLE** en ambas sesiones. El sistema detecta que esas lecturas y escrituras no pueden confirmarse todas como si hubieran ocurrido secuencialmente. Una transacción falla con `40001`; no debes depender de cuál sea la víctima ni del punto exacto del fallo.

## Un retry necesita repetir la decisión

Después de un **serialization failure**, la operación debe comenzar otra transacción, volver a consultar cuántas personas siguen activas y decidir de nuevo. Repetir únicamente el último `UPDATE` conservaría una decisión basada en datos anteriores.

El protocolo de la aplicación sería: abrir transacción, leer, validar la regla, actualizar, confirmar. Ante `40001`, descartar ese intento y repetir la unidad completa, con un presupuesto limitado. Si en el nuevo intento queda una sola persona, la respuesta correcta es rechazar la baja, no insistir hasta desconectarla. [Tratamiento de errores de serialización](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html).

En el laboratorio, `node --test tests/lab.test.mjs` automatiza las lecturas y el write skew. Las sesiones se coordinan esperando respuestas, no añadiendo pausas para intentar acertar con el scheduling.

## Garantías y límites

**READ COMMITTED** puede ser suficiente para una actualización condicional bien diseñada. **REPEATABLE READ** sirve cuando varias lecturas necesitan una visión estable, pero no convierte cualquier regla entre filas en segura. **SERIALIZABLE** evita ejecuciones no serializables entre las transacciones participantes, con un coste posible en abortos y reintentos.

No es un gran lock global ni garantiza orden por hora de llegada. Tampoco incorpora correos o llamadas HTTP al rollback. Si otros caminos escriben con un protocolo incompatible, no basta con poner `SERIALIZABLE` en una única función y dejar de revisar el sistema.

Elegir un nivel más estricto no sustituye al modelado: una regla que nunca comprobaste puede seguir incumpliéndose en una ejecución perfectamente secuencial.

## Ejercicio: decide antes de abandonar la guardia

Automatiza el retry de la operación completa con un máximo de tres intentos. Acepta el ejercicio cuando una baja se confirme y la otra se rechace o reevalúe sin dejar cero personas activas. Registra por separado error técnico y rechazo de negocio.

Para comparar esta estrategia con locks y actualizaciones atómicas, continúa con [control de concurrencia](/posts/concurrencia-bloqueos-postgresql).

## Referencias

PostgreSQL 18, consulta del 17 de octubre de 2026: [MVCC](https://www.postgresql.org/docs/18/mvcc-intro.html), [niveles de aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html), [reintentos completos](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html) y [bloqueos explícitos](https://www.postgresql.org/docs/18/explicit-locking.html).
