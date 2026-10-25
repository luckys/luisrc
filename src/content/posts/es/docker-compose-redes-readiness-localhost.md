---
id: DOCKER-COMPOSE
title: 'Redes y readiness en Docker Compose: por qué localhost apunta al lugar equivocado'
published: 2026-10-25T10:03:00Z
locale: es
translationKey: container-environments-compose
slug: docker-compose-redes-readiness-localhost
draft: true
status: draft
level: intermedio
prerequisites: [DOCKER-STAGES]
description: 'Conecta una API, Redis y PostgreSQL mediante DNS de Compose. Distingue puertos internos y publicados, healthchecks de arranque y readiness, con caídas de dependencias observadas por HTTP.'
author: 'Luis Ramírez Calle'
series: 'Docker: construir y comprobar un entorno reproducible'
tags: [docker-compose, networking, readiness, redis, postgresql]
---

PostgreSQL está funcionando, pero la API recibe connection refused al conectarse a `localhost:5432`. Dentro del container de la API, `localhost` apunta a ese mismo container. La base de datos está en otro.

Después de [construir la image de ejecución](/posts/multi-stage-build-typescript-runtime), necesitamos conectar los servicios y decidir cuándo pueden recibir trabajo. **Docker Compose** describe esas relaciones; la aplicación sigue teniendo que responder a los fallos que ocurran después del arranque.

## Los nombres de servicio evitan fijar direcciones IP

Compose permite que los servicios de una red se encuentren por nombre. La API usa `postgres:5432` y `redis:6379`. No necesita conocer las IP asignadas a sus containers, que pueden cambiar al recrearlos.

Hay dos redes en el ejemplo. **backend** conecta los tres servicios y tiene `internal: true`. **edge** solo conecta la API y permite publicar su puerto hacia el host. PostgreSQL y Redis no publican puertos.

Ese diseño evita abrir los dos servicios de datos para una prueba que solo necesita HTTP. No es una frontera de autorización entre API y base de datos: la API pertenece a backend y puede alcanzarlos. Tampoco reemplaza los permisos de PostgreSQL o la autenticación de Redis.

<img src="/assets/visuals/container-environments/DOCKER-COMPOSE.svg" alt="El host accede por un puerto aleatorio ligado a 127.0.0.1 a api:3000. La API participa en edge y backend; PostgreSQL y Redis solo están en backend interna y se descubren por nombre de servicio." width="374" height="430" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/container-environments/DOCKER-COMPOSE.svg).

## El puerto del proceso y el publicado son decisiones distintas

Node escucha en `0.0.0.0:3000` **dentro del container**. Escuchar solo en `127.0.0.1` dentro de él impediría atender conexiones que llegan por su interfaz de red.

Compose publica el puerto así, en `services.api`:

```yaml
    ports:
      - "127.0.0.1::3000"
```

El primer componente limita la publicación al loopback del host. El puerto del host se deja vacío para que Docker asigne uno disponible. El último número es el puerto interno de la API.

Para descubrir la dirección desde la carpeta del paquete:

```bash
docker compose port api 3000
```

El resultado tiene la forma `127.0.0.1:<puerto>`. Se usa esa dirección en el host. Otro servicio en la red de Compose usaría `api:3000`; no necesita dar la vuelta por el puerto publicado.

El harness automatizado usa otro nombre de proyecto aleatorio para evitar interferencias con un arranque manual. Por eso consulta el puerto usando su propio `-p <proyecto>`, en lugar de asumir que coincide con el del ejemplo manual.

## depends_on ordena el arranque; healthcheck define qué esperamos

La API declara estas dependencias:

```yaml
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

PostgreSQL se comprueba con `pg_isready`; Redis, con `redis-cli ping`. Compose espera esos healthchecks antes de arrancar la API. Esperar simplemente a que exista un proceso no bastaría si todavía está inicializando sus archivos.

Un healthcheck tiene el alcance de su comando. `pg_isready` indica disponibilidad del servidor, pero no demuestra que una operación de negocio tenga permisos ni que su esquema sea correcto. El ejercicio termina de verificarlo creando y leyendo una nota.

Después del arranque, `depends_on` no impone una relación permanente del tipo «si PostgreSQL cae, toda la aplicación se detiene». La caída debe detectarse y manejarse en la aplicación. Tampoco un estado unhealthy reinicia por sí solo un container en este Compose.

## Liveness y readiness hacen preguntas diferentes

`GET /live` responde cuando el proceso HTTP atiende. `GET /ready` ejecuta una consulta a PostgreSQL, porque sin esa dependencia la API no puede crear notas ni resolver lecturas fuera de cache.

Extracto de `src/server.ts`:

```typescript
    if (req.method === 'GET' && path === '/live') return reply(200, { live: true })
    if (req.method === 'GET' && path === '/ready') {
      await db.query('SELECT 1')
      return reply(200, { ready: true, cacheConnected: redis.isReady })
    }
