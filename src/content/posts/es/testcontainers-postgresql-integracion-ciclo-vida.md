---
id: P056
title: 'Testcontainers con PostgreSQL: que la prueba controle su dependencia'
published: 2026-10-22T08:00:00Z
locale: es
translationKey: integration-testcontainers-postgres-lifecycle
slug: testcontainers-postgresql-integracion-ciclo-vida
draft: true
status: draft
level: intermedio
prerequisites: [TEST-COVERAGE, P022]
description: 'Ejecuta PostgreSQL real con Testcontainers: imagen fijada, readiness, puerto efímero, datos propios y cleanup comprobado sin depender de una base compartida.'
author: 'Luis Ramírez Calle'
series: 'Integración y contratos: probar acuerdos con dependencias reales'
tags: [testing, integration, testcontainers, postgresql]
---

El repositorio pasa sus tests con un fake, pero el SQL real viola una constraint. Cambiar el fake para que lance el mismo error puede servir para probar cómo reacciona el servicio; no demuestra que la consulta correcta llegue al motor ni que la constraint exista.

Necesitamos una prueba con **PostgreSQL real**. Y necesitamos poder ejecutarla sin adivinar qué base está arrancada en el portátil o qué datos dejó otra persona. Esta serie continúa el bloque de [pruebas de software](/posts/coverage-mutation-testing-aserciones-que-detectan-fallos) con un pequeño proveedor de pedidos y su consumidor.

## Testcontainers administra el ciclo de vida, no las expectativas

**Testcontainers** es una biblioteca que permite iniciar dependencias en contenedores desde el código de los tests. El módulo de PostgreSQL configura el motor y devuelve los datos para conectarnos: host, puerto, usuario y base.

Eso resuelve parte de la preparación. Las aserciones siguen siendo responsabilidad nuestra. Un contenedor en estado `running` no demuestra que el SQL sea correcto, que las migraciones funcionen o que una API conserve su contrato.

Tampoco obliga a meter toda la aplicación en Docker. En este laboratorio PostgreSQL está en un contenedor; Node, el cliente `pg` y los servidores HTTP se ejecutan en el host. Es suficiente para probar esa frontera, aunque no reproduzca un despliegue completo.

## Elegir el motor real evita equivalencias que no hemos demostrado

Usamos PostgreSQL también en las pruebas de integración porque queremos observar su SQL y sus constraints. SQLite es útil en otros contextos, pero no lo sustituye automáticamente: tipos, errores, concurrencia y sintaxis pueden diferir.

El primer escenario inserta un pedido, lo lee y comprueba que sus valores se conservan. Después intenta repetir el ID y escribir un importe cero. El motor devuelve `23505`, violación de unicidad, y `23514`, violación de una constraint `CHECK`.

El test exige esos códigos, no fragmentos del texto de un error que podría cambiar con el idioma. Así sabemos que se ejecutaron mecanismos concretos del motor. No inferimos atomicidad de un workflow entero a partir de esos dos rechazos.

## Una imagen fijada es una entrada del experimento

El laboratorio utiliza una imagen oficial `postgres:18-alpine` fijada también por **digest**. La ejecución observada informa PostgreSQL **18.4**. No dejamos que una actualización del tag cambie silenciosamente el motor al repetir la prueba.

Fijar la imagen no implica congelarla para siempre. Significa que una actualización debe ser visible y acompañada de una nueva ejecución. Tampoco transforma esta versión en una recomendación de «la última»: es la versión concreta del ejercicio.

En `tests/database-fixture.mjs`, `image` contiene el tag y su digest. El arranque usa este bloque:

```javascript
const container = await new LoopbackPostgres(image)
  .withName(`blog-contracts-${runId}`)
  .withLabels({ 'dev.luisrc.contracts': 'integration-contracts', 'dev.luisrc.contract-run': runId })
  .withDatabase('contracts_lab').withUsername('lab').withPassword('local-only-lab')
  .withAutoCleanup(false).withPullPolicy(PullPolicy.neverPull())
  .withTmpFs({ '/var/lib/postgresql': 'rw,size=256m' })
  .withResourcesQuota({ memory: 0.5, cpu: 1 }).withStartupTimeout(30000)
  .start()
```

`runId` es único por ejecución del verificador. El nombre sirve para identificar el recurso, no para que otros tests se conecten a un contenedor compartido. Los límites son 0,5 GiB de memoria y una CPU; no hemos medido rendimiento con esa configuración.

**tmpfs** mantiene los datos efímeros del ejercicio fuera de directorios del usuario. `neverPull` exige tener la imagen disponible: la suite falla si falta, en vez de descargarla implícitamente durante el test.

## Puerto abierto y base preparada son señales distintas

La versión fijada del módulo espera su healthcheck y el puerto. Después el fixture establece una conexión con `pg` y ejecuta `SELECT 1`. Solo entonces crea el schema y sus tablas.

