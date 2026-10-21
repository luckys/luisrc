---
id: P048
title: 'Replicación y consistencia: por qué una escritura confirmada todavía puede no verse'
published: 2026-10-21T11:00:00Z
locale: es
translationKey: distributed-replication-consistency
slug: replicacion-consistencia-lecturas-obsoletas
draft: true
status: draft
level: intermedio
prerequisites: [DIST-FAILURES, ARCH-CQRS]
description: 'Observa dos réplicas con mensajes retenidos, distingue confirmación y frescura, y prueba un token de versión sin confundirlo con linearizability.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos distribuidos: réplicas, orden y particiones'
tags: [sistemas-distribuidos, replicacion, consistencia, typescript, testing]
---

La API confirma que un envío está en camino. Al refrescar la página vuelve a aparecer «pendiente». Una posibilidad es que la segunda petición haya leído otra copia de los datos, todavía sin actualizar.

Antes de añadir un retry o invalidar cachés, necesitamos saber qué confirmó la escritura y de dónde sale cada lectura. Tener dos copias no significa que ambas avancen al mismo tiempo.

Esta serie continúa los [costes de distribuir un sistema](/posts/monolito-microservicios-despliegue-costes). Ya vimos que un [timeout no confirma un fracaso remoto](/posts/fallos-parciales-timeout-resultado-desconocido) y que una [proyección CQRS puede ir por detrás](/posts/cqrs-modelos-lectura-consistencia). Ahora aislaremos el caso de **replicar el mismo registro**, no de construir otra representación de lectura.

## Replicación copia datos; consistencia define qué puede observarse

La **replicación** mantiene copias de información en varios nodos. Puede servir para tolerar ciertas caídas, acercar lecturas a usuarios o repartir consultas. No elimina el trabajo: cada cambio debe propagarse y cada copia consume recursos.

Un **modelo de consistencia** restringe las historias que pueden observar los clientes. No describe solo si dos discos contienen los mismos bytes en este instante. Importan el orden de las operaciones, las respuestas y qué escrituras puede devolver una lectura. El [mapa de modelos de Jepsen](https://jepsen.io/consistency/models) ayuda a distinguir garantías que a menudo se agrupan bajo «consistencia fuerte».

En este ejercicio un único writer asigna versiones crecientes. A mantiene el registro principal y B una copia. Los mensajes contienen un snapshot completo del registro, por ejemplo `{ version: 1, value: 'shipped' }`.

Elegimos un **single-writer register** para no introducir conflictos entre escritores en el primer paso. No es un flujo que deba ejecutar cada transición del envío: sobrescribir el snapshot 1 con el 2 es distinto de saltarse un evento que debe emitir una factura.

## Confirmar antes de propagar permite una stale read

Archivo: `packages/distributed-foundations/tests/replication.test.mjs`, cuerpo de la primera prueba. Los imports están en el archivo completo.

```javascript
const pair = replicaPair()
const receipt = pair.write('shipped')
assert.deepEqual(receipt, { version: 1, value: 'shipped' })
assert.deepEqual(pair.readPrimary(), receipt)
assert.deepEqual(pair.readFollower(), { version: 0, value: 'pending' })
assert.equal(pair.pending(), 1)
pair.deliver(0)
assert.deepEqual(pair.readFollower(), receipt)
```

`write` cambia A y deja el mensaje pendiente. La confirmación del fixture solo significa «A actualizó su memoria». No promete disco ni recepción en B. Por eso la lectura posterior en B devuelve la versión 0, aunque la llamada de escritura ya terminó.

`deliver(0)` representa un paso de entrega elegido por el test. Después B devuelve la versión 1. No usamos `sleep`, porque esperar diez milisegundos no haría más precisa la explicación: queremos controlar el punto exacto en que aparece el cambio.

<img src="/assets/visuals/distributed-foundations/P048.svg" alt="A confirma la versión uno shipped mientras el mensaje queda retenido; B responde pending en versión cero y solo devuelve shipped después de entregar el mensaje pendiente." width="275" height="860" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/distributed-foundations/P048.svg).

La prueba registra **estados divergentes** de dos réplicas lógicas. No abre conexiones de red ni mide replication lag. Las réplicas son objetos separados dentro del mismo proceso.

## Asíncrono y síncrono necesitan un punto de confirmación concreto

En replicación **asíncrona**, una confirmación puede llegar antes que la copia remota. Si promovemos una réplica atrasada tras perder el principal, podemos perder escrituras que el cliente había visto confirmadas.

