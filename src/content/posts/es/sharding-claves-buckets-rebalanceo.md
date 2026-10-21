---
id: DIST-SHARDING
title: 'Sharding: elegir una clave también decide qué consultas y cambios serán difíciles'
published: 2026-10-21T11:05:00Z
locale: es
translationKey: distributed-sharding-routing
slug: sharding-claves-buckets-rebalanceo
draft: true
status: draft
level: intermedio
prerequisites: [DIST-CAP]
description: 'Distingue réplicas y shards, compara claves y hotspots, prueba routing con buckets y revisiones, y explica por qué cambiar el directorio no migra registros.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos distribuidos: réplicas, orden y particiones'
tags: [sistemas-distribuidos, sharding, particiones, escalabilidad, typescript]
---

Repartimos los envíos entre dos servidores usando un hash. Al añadir un tercero, muchas claves cambian de destino, pero sus registros siguen guardados en el anterior. El nuevo routing funciona según su fórmula y, aun así, la consulta no encuentra el envío.

**Sharding** no consiste solo en calcular un número. También hay que decidir qué datos permanecen juntos, cómo se consultan y cómo cambian de dueño sin perder las escrituras que llegan durante el traslado.

Después de [CAP y PACELC](/posts/cap-pacelc-particiones-latencia-consistencia), cerramos estos fundamentos distinguiendo dos decisiones: copiar el mismo dato y distribuir datos diferentes. El laboratorio de este post solo implementa la parte de **routing**, no una migración de almacenamiento.

## Un shard guarda una parte; una réplica guarda otra copia

Con replicación, A y B pueden contener copias del mismo envío. Con sharding, un grupo almacena unos envíos y otro almacena los restantes. Además, cada shard puede tener sus propias réplicas.

Así, «seis nodos» podría significar dos shards con tres réplicas cada uno, no seis copias de todo ni seis partes independientes. Para entender capacidad y tolerancia a fallos necesitamos la distribución concreta.

La partición de tablas dentro de un motor tampoco implica automáticamente varios servidores o dominios de fallo. Aquí usamos sharding para referirnos al reparto de datos entre unidades de almacenamiento que podemos ubicar de forma separada.

La [guía de sharding de Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/sharding) recoge estrategias por rangos, hash y directorio, además de sus costes. La elección depende de cómo accedemos a los datos, no solo de repartir filas por igual.

## La clave decide qué trabajo queda localizado

Si elegimos `tenantId`, consultar los envíos de un tenant puede dirigirse a un grupo. Pero un tenant muy grande concentra carga. Si elegimos `shipmentId`, repartimos esas claves de otra forma y quizá necesitemos consultar varios shards para obtener el listado completo de un tenant.

Una clave por fecha facilita ciertos recorridos temporales, pero un rango que recibe todas las escrituras recientes puede calentarse. Un hash reparte identificadores, aunque no garantiza repartir el **trabajo**: una sola clave popular puede recibir muchísimas peticiones.

Un **hotspot** no se detecta contando únicamente filas. También importan bytes, lecturas, escrituras, coste de consulta y picos por cliente. Añadir shards sin poder dividir la unidad caliente puede no resolver la saturación.

No elegimos una clave definitiva para una aplicación real: faltan distribución y requisitos medidos. `shipment-1` es una identidad ficticia para observar rutas, no una recomendación universal de particionado.

## Hash modulo es sencillo, pero cambiar N cambia el mapa

Archivo: `packages/distributed-foundations/src/routing.ts`. El import de `createHash` desde `node:crypto` y los validadores están en el archivo completo.

```typescript
export function bucketFor(key: string, count: number): number {
  label(key)
  integer(count, 1, 65536)
  const hash = createHash('sha256').update(key, 'utf8').digest().readUInt32BE(0)
  return hash % count
}
```

El hash produce un entero reproducible para la misma clave UTF-8. El resto lo ubica entre 0 y `count - 1`. No usamos `Math.random`, porque un router debe poder volver a localizar la misma clave.

La demo genera mil claves `shipment-0` a `shipment-999`. Al cambiar de módulo 2 a módulo 3, **679** obtienen un número distinto. Es el resultado de este conjunto y este algoritmo, no un porcentaje de migración aplicable a cualquier sistema.

Si interpretásemos esos números directamente como servidores, cambiar N obligaría a resolver muchos traslados. Recalcular rutas no cambia dónde están los datos. El benchmark que falta no es una optimización del hash: falta diseñar el cambio de ubicación.

## Un bucket lógico separa la clave del servidor físico

Podemos mantener un número fijo de **buckets** lógicos y un directorio que indique a quién pertenece cada uno. La clave calcula su bucket; el directorio resuelve el owner físico.

Al mover un bucket, no cambiamos el hash ni el número de buckets. Cambia la asignación bucket → owner. Esto introduce metadatos de routing que hay que distribuir y versionar.

El laboratorio copia el array inicial de owners y expone rutas inmutables con `key`, `bucket`, `owner` y `revision`. `move` comprueba la revisión esperada antes de cambiar la asignación. Dos decisiones basadas en una versión anterior no se aceptan silenciosamente una detrás de otra.

