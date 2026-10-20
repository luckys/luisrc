---
id: API-ASYNC
title: 'Asincronía en Node.js: por qué un solo hilo también tiene race conditions'
published: 2026-10-17T01:01:00Z
locale: es
translationKey: reliable-node-concurrency
slug: asincronia-nodejs-carreras-concurrencia
draft: true
status: draft
level: intermedio
prerequisites: []
description: 'Distingue asincronía, concurrencia y paralelismo. Reproduce una actualización perdida en Node.js sin depender de pausas ni de la suerte.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [nodejs, typescript, concurrencia, asincronia]
---

Dos peticiones incrementan un contador. El resultado sube una sola vez, aunque el código corre en el hilo principal de Node.js. No hacen falta dos instrucciones ejecutándose a la vez para perder una actualización.

En esta segunda entrega de **APIs y seguridad sin atajos** separaremos **asincronía**, **concurrencia** y **paralelismo**. Saber distinguirlas evita diseñar una solución para un problema distinto del que tienes.

Necesitas entender funciones `async` y promesas. Si vienes de la entrega sobre [cantidades monetarias](/posts/dinero-tipos-validacion-typescript), piensa en un saldo ficticio; aquí solo contaremos unidades, sin hacer contabilidad.

## Un await puede separar una decisión de su escritura

**Concurrencia** significa que varias tareas están en progreso durante un periodo compartido. **Paralelismo** implica ejecución simultánea. Un **event loop** puede intercalar tareas sin ejecutar sus fragmentos TypeScript simultáneamente en ese hilo.

Cada `await` puede devolver el control mientras una operación sigue pendiente. Otra petición puede observar el estado antes de que la primera continúe. El problema aparece si ambas decisiones dependen de una lectura que después deja de ser actual.

<img src="/assets/visuals/reliable-services/API-ASYNC.svg" alt="Dos tareas leen cero, esperan en una barrera y escriben uno; el resultado es una actualización perdida aunque sus escrituras no sean simultáneas." width="570" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-ASYNC.svg).

## Un fallo reproducible sin setTimeout

Archivo: `reliable-services/tests/core.test.mjs` (extracto del escenario deliberadamente incorrecto).

```javascript
let balance = 0
let arrived = 0
let release
const gate = new Promise((resolve) => {
  release = resolve
})
async function broken() {
  const old = balance
  if (++arrived === 2) release()
  await gate
  balance = old + 1
}
await Promise.all([broken(), broken()])
assert.equal(balance, 1)
```

La **barrera** `gate` impide escribir hasta que ambas tareas hayan leído. Al llegar la segunda, se libera la promesa. Cada tarea conserva `old = 0`; cada una termina escribiendo `1`.

El test afirma el resultado incorrecto a propósito: demuestra el fallo de esta versión, no lo convierte en comportamiento deseado. Una prueba de la solución deberá exigir `2`.

**`Promise.all`** espera a que las tareas terminen o propaga el primer rechazo. No transforma las operaciones en una transacción, no evita intercalados y no cancela automáticamente las tareas restantes cuando una falla.

## La solución depende de quién comparte el estado

En memoria, si el incremento no necesita I/O entre lectura y escritura, hacerlo en un solo fragmento síncrono elimina este intercalado concreto. Otra posibilidad es serializar el acceso con una cola local. Ambas protegen únicamente ese proceso.

Si el contador vive en PostgreSQL y hay varias instancias de la API, un mutex de Node.js no coordina las demás. Puedes expresar el incremento como una escritura atómica, como `SET value = value + 1`, o utilizar un control de versión cuando la actualización dependa de datos previamente leídos.

La elección se explica con más detalle en [concurrencia y bloqueos](/posts/concurrencia-bloqueos-postgresql). No es necesario repetir todo el laboratorio SQL para reconocer aquí el mismo patrón: leer, decidir y escribir en momentos separados.

## Asíncrono no significa gratuito

Una consulta de red permite liberar el hilo mientras llega la respuesta. Un cálculo largo escrito en TypeScript sigue ejecutándose como JavaScript en el runtime y puede ocupar el hilo principal. Poner `async` delante de su función no lo traslada a otro núcleo.

Para trabajo intensivo en CPU, **worker threads**, procesos o servicios especializados pueden aportar paralelismo. Tienen costes de comunicación, memoria y coordinación. Para esperar muchas respuestas de red, limitar el número de operaciones simultáneas suele ser más importante que crear un worker por petición.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-async/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

El experimento demuestra una race condition lógica con dos tareas y un punto de sincronización controlado. No mide throughput ni modela todos los mecanismos internos de Node.js. Algunas operaciones del runtime usan threads del sistema o un worker pool; «un solo hilo» no describe el proceso completo.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/tests/core.test.mjs). Desde `reliable-services/`, ejecuta:

```bash
node --test --test-name-pattern="misma versión" tests/core.test.mjs
```

## Ejercicio: arreglar sin esconder la carrera

Añade una versión correcta que produzca `2` manteniendo el test de la versión incorrecta. Explica qué ocurriría al ejecutar dos procesos en lugar de dos tareas. El criterio de éxito no es «ahora suele pasar»: ambos resultados deben ser deterministas.

Seguimos con [el contrato HTTP de una operación](/posts/contratos-http-recursos-operaciones), que también deberá expresar qué termina ahora y qué puede quedar pendiente.

## Referencias

- [Node.js: no bloquear el event loop ni el worker pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).
- [ECMAScript: Promise.all](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.all).
- [PostgreSQL 18: aislamiento de transacciones](https://www.postgresql.org/docs/18/transaction-iso.html).

Fuentes consultadas el 17 de octubre de 2026. Ejemplo ejecutado con Node.js 24.19.0.