No sustituimos esas señales por «esperar tres segundos». Una pausa puede ser demasiado corta en CI y demasiado larga en local sin demostrar que el motor esté listo.

El **startup timeout** es un límite para esa espera, no una garantía de que cualquier operación posterior termine en treinta segundos. El pool tiene además límites de conexión y consulta; el proceso de verificación tiene su propio timeout.

El puerto del host es efímero. No reservamos `5432`, que podría pertenecer a otra base. La clase pequeña `LoopbackPostgres` ajusta el binding a `127.0.0.1` en el punto de extensión del contenedor. Depende de los tipos protegidos de Testcontainers 12.2.1, por eso se fija la versión y se comprueba el resultado con `docker inspect`. El puerto no se publica en todas las interfaces.

<img src="/assets/visuals/integration-contracts/P056.svg" alt="Testcontainers inicia PostgreSQL y espera readiness; después se crean datos propios, se ejecutan SQL y HTTP y se cierran los recursos identificados por la ejecución." width="313" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/integration-contracts/P056.svg).

## El cleanup necesita una ruta de error

Cada escenario utiliza `withSchema`, también en `tests/database-fixture.mjs`:

```javascript
export async function withSchema(database, run) {
  const fixture = await database.schema()
  try { return await run(fixture) }
  finally { await fixture.close() }
}
```

El `finally` se ejecuta tanto si pasan las aserciones como si el callback lanza un error. Otro escenario lo comprueba: inserta un pedido, lanza `planned_failure` y después consulta `pg_namespace` para exigir que el schema ya no exista.

Los pools se cierran antes de eliminar su schema. Al finalizar el archivo de tests se detiene el contenedor. El wrapper comprueba además que no quede ninguno con el identificador de esa ejecución; si un timeout interrumpe al hijo, puede retirar únicamente esos recursos etiquetados.

Este fixture local desactiva el auto-cleanup del reaper: no arranca **Ryuk** ni monta el socket Docker dentro de otro contenedor. Es una elección acotada, compensada por cierre explícito y recuperación desde el wrapper. No es una recomendación general de desactivar el reaper. Si mueren también el wrapper o el host, esa recuperación no está garantizada.

## Una dependencia real no sustituye al resto de pruebas

El laboratorio conserva tests pequeños del lector de pedidos y de los datos de prueba. No hace falta iniciar PostgreSQL para comprobar un enum o un límite temporal puro.

Las pruebas reales añaden evidencia diferente: SQL ejecutado, tipos recibidos del driver, restricciones y colaboración con HTTP. Si un escenario falla durante el arranque, todavía no hemos observado el comportamiento de negocio. Debemos diagnosticar primero esa preparación, no adaptar una expectativa hasta poner la suite verde.

## Código completo y pruebas

Consulta [los archivos del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p056/README.md) y el [fixture completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/integration-contracts/tests/database-fixture.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
docker pull postgres:18-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15
pnpm --dir packages/integration-contracts test:integration
```

Docker debe ser local. El verificador rechaza un daemon remoto y no utiliza una URL de base de datos externa. Se ejecutaron cuatro tests del núcleo, dos del consumidor y nueve con PostgreSQL/HTTP/Pact. La evidencia se guarda solo después de pasar la suite y comprobar el cleanup.

## Garantías y límites

PostgreSQL 18.4 real en un nodo, datos ficticios en tmpfs y sockets locales. Sin almacenamiento durable probado, pérdida eléctrica, HA o benchmark. No hay bases del usuario, broker de contratos o despliegue de aplicación. Se prueba un callback que falla, no la muerte forzada del proceso: la recuperación por timeout existe en el wrapper, pero no se ha sometido a esa inyección de fallo. El cleanup no sobrevive por definición a cualquier interrupción posible.

## Ejercicio: distinguir un fallo de infraestructura de uno de SQL

En una copia, utiliza un digest inexistente manteniendo `neverPull`. Observa que no se ejecuta ninguna aserción SQL. Restaura la imagen y elimina después el `CHECK` de importe positivo: ahora debe fallar la expectativa sobre la constraint. Explica por qué los dos rojos aportan información distinta.

Seguiremos con [fixtures y factories que dejan visible el escenario](/posts/fixtures-factories-datos-prueba-deterministas).

## Referencias

- [Testcontainers Node: módulo PostgreSQL](https://node.testcontainers.org/modules/postgresql/).
- [Testcontainers Node: contenedores, recursos y cleanup](https://node.testcontainers.org/features/containers/).
- [PostgreSQL 18: códigos de error](https://www.postgresql.org/docs/18/errcodes-appendix.html).

Fuentes consultadas el 22 de octubre de 2026. Versiones del laboratorio: Node 24.19.0 y Testcontainers 12.2.1.