<img src="/assets/visuals/distributed-foundations/DIST-SHARDING.svg" alt="shipment-1 se asigna a un bucket lógico cuyo directorio indica east en revisión uno; una transferencia de datos no implementada precedería al cambio a west en revisión dos, que invalida rutas antiguas." width="303" height="860" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/distributed-foundations/DIST-SHARDING.svg).

No es una implementación de **consistent hashing** ni de un coordinador durable. Es una indirection table pequeña que permite observar el problema de los mapas antiguos.

## Una revisión detecta una ruta antigua; no la corrige sola

Archivo: `tests/clock-routing.test.mjs`, cuerpo del caso de traslado de bucket.

```javascript
const table = routingTable(['east', 'west', 'east', 'west'])
const previous = table.route('shipment-1')
const destination = previous.owner === 'east' ? 'west' : 'east'
table.move(previous.bucket, destination, previous.revision)
assert.throws(() => table.validate(previous), /stale_route/)
const current = table.route('shipment-1')
assert.equal(current.owner, destination)
assert.equal(current.bucket, previous.bucket)
assert.equal(current.revision, 2)
table.validate(current)
```

El bucket no cambia. Sí lo hacen el owner y la revisión. La validación rechaza la ruta antigua y acepta la nueva. Es una comprobación local contra un directorio actualizado, no una red que difunde revisiones a todos sus clientes.

Usamos una revisión global por sencillez: cualquier cambio invalida también rutas de otros buckets. Un sistema real podría elegir otra granularidad. Aquí preferimos hacer explícito ese coste antes que añadir un protocolo de caché que el ejercicio no necesita.

Rechazar `stale_route` solo ayuda si la operación no ha producido ya un efecto en el owner incorrecto. En producción habría que comprobar autoridad antes del efecto y definir cómo obtener un mapa nuevo, reintentar o redirigir de forma segura. El fixture no ejecuta esas escrituras.

## Migrar registros requiere un protocolo además del directorio

Antes de publicar el nuevo owner, hay que transferir datos y tratar las escrituras concurrentes. Un plan podría copiar un snapshot, capturar cambios posteriores, alcanzar una posición acordada y cambiar la autoridad de escritura. Cada paso necesita condiciones y recuperación ante fallos.

Otra opción es pausar brevemente las escrituras afectadas. Reduce una parte de la coordinación, pero tiene un coste de disponibilidad que debe ser aceptable. No hay una solución sin trade-offs que salga del hash.

Publicar primero y copiar después puede dirigir lecturas a un destino vacío. Escribir libremente en ambos lados puede producir versiones incompatibles. Borrar el origen antes de verificar el destino vuelve difícil recuperar el dato.

Por eso `move` se llama dentro de un **modelo de metadatos**: no mueve registros, no hace dual writes y no garantiza que el destino esté listo. El diagrama marca la transferencia como paso necesario fuera de lo implementado.

## Los límites de una transacción cambian con la distribución

Si los datos que deben cambiar juntos viven en un shard, el motor puede ofrecer una transacción local bajo sus propias garantías. Si los repartimos entre varios, necesitamos saber qué soporte transaccional distribuido ofrece el sistema o diseñar otro flujo explícito.

No significa que todo sharding prohíba transacciones entre shards. Significa que no podemos atribuir a varios grupos la misma atomicidad local sin comprobar el mecanismo y su coste.

Los joins y agregados globales también cambian: pueden requerir scatter-gather, índices adicionales o proyecciones. Una clave que mejora la escritura puede complicar la consulta dominante. Esa es una razón para medir antes de repartir, no para evitar siempre el reparto.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-sharding/README.md), el [routing versionado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/distributed-foundations/src/routing.ts) y la demo de claves.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/distributed-foundations test
pnpm --dir packages/distributed-foundations typecheck
pnpm --dir packages/distributed-foundations demo
```

## Garantías y límites

Comprobamos routing estable para la misma clave, validación, cambio de owner con revisión esperada y rechazo de mapas antiguos. La demo observa 679 claves remapeadas al pasar de módulo 2 a 3 en un fixture de mil claves.

No almacenamos envíos, migramos datos, distribuimos un directorio o medimos balance de carga. No hay clúster, transacciones entre shards o rebalanceo recuperable. Un mapa actualizado no prueba ninguna de esas propiedades.

## Ejercicio: justificar la unidad que repartes

Compara `tenantId`, `shipmentId` y una clave temporal para tres consultas: detalle de envío, listado de un tenant y resumen diario global. Indica cuáles quedan localizadas y qué ocurriría con un tenant que concentra la mayoría de escrituras.

Después diseña el traslado de un bucket en papel: cuándo se copia, quién escribe y qué evidencia permite retirar la copia antigua. Si no puedes responder la segunda pregunta, aún no basta con modificar el directorio.

El siguiente bloque del recorrido editorial profundiza en **Kafka**: un log particionado también necesita claves, posiciones y reglas de replay. Una partición de Kafka y un shard de base de datos no deben tratarse como el mismo contrato.

## Referencias

- [Microsoft Azure Architecture Center: sharding pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/sharding).
- [Dynamo: particionado y distribución, sección 4.2](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf).

Fuentes consultadas el 21 de octubre de 2026. Los resultados de hashing no miden throughput, latencia o coste de migración.
