---
id: DIST-CLOCKS
title: 'Relojes lógicos de Lamport: ordenar eventos sin confundir una hora con una causa'
published: 2026-10-21T11:03:00Z
locale: es
translationKey: distributed-lamport-logical-clocks
slug: relojes-logicos-lamport-causalidad
draft: true
math: true
status: draft
level: intermedio
prerequisites: [DIST-CONSENSUS]
description: 'Implementa un contador de Lamport, observa qué ocurre al recibir un mensaje y distingue orden causal, orden total, duración y consenso.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos distribuidos: réplicas, orden y particiones'
tags: [sistemas-distribuidos, lamport, causalidad, relojes, typescript]
---

Un log dice que una respuesta llegó antes de que se enviara la petición. Antes de buscar viajes en el tiempo, conviene comprobar si esas líneas proceden de máquinas con relojes diferentes.

Ordenar por fecha sirve para investigar, pero no demuestra por sí solo qué evento pudo influir en otro. Los **relojes lógicos** permiten expresar parte de ese orden sin asumir una hora global perfectamente sincronizada.

En [consenso y Raft](/posts/consenso-raft-eleccion-lider-terminos) utilizamos terms para distinguir elecciones. No eran horas. Aquí construiremos otro contador, el de **Lamport**, con una finalidad distinta: respetar relaciones causales conocidas por el sistema.

## Happened-before describe caminos de influencia

Podemos establecer orden entre eventos de un mismo proceso. También sabemos que enviar un mensaje precede a recibir ese mismo mensaje. Si a precede a b y b precede a c, a precede a c.

Esas relaciones forman **happened-before**. Si no existe un camino de este tipo en ninguna dirección entre dos eventos, los llamamos concurrentes en ese modelo. No significa necesariamente que sus CPUs ejecutaran la misma instrucción al mismo nanosegundo.

El [trabajo original de Leslie Lamport](https://lamport.azurewebsites.net/pubs/time-clocks.pdf) parte de ese orden parcial. No todos los pares tienen que quedar ordenados por causalidad. Un cambio local en A y otro en B, sin mensajes que los relacionen, pueden ser concurrentes.

El modelo depende de qué eventos y comunicaciones observamos. Si una persona lee una pantalla y llama por teléfono a otra para pedir un cambio, ese canal no aparece automáticamente en los mensajes de nuestra aplicación.

## El contador avanza antes de cada evento representado

Cada proceso mantiene un entero. En un evento local lo incrementa. Al enviar un mensaje, adjunta el contador de ese evento. Al recibir un mensaje con timestamp remoto, toma el mayor entre su contador y el recibido, y suma uno.

$$
L_{recepcion} = \max(L_{local}, L_{mensaje}) + 1
$$

La suma asegura que la recepción tiene un número mayor que el envío. El máximo evita retroceder si el receptor ya iba por delante. No estamos ajustando un reloj en segundos.

Archivo: `packages/distributed-foundations/src/clock.ts`, implementación completa. `integer` comprueba enteros seguros no negativos y lanza error si no se cumple la condición.

```typescript
import { integer } from './validation.ts'

export function logicalClock(initial = 0) {
  integer(initial)
  let counter = initial
  function advance(remote: number) {
    integer(remote)
    const next = Math.max(counter, remote) + 1
    integer(next)
    counter = next
    return counter
  }
  return {
    tick: () => advance(0),
    receive: (timestamp: number) => advance(timestamp),
    value: () => counter,
  }
}
```

No extraemos una jerarquía de clases porque solo hay un estado y dos operaciones. Validamos antes de cambiar `counter`, incluido el resultado de sumar. TypeScript no impide que un `number` sea `NaN` o exceda la precisión entera segura.

## Recibir 1 cuando ya vas por 8 produce 9

Archivo: `tests/clock-routing.test.mjs`. Las dos instancias representan procesos lógicos; no hay sockets.

```javascript
const sender = logicalClock()
const receiver = logicalClock(8)
const sent = sender.tick()
assert.equal(sent, 1)
assert.equal(receiver.receive(sent), 9)
assert.equal(receiver.tick(), 10)
```

El envío obtiene 1. B estaba en 8, así que recibir ese mensaje no lo devuelve a 2: avanza a 9. Su siguiente evento local obtiene 10.

<img src="/assets/visuals/distributed-foundations/DIST-CLOCKS.svg" alt="A envía un mensaje con contador uno; B tiene contador ocho, calcula máximo de ocho y uno más uno al recibir y obtiene nueve; el siguiente evento local obtiene diez." width="428" height="430" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/distributed-foundations/DIST-CLOCKS.svg).

