---
id: TEST-LAYERS
title: 'Unit, integration y E2E: elegir la frontera que puede detectar el fallo'
published: 2026-10-21T13:03:00Z
locale: es
translationKey: testing-layers-boundaries
slug: unit-integration-e2e-fronteras-piramide-pruebas
draft: true
status: draft
level: intermedio
prerequisites: [TEST-DOUBLES]
description: 'Diseña una cartera de unit, integration y E2E por el riesgo observado. Prueba HTTP y SQLite reales, y declara qué queda fuera del recorrido.'
author: 'Luis Ramírez Calle'
series: 'Pruebas de software: reglas, fronteras y evidencia'
tags: [testing, integration, e2e, typescript]
---

La función de transición rechaza un cambio inválido, pero el endpoint responde `200` porque su handler ignora el error. Probar veinte veces más esa función no detectaría el fallo de ensamblaje. Necesitamos ejecutar la parte donde puede producirse.

Elegir entre **unit**, **integration** y **E2E** no consiste en ordenar tests por prestigio. Consiste en decidir qué piezas deben ser reales para que una expectativa pueda fallar por el motivo que nos preocupa. El registro de trabajos de la [entrega sobre test doubles](/posts/test-doubles-stubs-spies-fakes-contratos) nos permite recorrer esas fronteras sin desplegar una plataforma completa.

## Los nombres ayudan si explicamos qué ejecutan

Una **unit test** comprueba una unidad de comportamiento pequeña. Esa unidad puede ser una función o varias piezas que colaboran sin infraestructura externa. No tiene por qué coincidir con un archivo ni exigir reemplazar cada función auxiliar por un mock.

Una **integration test** ejecuta la colaboración entre componentes o una dependencia real: el adaptador y SQLite, por ejemplo. Una **end-to-end test** recorre el sistema entre los extremos que hayamos definido. Puede empezar en una UI o en una API; llamar E2E a un test no informa de esos extremos si no los explicamos.

En este laboratorio usamos el nombre «integración del componente API» para `fetch → HTTP → execute → SQLite`. El recorrido es real, pero no incluye navegador de aplicación, identidad, worker ni entorno desplegado. No lo presentamos como una prueba E2E de un producto que todavía no existe.

## La testing pyramid es una orientación, no una cuota

La **testing pyramid** sugiere combinar muchas pruebas de alcance pequeño con menos recorridos amplios. Su utilidad está en recordar que no conviene depender exclusivamente de escenarios que preparan todo el sistema para cada regla.

No impone una distribución de 70/20/10 ni garantiza que todas las integraciones sean lentas. En nuestro ejercicio SQLite local cuesta poca preparación; en otro sistema una prueba de integración puede depender de una red o de un entorno compartido.

Como explica [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html), conviene entender la granularidad más que aferrarse a los nombres. Nuestra decisión concreta es situar cada fallo donde podamos observarlo:

<div role="region" aria-label="Riesgos, fronteras de prueba y observaciones necesarias" tabindex="0" style="overflow-x:auto">

| Riesgo | Frontera mínima útil aquí | Observación |
| --- | --- | --- |
| Un éxito acepta un fallo atrasado | `transition` | Rechazo de `fail` |
| Cambiar el estado no incrementa versión | `apply` | Valor final y original intacto |
| El servicio confirma una escritura rechazada | Servicio con stub de conflicto | Rechazo, no éxito inventado |
| El adaptador olvida el `WHERE version` | Repositorio con SQLite | Un solo cambio confirmado |
| El handler transforma mal un conflicto | HTTP con servicio real | Código `409` y estado sin alterar |
| Una pantalla envía otro campo | UI y API ensambladas | Falta una prueba en este lab |

</div>

La última fila es una carencia declarada, no un resultado aprobado. Un test HTTP no observa qué datos enviaría una pantalla real.

<img src="/assets/visuals/testing-strategy/TEST-LAYERS.svg" alt="Las reglas se prueban sin infraestructura, el adaptador con SQLite y la API con fetch y HTTP; la UI, identidad, worker y despliegue quedan fuera de ese recorrido." width="330" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/testing-strategy/TEST-LAYERS.svg).

## Una fixture aislada evita que el orden de tests decida el resultado

Cada escenario HTTP crea su propia base `:memory:`, inserta `j-1` y escucha en `127.0.0.1` con puerto `0`. El sistema operativo elige un puerto libre; no dependemos de que `3000` esté disponible ni compartimos registros con otros tests.

La fixture espera el evento `listening` antes de devolver la función `request`. Al terminar cierra conexiones HTTP, servidor y base de datos. El escenario de archivo usa un directorio temporal propio y lo retira tras cerrar SQLite.

No hay una pausa del tipo «espera 200 ms y prueba». Esperamos señales que indican lo que realmente necesitamos. Eso reduce una fuente de **flakiness**, pero no convierte la máquina, el sistema operativo o cualquier timeout en deterministas por definición.

Tampoco arrancamos dependencias del usuario ni apuntamos a un host configurable. Todos los sockets del laboratorio son loopback. Esta restricción es útil para un ejercicio de integración; no es una prueba de conectividad entre servicios desplegados.

## Observar HTTP y el estado posterior detecta errores distintos

En `tests/http.test.mjs`, el helper `fixture(t)` devuelve `request`, que usa `fetch` sobre el servidor real. El trabajo inicial está en `queued`, versión cero:

```javascript
test('HTTP + SQLite: start, succeed, repetir y leer el estado confirmado', async (t) => {
  const { request } = await fixture(t)
  const started = await request('/jobs/j-1', 'start', 0)
  assert.equal(started.status, 200)
  assert.match(started.headers.get('content-type'), /^application\/json/)
  assert.deepEqual(await started.json(), { id: 'j-1', state: 'running', version: 1 })
  await request('/jobs/j-1', 'succeed', 1)
  const repeated = await request('/jobs/j-1', 'succeed', 2)
  assert.equal(repeated.status, 200)
  assert.deepEqual(await repeated.json(), { id: 'j-1', state: 'succeeded', version: 2 })
  assert.equal((await request('/jobs/j-1', 'fail', 2)).status, 409)
  assert.deepEqual(await (await request('/jobs/j-1')).json(), { id: 'j-1', state: 'succeeded', version: 2 })
})
```

El `409` demuestra cómo se traduce el rechazo a HTTP. La lectura final observa otra cosa: el intento rechazado no dejó almacenado `failed`. Comprobar únicamente el status permitiría que el handler devolviera un conflicto después de guardar el cambio incorrecto.

La repetición lleva `expectedVersion: 2`, la versión ya confirmada. Reenviar la petición anterior con versión `1` produciría conflicto. No prometemos replay transparente de peticiones con una idempotency key: aquí la precondición de versión sigue formando parte del comando.

El esquema HTTP del ejercicio solo admite `GET` y `POST` sobre un ID válido. Otro test diferencia `400` para JSON mal formado, `422` para un comando inválido, `404` para ausencia y `500` público sin detalles privados si falla el almacenamiento. El parser acumula como máximo 1024 bytes de cuerpo, pero termina de consumir la petición antes de rechazar el exceso. No es una defensa completa frente a clientes hostiles o cargas sostenidas.

## Dos peticiones no equivalen a probar todas las carreras

También ejecutamos dos peticiones con versión cero, una para iniciar y otra para cancelar. Este extracto de `tests/http.test.mjs` exige que solo una consiga cambiar el registro:

```javascript
test('HTTP: dos comandos con versión cero no reciben ambos éxito', async (t) => {
  const { request } = await fixture(t)
  const responses = await Promise.all([
    request('/jobs/j-1', 'start', 0), request('/jobs/j-1', 'cancel', 0),
  ])
  assert.deepEqual(responses.map((r) => r.status).toSorted(), [200, 409])
  const winner = await (await request('/jobs/j-1')).json()
  assert.equal(winner.version, 1)
  assert.ok(['running', 'cancelled'].includes(winner.state))
})
```

Esto comprueba el contrato observable para esas dos solicitudes. No fuerza un intercalado específico entre las lecturas y las escrituras, y SQLite se usa desde una única conexión síncrona. Para demostrar una carrera entre escritores independientes necesitaríamos controlar ese intercalado y usar conexiones o procesos apropiados.

No añadimos sleeps para intentar que la carrera «salga». Tampoco inferimos seguridad frente a cualquier carrera porque esta ejecución termine bien.

## Qué conservar en una futura E2E

Si añadimos una interfaz para lanzar trabajos, un recorrido útil podría crear uno, iniciarlo y comprobar su estado final en pantalla. La prueba debería usar el cliente construido y la API ensamblada, con identidad de test y un worker controlado si forman parte del requisito.

No hace falta repetir allí las veinte combinaciones de la tabla. La E2E comprobaría que las piezas se conectan y el usuario observa el resultado, mientras los ejemplos del núcleo seguirían explicando cada regla con fallos más localizados.

Ante una regresión, añade primero una prueba en la frontera donde faltaba evidencia. Después decide si necesitas otra más pequeña para diagnosticarla mejor. Duplicar todas las aserciones en todas las capas aumenta mantenimiento sin cubrir necesariamente nuevos riesgos.

## Código completo y pruebas

El [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/test-layers/README.md) enlaza las fuentes. La [suite HTTP completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/testing-strategy/tests/http.test.mjs) contiene la fixture y las aserciones anteriores.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/testing-strategy test
pnpm --dir packages/testing-strategy test:integration
pnpm --dir packages/testing-strategy verify
```

Se ejecutaron 28 tests locales y once de contratos/HTTP. `verify` repite esas suites y registra sus resultados y hashes en `evidence/verification.json`. No son benchmarks ni una certificación del sistema completo.

## Garantías y límites

Sin navegador de aplicación, autenticación, TLS, worker, PostgreSQL, Testcontainers o despliegue remoto. La reapertura de archivo usa cierre limpio, no pérdida eléctrica. Los tests no proporcionan evidencia de todas las carreras posibles ni de rendimiento bajo carga.

## Ejercicio: colocar una regresión en la frontera correcta

Cambia la traducción HTTP de `invalid_transition` de `409` a `200`. Comprueba que la suite del núcleo sigue pasando y la HTTP falla. Restaura el código y explica qué frontera observa el error. Después piensa qué prueba faltaría si el handler estuviera bien, pero una pantalla enviara `status` en vez de `command`.

En la última parte revisaremos [por qué ejecutar todo el código no implica detectar sus errores](/posts/coverage-mutation-testing-aserciones-que-detectan-fallos).

## Referencias

- [Ham Vocke: The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html).
- [Node.js 24: test runner y hooks](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Node.js 24: SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

Fuentes consultadas el 21 de octubre de 2026; redacción revisada el 22. Resultados del laboratorio con Node 24.19.0.
