---
id: DB-CACHE
title: 'Redis y caché: lecturas rápidas, datos antiguos y carreras de invalidación'
published: 2026-10-17T00:11:00Z
locale: es
translationKey: database-redis-cache-consistency
slug: redis-cache-consistencia
draft: true
status: draft
level: intermedio
prerequisites: [DB-CONCURRENCY, DB-INDEXES]
description: 'Entiende cache-aside, TTL, invalidación, stampede y hot keys. Reproduce una caché obsoleta incluso después de invalidarla y define qué hacer si Redis falla.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['redis', 'cache', 'consistencia', 'backend', 'concurrencia']
---

Actualizas un precio en PostgreSQL, borras su clave de Redis y das la operación por terminada. Una petición que había leído el precio anterior unos milisegundos antes lo vuelve a guardar en caché. La invalidación se ejecutó y, aun así, el siguiente cliente ve el dato antiguo.

Añadir caché introduce otra copia con su propio orden de operaciones y sus propios fallos. Puede reducir trabajo repetido, pero obliga a definir cuánto dato antiguo aceptas y cómo recuperas coherencia.

Partimos de [control de concurrencia](/posts/concurrencia-bloqueos-postgresql) e [índices](/posts/indices-postgresql-fundamentos). Vamos a comparar patrones, reproducir esa carrera y distinguir **TTL**, invalidación y garantía de lectura actual.

## Cache-aside pone la decisión en la aplicación

En **cache-aside**, la aplicación consulta Redis. Si encuentra la clave, devuelve el valor. Si hay un **cache miss**, consulta la fuente de verdad, guarda el resultado con una expiración y lo devuelve.

**Read-through** mueve esa carga a una capa de caché o biblioteca. **Write-through** hace que las escrituras pasen por una capa que actualiza la fuente y la caché según su contrato. **Write-behind** puede aceptar una escritura y persistirla después, lo que exige resolver pérdida, orden y recuperación.

Estos nombres no convierten dos sistemas en una transacción. Tampoco Redis, por sí solo, sabe consultar tu tabla PostgreSQL cuando falta una clave. Debes identificar quién carga, quién escribe y qué significa cada confirmación.

## Elige primero qué dato admite antigüedad

Una descripción de producto puede tolerar segundos de retraso. La decisión final de aceptar una reserva quizá necesite comprobar stock en la fuente de verdad. No todos los campos de un objeto tienen la misma tolerancia.

Empieza definiendo el dato cacheado, la clave y sus dimensiones. Si el valor cambia según tenant, idioma o permisos, la clave debe reflejar lo necesario. Omitir el tenant no produce solo un dato antiguo: puede mezclar información de clientes.

También necesitas decidir qué ocurre si Redis falla. **Fail open** hacia PostgreSQL puede mantener el servicio, pero aumentar su carga justo cuando llegan muchos misses. **Fail closed** puede ser apropiado para ciertos controles, pero no debería aparecer accidentalmente porque la biblioteca lanzó una excepción.

## Reproduce la carrera sin depender del azar

[Descarga el laboratorio](/assets/examples/bases-de-datos-lab.zip), entra en `bases-de-datos/` y ejecuta:

Archivo: terminal, preparación de PostgreSQL y Redis aislados.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/12-cache.sql
```

La tabla empieza con precio `1000`. Sigue este orden: A lee 1000 desde PostgreSQL, pero todavía no escribe Redis. B actualiza a 1200 y confirma. B elimina la clave. Finalmente A publica el 1000 que había leído.

<img src="/assets/visuals/database-series/cache.svg" alt="Un lector obtiene 1000 de PostgreSQL y se retrasa. Otro proceso confirma 1200 e invalida Redis. El lector termina después y repuebla Redis con 1000 durante 60 segundos." width="1107" height="833" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/cache.svg).

Archivo: terminal A, primer paso. Conserva el resultado antes de continuar.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -c 'SELECT price_minor FROM db_cache.products WHERE id=1'
```