El test también introduce un timestamp inválido y un valor cuyo incremento desbordaría el rango seguro. Ambos se rechazan sin cambiar el contador. Un proceso real tendría que decidir su representación numérica y cómo conserva el estado al reiniciar; aquí solo demostramos la regla local.

## La implicación funciona en una sola dirección

Si a **happened-before** b, el algoritmo asigna $L(a) < L(b)$. Pero ver números distintos y ordenados no demuestra que exista ese camino causal.

La prueba complementaria crea dos relojes desde cero sin pasar mensajes. A genera un evento con 1. B genera dos eventos, con 1 y 2. El evento de A tiene un número menor que el segundo de B, pero no hay comunicación que permita deducir que lo causó.

Por eso es un error usar `timestampA < timestampB` como prueba de que B vio A. El contador respeta las dependencias conocidas; no las reconstruye a partir de una desigualdad.

Los **vector clocks** conservan más información por participante y permiten distinguir ciertos casos de causalidad y concurrencia. Introducen costes de tamaño y gestión de participantes. No los implementamos aquí ni presentamos el contador escalar como una versión equivalente.

## Desempatar produce un orden total, no acuerdo automático

Dos procesos pueden asignar el mismo número a eventos distintos. Si necesitamos ordenar una lista de forma determinista, podemos comparar primero el contador y después un ID estable del proceso. Esa pareja permite desempatar sin contradecir el orden causal representado.

Pero cada réplica podría tener una lista incompleta. Que dos copias apliquen el mismo criterio a los eventos que conocen no garantiza que conozcan los mismos eventos ni sepan cuándo no llegará otro anterior.

Para decidir cuándo aplicar, entregar de forma acordada o confirmar una posición hacen falta reglas de comunicación y coordinación adicionales. Un contador y una función de ordenación no implementan el consenso del post anterior.

Tampoco decide qué cambio debe ganar. Si dos personas editan una dirección a la vez, desempatar por ID puede ser una regla determinista, pero quizá no sea la semántica que necesita el producto. El criterio técnico no sustituye la decisión sobre conflictos.

## Una duración necesita un reloj con otra finalidad

Restar 9 menos 1 en este ejemplo no produce ocho segundos, milisegundos ni saltos de red. Los contadores avanzan según eventos representados, y pueden saltar al recibir un número remoto.

Para medir la duración de una operación local suele usarse un reloj monotónico. Para mostrar una fecha humana usamos hora de calendario. Para correlacionar una petición añadimos IDs y relaciones de trazas.

Son herramientas complementarias. Un trace ID identifica; un reloj de calendario fecha; un contador lógico representa orden bajo sus reglas. Ninguno de esos campos demuestra por sí solo que una escritura está confirmada en una mayoría.

Un esquema de observabilidad puede conservar varios sin llamarlos a todos `timestamp`. Nombrar `occurredAt`, `durationMs`, `logicalCounter` y `traceId` ayuda a no pedirle al dato una garantía que no contiene. Este laboratorio no integra un backend de trazas ni simula clock skew físico.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-clocks/README.md), el [contador completo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/distributed-foundations/src/clock.ts) y los tests que contrastan ambas direcciones de la implicación.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/distributed-foundations test
pnpm --dir packages/distributed-foundations typecheck
```

## Garantías y límites

El modelo incrementa eventos locales, incorpora un contador remoto sin retroceder y rechaza valores inválidos antes de mutar. La prueba observa 1 en envío, 9 en recepción y 10 en el siguiente evento local.

No hay sincronización física, persistencia, transporte, vector clocks, orden de entrega acordado o consenso. Los números no son duraciones y no prueban causalidad en sentido inverso.

## Ejercicio: dibujar primero las flechas

Crea tres procesos lógicos. A envía a B; B realiza un evento local y envía a C. Añade un evento independiente en A. Anota contadores, pero antes marca qué pares tienen un camino de mensajes o eventos locales entre ellos.

Busca dos eventos con números ordenados y sin camino causal. Si solo miras los números, ¿qué afirmación incorrecta podrías hacer? Con esa cautela, pasamos a [CAP y PACELC](/posts/cap-pacelc-particiones-latencia-consistencia): no recibir información también limita lo que podemos garantizar.

## Referencias

- [Leslie Lamport: Time, Clocks, and the Ordering of Events in a Distributed System](https://lamport.azurewebsites.net/pubs/time-clocks.pdf).
- [Microsoft Research: ficha y contexto del trabajo original](https://www.microsoft.com/en-us/research/publication/time-clocks-ordering-events-distributed-system/).

Fuentes consultadas el 21 de octubre de 2026. El código implementa un contador escalar, no todo el algoritmo de exclusión mutua o la sincronización física del paper.
