---
id: DB-CONCURRENCY
title: 'Concurrencia en PostgreSQL: actualizaciones atómicas, locks y versiones'
published: 2026-10-17T00:02:00Z
locale: es
translationKey: database-concurrency-locks
slug: concurrencia-bloqueos-postgresql
draft: true
status: draft
level: intermedio
prerequisites: [DB-MODEL, DB-ISOLATION]
description: 'Reproduce una reserva doble y elige entre UPDATE condicional, ON CONFLICT, SELECT FOR UPDATE y optimistic locking. Incluye deadlocks y pruebas concurrentes.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['postgresql', 'concurrencia', 'locks', 'sql', 'testing']
---

Queda una plaza. Dos peticiones leen «1 disponible», aceptan la reserva y guardan «0 disponibles». El contador nunca es negativo, pero has prometido dos plazas.

Un `CHECK (available >= 0)` no detecta este fallo: ambas escrituras respetan la restricción. El problema está entre **comprobar una condición y actuar**, el patrón **check-then-act**.

Después de [aislamiento y MVCC](/posts/aislamiento-mvcc-postgresql), vamos a elegir mecanismos para inserciones únicas, descuentos de stock y edición de registros. Al terminar podrás reproducir una carrera, proteger una operación y explicar el coste del mecanismo elegido.

## Reproduce primero la decisión equivocada

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/README.md). Desde `database-fundamentals/`, arranca `docker compose up -d --wait` y ejecuta:

Archivo: terminal, preparación.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/03-concurrencia.sql
```

Abre dos sesiones `psql`. En ambas, antes de escribir, consulta `SELECT available FROM db_concurrency.stock WHERE id=1;`. Las dos obtienen uno. Imagina que cada petición calcula en memoria `1 - 1`.

Archivo: ambas sesiones, después de que las dos hayan leído. **Ejemplo incorrecto**.

```sql
UPDATE db_concurrency.stock SET available=0 WHERE id=1;
```

Ambas escrituras terminan bien. El stock final no permite saber que aceptaste dos reservas. Un lock adquirido solo durante cada `UPDATE` no puede reconstruir la intención que calculaste antes en la aplicación.

<img src="/assets/visuals/database-series/concurrencia.svg" alt="Dos clientes leen stock 1 y escriben 0, aceptando dos reservas. Con UPDATE condicional, solo el primer descuento devuelve una fila; el segundo no reserva." width="1140" height="422" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/concurrencia.svg).

Una **race condition** depende del intercalado de operaciones. No exige dos CPUs ejecutando exactamente a la vez. Puede aparecer con procesos que alternan trabajo mientras esperan red o disco.

## Si la decisión cabe en una sentencia, empieza por ahí

Reinicia el setup. Ejecuta esta sentencia desde ambos clientes:

Archivo: sesiones A y B, reserva condicional.

```sql
UPDATE db_concurrency.stock
SET available=available-1
WHERE id=1 AND available>0
RETURNING available;
```

En **READ COMMITTED**, la primera reserva obtiene una fila con cero. Si la otra espera una modificación concurrente, PostgreSQL reevalúa la condición sobre la versión actualizada: ya no hay stock y devuelve cero filas. **Cero filas no es una reserva exitosa**; la aplicación tiene que tratarlo como tal. [Comportamiento de UPDATE bajo READ COMMITTED](https://www.postgresql.org/docs/18/transaction-iso.html).

Si además necesitas insertar una reserva, agrupa descuento e inserción en una transacción y confirma solo si el descuento tuvo éxito. No añadas una escritura dependiente después del commit esperando que pertenezca a la misma operación.

## Para una inserción única, declara la unicidad

La tabla del laboratorio permite una reserva por recurso. En este ejemplo `resource_id` ya representa una plaza y un intervalo concretos, no cualquier reserva futura de una sala.

Archivo: sesión interactiva, ejecutar dos veces con usuarios distintos.

```sql
INSERT INTO db_concurrency.reservations(resource_id,user_id)
VALUES (100,7)
ON CONFLICT (resource_id) DO NOTHING
RETURNING resource_id;
```

La **primary key** arbitra el conflicto. `ON CONFLICT` permite gestionar el resultado sin convertir una duplicación esperable en un error genérico. No pongas `DO UPDATE` por costumbre: podrías cambiar el propietario de una reserva existente. [INSERT y ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html).

Para intervalos que pueden solaparse, una clave única sobre el identificador no expresa toda la regla. Haría falta otro modelo y posiblemente una **exclusion constraint**. La protección debe corresponder a lo que realmente significa «duplicado».

## SELECT FOR UPDATE coordina varias decisiones sobre una fila

Cuando necesitas leer información y ejecutar varios pasos, el **pessimistic locking** puede ser más claro. La sesión que bloquea la fila conserva el lock hasta terminar la transacción.

Archivo: sesión A, bloquear y completar una reserva.

```sql
BEGIN;
SELECT available FROM db_concurrency.stock WHERE id=1 FOR UPDATE;
-- Solo continuar si la cantidad leída permite la reserva.
UPDATE db_concurrency.stock
SET available=available-1
WHERE id=1 AND available>0
RETURNING available;
COMMIT;
```

La comprobación condicional sigue evitando que el ejemplo descuente por debajo de cero. Otra sesión con `FOR UPDATE` sobre la misma fila espera. Una lectura ordinaria puede seguir viendo una versión confirmada: **bloquear no significa hacer invisible la fila**.

Si no existe la fila, no has bloqueado mágicamente una futura inserción con esa clave. Usa una constraint única para esa carrera. `NOWAIT` permite fallar sin esperar; `SKIP LOCKED` omite filas ocupadas, útil para repartir trabajo, pero peligroso si interpretas lo omitido como inexistente. [Locks de fila](https://www.postgresql.org/docs/18/explicit-locking.html).

## Una versión detecta que alguien editó antes

El **optimistic locking** funciona bien cuando el conflicto es poco habitual y no quieres mantener un lock mientras alguien edita un formulario. El cliente conserva la versión que leyó.

Archivo: sesión interactiva, edición basada en versión 1.

```sql
UPDATE db_concurrency.stock
SET available=5,version=version+1
WHERE id=1 AND version=1
RETURNING version;
```

La primera edición devuelve versión dos; otra basada en uno no modifica filas. El sistema puede pedir al usuario que revise los cambios. Reintentar ciegamente la misma edición convertiría «detectar conflicto» en «sobrescribir después».

## Deadlocks: dos locks correctos pueden formar un ciclo

Si A bloquea la fila 1 y pide la 2, mientras B bloquea la 2 y pide la 1, ninguna puede avanzar. PostgreSQL detecta el **deadlock** y aborta una transacción con `40P01`.

Adquirir locks en un orden compartido, por ejemplo por identificador ascendente, reduce este riesgo. También importa mantener cortas las transacciones y no esperar al usuario con locks abiertos. Si procede reintentar, vuelve a ejecutar la unidad completa con un límite, no cualquier error indefinidamente.

Los **advisory locks** permiten coordinar una clave definida por la aplicación, pero todos los caminos relevantes deben respetar el mismo protocolo. No sustituyen a constraints que sí puede exigir PostgreSQL.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-concurrency/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

Una actualización condicional protege esa modificación; no todo un flujo de negocio. Una constraint protege el ámbito declarado. Un lock coordina a quienes compiten por el recurso bloqueado. Una versión detecta una edición basada en datos anteriores.

Las pruebas `node --test tests/lab.test.mjs` fuerzan la lectura compartida de la versión insegura y comprueban que dos descuentos condicionales producen exactamente un éxito. No son una prueba de carga ni prometen ausencia de contención en producción.

## Ejercicio: fuerza un deadlock y corrígelo

Con las filas 1 y 2 del setup, bloquea en A la primera y en B la segunda. Pide después la otra fila en cada sesión. Debes observar un `40P01`, cerrar ambos intentos y repetir adquiriendo siempre 1 antes que 2.

Acepta el ejercicio cuando puedas explicar qué esperaba cada sesión y por qué el orden común evita ese ciclo concreto. Para revisar la corrección de las consultas, sigue con [JOIN, NULL y agregaciones](/posts/sql-joins-null-agregaciones).

## Referencias

PostgreSQL 18, consultado el 17 de octubre de 2026: [bloqueos explícitos](https://www.postgresql.org/docs/18/explicit-locking.html), [ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html), [aislamiento](https://www.postgresql.org/docs/18/transaction-iso.html) y [tratamiento de fallos de serialización](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html).