```

Los errores de dependencia llegan al manejador que devuelve `503`. La consulta no comprueba todo el esquema; las pruebas HTTP aportan esa evidencia adicional para este caso.

Redis es prescindible para la corrección de estas lecturas. La readiness devuelve su estado de conexión como diagnóstico, pero no se vuelve negativa por perder esa cache. Si tu servicio no soportara la carga sin Redis, tendrías que revisar esta política con datos de capacidad.

## Una cache caída necesita un camino de salida

El cliente Redis tiene `disableOfflineQueue: true`: las operaciones no se acumulan esperando indefinidamente una reconexión. Cada comando usado aquí recibe un `AbortSignal` con presupuesto de quinientos milisegundos. El cliente intenta reconectar; mientras tanto, la lectura puede acudir a SQL.

El pool de **pg** tiene límites de conexiones y timeouts. No se trata de valores universales: sirven para acotar este fixture. Cancelar la espera del cliente tampoco equivale a probar que una operación remota nunca llegó a ejecutarse. Aquí el fallback afecta a lecturas; la creación de notas solo se confirma tras el `INSERT` de PostgreSQL.

La función `readNote` comprueba la forma e identidad del dato cacheado. Si no sirve, consulta SQL e intenta repoblar la cache. Las notas son inmutables, de modo que este ejemplo no necesita resolver versiones de una nota actualizada.

## Qué respuestas se observaron al detener servicios

El harness detiene únicamente los servicios de su proyecto y consulta por HTTP:

<div role="region" aria-label="Respuestas observadas ante caídas de dependencias" tabindex="0" style="overflow-x:auto">

| Situación | Petición | Respuesta observada | Interpretación |
| --- | --- | --- | --- |
| Redis detenido | Leer nota existente | `200`, source `postgres` | El dato sigue disponible sin cache |
| Redis detenido | `/ready` | `200`, cache desconectada | SQL sigue disponible |
| PostgreSQL detenido | `/live` | `200` | El proceso HTTP sigue atendiendo |
| PostgreSQL detenido | `/ready` | `503` | Falta una dependencia obligatoria |
| PostgreSQL detenido | Leer ID fuera de cache | `503` | No se inventa un `404` sin consultar SQL |

</div>

Una nota ya cacheada podría leerse mientras PostgreSQL está caído. No usamos esa posibilidad para declarar disponible toda la API: otras peticiones necesitan SQL. Después de recuperar PostgreSQL, el ejercicio comprueba readiness y la nota persistida.

El [visor de la ejecución](/assets/interactive/container-environments/explorer.html) permite recorrer estas fases. Solo muestra datos archivados; no controla containers.

## Código completo y pruebas

Clona el repositorio y consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/container-environments/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
```

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/docker-compose/README.md) reúne Compose, API y ejercicio. Tras la instalación del README:

```bash
pnpm --filter @luisrc-examples/container-environments test
pnpm --filter @luisrc-examples/container-environments exercise
pnpm --filter @luisrc-examples/container-environments verify
```

## Garantías y límites

Se probaron descubrimiento por nombres de servicio, puertos de datos sin publicar y los fallos descritos con Redis y PostgreSQL reales. Se inspeccionó que backend era interna y que el puerto de la API estaba ligado a `127.0.0.1`.

No hay TLS, autorización de usuarios, balanceador, orquestador de producción ni validación de capacidad sin cache. La red interna limita conectividad; no impide que un administrador del host acceda a Docker.

## Ejercicio: distinguir un arranque correcto de una dependencia estable

Antes de leer la captura, predice qué responderán `/live`, `/ready` y una lectura no cacheada con PostgreSQL detenido. Después explica por qué reiniciar la API sin recuperar la base de datos no corrige la dependencia que falta.

## Referencias

- [Docker: networking en Compose](https://docs.docker.com/compose/how-tos/networking/).
- [Compose: redes e internal](https://docs.docker.com/reference/compose-file/networks/).
- [Docker: startup order y service_healthy](https://docs.docker.com/compose/how-tos/startup-order/).
- [Redis: conexión y opciones del cliente Node](https://redis.io/docs/latest/develop/clients/nodejs/connect/).
- [node-postgres: connection pooling](https://node-postgres.com/features/pooling).

Fuentes consultadas el 25 de octubre de 2026.