En replicación **síncrona**, la confirmación espera determinadas respuestas remotas. Hay que concretar cuáles: recibir bytes, persistirlos o aplicarlos no es lo mismo. La [documentación de PostgreSQL 18](https://www.postgresql.org/docs/18/warm-standby.html#SYNCHRONOUS-REPLICATION) explica esas distinciones y sus opciones.

Esperar una réplica remota también hace que esa escritura dependa de su comunicación. No basta con activar «sync» y asumir que cualquier endpoint de lectura estará actualizado: la topología, el conjunto confirmado y las reglas de lectura siguen importando.

Nuestro modelo implementa únicamente confirmación local asíncrona. No implementa replicación síncrona, failover o persistencia; se explican para poder leer un contrato real sin atribuirle al fixture capacidades que no tiene.

## Read your writes es una necesidad más concreta que «datos siempre actuales»

Para la pantalla del usuario quizá baste con no perder de vista su propio cambio. Una opción es devolver una posición en la respuesta de escritura y exigir que la lectura alcance esa posición.

Archivo: `src/replication.ts`, método de lectura del follower.

```typescript
readFollower(minVersion: number = 0): Register {
  integer(minVersion)
  if (follower.version < minVersion) throw new Error('not_caught_up')
  return follower
},
```

El token es una **versión mínima**, no un timestamp ni una contraseña. Si el usuario conserva `1`, B no puede devolver `0` como respuesta satisfactoria a esa lectura. El test comprueba el rechazo antes de entregar y el éxito después.

Una aplicación podría esperar hasta un deadline, consultar un nodo que ya tenga esa posición o mostrar que la actualización sigue pendiente. El fixture elige rechazar inmediatamente para que la condición resulte visible. No implementa espera, routing o una política de fallback.

Esto por sí solo no demuestra **linearizability**. Otro cliente sin token todavía puede leer 0; tampoco evitamos que una misma sesión lea 2 y luego pida solo su antiguo mínimo 1. Si queremos lecturas monotónicas, la sesión tendría que conservar también la mayor posición observada y el sistema respetarla.

## Linearizability y serializability responden preguntas diferentes

Para un registro **linearizable**, cada operación debe parecer efectiva en algún punto entre su inicio y su respuesta, respetando el orden real de operaciones que no se solapan. Si la escritura 1 terminó antes de empezar una lectura y no hay otra escritura, esa lectura no puede devolver 0.

La historia inicial viola esa condición. No hace falta sincronizar relojes en el laboratorio para verlo: el test inicia la lectura después de recibir la confirmación.

**Serializability** se refiere a transacciones: su resultado equivale a algún orden serial. No impone por sí sola ese mismo orden real entre transacciones no solapadas. [Peter Bailis explica la diferencia y su combinación en strict serializability](https://www.bailis.org/blog/linearizability-versus-serializability/). Elegir un isolation level SQL y elegir cómo leer réplicas no son decisiones intercambiables.

## La convergencia requiere entrega, no solo dejar pasar tiempo

El follower conserva la versión mayor. Si recibe primero 2 y después 1, no retrocede. Esto funciona porque hay un escritor que define un orden único y los mensajes reemplazan el valor completo.

Con varios escritores, dos cambios podrían llevar versiones que no expresan qué intención debe prevalecer. Harían falta otras reglas de coordinación o resolución. Quedarse con la hora mayor tampoco reconstruye automáticamente la decisión correcta.

En el modelo, si terminan las escrituras y entregamos la versión más reciente, ambas copias convergen. Si retenemos todos los mensajes para siempre, no progresan. **Eventual consistency** necesita condiciones de comunicación y reparación; no es una promesa de «espera un poco» con un plazo implícito.

## Código completo y pruebas

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p048/README.md), el [modelo de réplica](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/distributed-foundations/src/replication.ts) y sus pruebas. El repositorio usa Node.js 24.19.0 y TypeScript estricto; ejecutar código no sustituye al typecheck.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/distributed-foundations test
pnpm --dir packages/distributed-foundations typecheck
pnpm --dir packages/distributed-foundations demo
```

## Garantías y límites

Hay un writer, un registro, versiones seguras, snapshots inmutables y entrega manual reordenable. El test observa 1/shipped en A y 0/pending en B antes de entregar, y 1/shipped en ambos después. Un mensaje antiguo no hace retroceder B.

No hay red, reloj físico, disco, base de datos, pérdida de procesos o failover. Las siguientes entregas amplían las preguntas de P048, no convierten este registro en un motor distribuido.

## Ejercicio: tres lecturas con contratos distintos

Escribe `packed` y `shipped`. Entrega primero la segunda versión y después la primera. Comprueba que una lectura sin token puede ser antigua antes de entregar, que una lectura con mínimo 2 se rechaza mientras B va por detrás y que el mensaje 1 no revierte el estado final.

Después cambia de problema: con tres réplicas, ¿a cuántas hay que escribir y cuántas hay que leer para tocar al menos una copia actualizada? Esa es la pregunta del [quorum](/posts/quorum-interseccion-lecturas-escrituras).

## Referencias

- [Jepsen: modelos de consistencia](https://jepsen.io/consistency/models).
- [PostgreSQL 18: streaming y synchronous replication](https://www.postgresql.org/docs/18/warm-standby.html).
- [Peter Bailis: linearizability frente a serializability](https://www.bailis.org/blog/linearizability-versus-serializability/).

Fuentes consultadas el 21 de octubre de 2026. Los resultados son estados de un modelo determinista, no medidas de infraestructura.