Archivo: terminal B, actualización confirmada e invalidación.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -c 'UPDATE db_cache.products SET price_minor=1200 WHERE id=1'
docker compose exec -T redis redis-cli DEL db-series:product:1
```

Archivo: terminal A, publicación retrasada del resultado anterior.

```bash
docker compose exec -T redis redis-cli SET db-series:product:1 1000 EX 60
docker compose exec -T redis redis-cli GET db-series:product:1
docker compose exec -T redis redis-cli TTL db-series:product:1
```

Redis devuelve 1000 mientras PostgreSQL tiene 1200. `node --test tests/lab.test.mjs` comprueba exactamente esa secuencia sin sleeps. Es una prueba de un intercalado posible, no una medida de la frecuencia del problema.

## TTL limita la vida de una entrada, no la antigüedad absoluta del dato

**Time to live** establece cuándo expira esa entrada. `SET ... EX 60` escribe el valor y su expiración juntos. Separar `SET` y `EXPIRE` puede dejar una clave sin caducidad si el proceso cae entre ambos. [SET](https://redis.io/docs/latest/commands/set/), [EXPIRE](https://redis.io/docs/latest/commands/expire/).

Sin embargo, los 60 segundos empiezan cuando A escribe en Redis, no cuando leyó PostgreSQL. Un lector muy retrasado puede publicar datos ya antiguos con un TTL nuevo. Por eso «TTL de un minuto» no implica automáticamente «dato como máximo de hace un minuto».

Tampoco la expiración sustituye a la invalidación cuando el producto necesita reflejar una escritura antes. Ambos mecanismos atienden problemas distintos.

## Invalidar después del commit es necesario, pero no suficiente

Invalidar antes del commit permite que otro lector recargue inmediatamente el valor anterior. Hacerlo después evita esa ventana concreta, pero no la carrera del diagrama ni una caída entre el commit y el `DEL`.

Si el requisito tolera antigüedad limitada, puedes aceptar y documentar el riesgo, con TTL y recuperación. Si necesita más, considera entradas versionadas y un protocolo que impida que un lector antiguo sustituya una versión nueva. Comparar y escribir debe ser atómico en Redis; un `GET` seguido de `SET` vuelve a introducir una carrera.

Pero una versión borrada sin memoria del último valor tampoco rechaza a un escritor antiguo. El protocolo completo necesita conservar la información suficiente y coordinar cómo se propagan las versiones. Un script Lua solo hace atómica su parte en Redis; **no crea una transacción distribuida con PostgreSQL**.

Para operaciones que exigen estado actual, saltarse la caché y comprobar la fuente dentro de una transacción suele ser una alternativa más fácil de defender. No todas las lecturas necesitan pasar por Redis.

## Stampede y hot keys son problemas de carga, no solo de coherencia

Un **cache stampede** aparece cuando muchas peticiones encuentran la misma ausencia y cargan a la vez la fuente. Un **single-flight** agrupa cargas concurrentes dentro de un proceso. Con varias instancias necesitas estudiar el alcance de esa coordinación; un mutex local no protege a todas.

Añadir **jitter** al TTL evita que muchas claves expiren exactamente juntas, pero no evita por sí solo cien misses simultáneos de la misma clave. Otra alternativa es servir temporalmente el dato anterior mientras una petición lo renueva, si el producto acepta **stale-while-revalidate**.

Una **hot key** concentra tráfico en una sola clave. No desaparece por añadir nodos si esa clave sigue teniendo un único destino. Mide distribución de peticiones, tamaño de valores y carga de origen, además del **hit ratio**. Un hit ratio alto puede ocultar lecturas demasiado antiguas.

## Garantías y límites

Este laboratorio demuestra obsolescencia tras una invalidación exitosa. No implementa un protocolo de coherencia fuerte ni presenta un lock de Redis como garantía universal.

Una caché debe poder reconstruirse si esa es su función; no puede ser la única copia accidental de una escritura que creías persistida. Registra fallos de carga, latencia, misses, invalidaciones fallidas y antigüedad cuando puedas medirla.

## Ejercicio: decide qué hace el producto durante un fallo

Define una ficha para cachear el nombre de un producto y otra para aceptar una reserva: fuente de verdad, TTL, tolerancia a obsolescencia, fallo de Redis y forma de recuperación. Para el nombre puedes aceptar datos antiguos; para la reserva, justifica dónde se verifica la disponibilidad.

Acepta el ejercicio cuando la respuesta no sea «el TTL lo arregla». Para decidir si necesitas Redis u otro motor, sigue con [SQL, NoSQL y motores especializados](/posts/elegir-sql-nosql-motores-especializados).

## Referencias

Redis, documentación consultada el 17 de octubre de 2026: [SET con expiración](https://redis.io/docs/latest/commands/set/), [EXPIRE](https://redis.io/docs/latest/commands/expire/), [TTL](https://redis.io/docs/latest/commands/ttl/) y [EVAL y scripts](https://redis.io/docs/latest/commands/eval/). El comportamiento del experimento se verifica contra la imagen Redis fijada por digest en el laboratorio.
