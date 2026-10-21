---
id: DIST-CONSENSUS
title: 'Consenso y Raft: elegir un líder no basta para confirmar un cambio'
published: 2026-10-21T11:02:00Z
locale: es
translationKey: distributed-consensus-raft-voting
slug: consenso-raft-eleccion-lider-terminos
draft: true
math: true
status: draft
level: intermedio
prerequisites: [DIST-QUORUM]
description: 'Entiende safety, liveness, términos y reglas de voto de Raft con una exploración de 720 órdenes, sin presentar una elección como un protocolo de consenso completo.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos distribuidos: réplicas, orden y particiones'
tags: [sistemas-distribuidos, consenso, raft, quorum, typescript, testing]
---

Dos servidores dejan de recibir mensajes entre sí y ambos sospechan que el otro ha caído. Si cada uno se declara líder y confirma cambios incompatibles, reconectar la red no decide por sí solo cuál de esas confirmaciones respetar.

El problema no se resuelve eligiendo «el que respondió primero». Necesitamos reglas que impidan confirmar decisiones incompatibles y condiciones bajo las que el grupo pueda seguir avanzando.

Después del [quorum](/posts/quorum-interseccion-lecturas-escrituras), estudiaremos una pieza de **Raft**: las reglas para conceder un voto. No vamos a escribir un Raft casero para producción. La finalidad es entender por qué la elección utiliza estado, mayorías y términos, y qué trabajo queda después de elegir.

## Consenso no significa que todas las copias estén siempre actualizadas

Un protocolo de **consenso** permite acordar decisiones entre nodos bajo un modelo de fallos. En un sistema de estado replicado, esas decisiones pueden formar un log ordenado de comandos que cada réplica aplica a su estado.

La idea de **safety** es que no ocurra algo prohibido: por ejemplo, que dos comandos distintos queden comprometidos para la misma posición del log. **Liveness** trata del progreso: que una propuesta pueda acabar resolviéndose cuando se cumplen las condiciones del protocolo.

Una réplica puede estar atrasada sin que el grupo haya perdido safety. Que todos tengan el último dato en todo instante no es el requisito. Tampoco basta con conservar safety quedándose bloqueados para siempre.

El [paper de Raft](https://raft.github.io/raft.pdf) separa elección, replicación del log y seguridad. Su modelo contempla fallos como nodos detenidos y mensajes perdidos o retrasados, no servidores maliciosos que inventan votos. **Consenso bizantino** es otro problema.

## Un timeout permite sospechar; no demuestra una caída

Si no recibimos heartbeats, no sabemos si el líder murió, está ocupado o sigue operativo al otro lado de una partición. El timeout puede iniciar una elección, pero no aporta una prueba de muerte.

Raft organiza la actividad en **terms**, identificados por números crecientes. Un candidato intenta reunir votos para un term y necesita mayoría. Un nodo recuerda el term actual y a qué candidato votó en él.

En una configuración fija de tres miembros, la mayoría son dos. Dos mayorías se cruzan. Si cada miembro concede como máximo un voto por term, dos candidatos no pueden reunir a la vez mayorías distintas de ese mismo term.

Esa explicación usa la intersección que ya comprobamos, más una regla de comportamiento. Sin la regla de un voto, contar mayorías no impide nada.

<img src="/assets/visuals/distributed-foundations/DIST-CONSENSUS.svg" alt="X recibe votos de A y B en el term uno; reunir mayoría permite elegir al líder de ese term, pero todavía faltan replicación del log, reglas de commit y aplicación del comando." width="313" height="708" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/distributed-foundations/DIST-CONSENSUS.svg).

## El votante rechaza términos antiguos y conserva su decisión

Archivo: `packages/distributed-foundations/src/voting.ts`, extracto del método `vote`. El archivo completo valida primero la solicitud y mantiene un snapshot inmutable.

```typescript
if (request.term < state.term) return false
if (request.term > state.term)
  state = Object.freeze({ ...state, term: request.term, votedFor: null })
const upToDate = request.logTerm > state.logTerm ||
  (request.logTerm === state.logTerm && request.logIndex >= state.logIndex)
if (!upToDate || (state.votedFor !== null && state.votedFor !== request.candidate)) return false
state = Object.freeze({ ...state, votedFor: request.candidate })
return true
```

Una solicitud antigua no obtiene voto. Un term superior actualiza el estado y libera el voto del term anterior, incluso si después rechazamos al candidato porque su log va por detrás.

Repetir la solicitud del mismo candidato puede devolver `true`, pero representa el mismo voto. El candidato debe contar **votantes distintos**, no respuestas recibidas. El test de los 720 órdenes envía una solicitud por pareja votante/candidato, sin duplicar esa contabilidad.

También comparamos el último term del log y, si empata, su índice. Un log con cien entradas de un term antiguo no es automáticamente más actualizado que otro más corto con un term posterior. El test contrasta precisamente esa diferencia.

Es una regla de selección, no una prueba aislada de que todo log elegido contiene lo necesario. La seguridad completa depende del resto de las reglas de Raft.

## Reiniciar sin recordar el voto rompe el razonamiento

Si B vota a X, se reinicia y olvida ese voto, puede votar a Y en el mismo term. Las mayorías se siguen cruzando, pero el miembro compartido ya no respeta la condición usada para razonar.

Archivo: `tests/voting.test.mjs`.

```javascript
const node = voter()
node.vote(request('X'))
assert.equal(voter(node.snapshot()).vote(request('Y')), false)
assert.equal(voter().vote(request('Y')), true)
```

Restaurar el snapshot conserva la negativa. Crear un votante vacío permite el segundo voto. El contraste muestra por qué term y voto deben persistirse antes de responder en un protocolo real.

**El laboratorio no persiste ese estado en disco.** Pasa un objeto a otra instancia para simular conservación u olvido. No demuestra escrituras atómicas, `fsync`, recuperación tras crash o resistencia a corrupción.

## Explorar 720 órdenes comprueba una propiedad pequeña y precisa

Tenemos tres votantes, A, B y C; dos candidatos, X e Y; y un único term. Cada candidato pide voto a cada miembro: seis solicitudes distintas. Sus órdenes posibles son $6! = 720$.

El test genera todos esos órdenes. Para cada uno crea votantes nuevos, procesa las solicitudes y comprueba que como máximo un candidato reúne dos votos. El resultado son 720 schedules comprobados, no 720 clústeres arrancados.

X e Y son etiquetas de candidaturas para probar la regla local, no dos réplicas añadidas a la membresía de tres. El harness no modela qué miembro inicia cada candidatura ni el paso de votarse a sí mismo; por eso enumera órdenes de solicitudes, no todas las ejecuciones de una elección Raft real.

Puede haber un reparto de votos y ningún ganador. Safety de la elección no garantiza progreso inmediato. Un protocolo completo utiliza nuevas elecciones y mecanismos temporales para intentar resolverlo bajo condiciones de comunicación apropiadas.

El test tampoco cubre todos los fallos posibles. No varía membresías, logs, terms, pérdidas o reinicios dentro de cada schedule. Otros casos unitarios prueban algunas de esas reglas por separado; eso no equivale a una verificación formal de Raft.

## El líder no puede confirmar cualquier cosa por haber ganado

Elegido un líder, todavía hace falta replicar entradas, comprobar que los logs encajan y decidir qué posiciones están **committed**. Raft incluye restricciones específicas para comprometer entradas, incluidas las de terms anteriores.

Después cada réplica aplica las entradas comprometidas en orden. Un líder antiguo aislado no puede asumir que mantiene autoridad solo porque antes la tuvo. El protocolo debe impedir que confirme cambios sin cumplir sus reglas.

Las lecturas tampoco se vuelven seguras por llamarse «read from leader». Hace falta conocer la garantía y cómo verifica autoridad el sistema. La [especificación de garantías de etcd](https://etcd.io/docs/v3.6/learning/api_guarantees/) distingue sus lecturas linearizables de las opciones que pueden devolver datos antiguos.

Por eso este paquete exporta `voter`, no `raftCluster`. No implementa `AppendEntries`, commit index, state machine, reconfiguración, snapshots del log o un API de lectura distribuido.

## Cuándo usar una implementación existente

Si necesitamos un registro replicado o coordinación fiable, normalmente elegimos un sistema mantenido que ofrezca la garantía concreta. Después verificamos topología, durabilidad, configuración, operación y límites de su API.

Usar consenso para metadatos críticos no obliga a hacer pasar todos los datos de una aplicación por el mismo grupo. La granularidad de la coordinación también es una decisión de diseño.

No hemos comparado rendimiento de Raft y Paxos ni medido elección o recuperación. La elección del algoritmo de producción no sale de este test de seis mensajes.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-consensus/README.md), el [votante](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/distributed-foundations/src/voting.ts) y el generador de schedules en sus tests.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/distributed-foundations test
pnpm --dir packages/distributed-foundations typecheck
```

## Garantías y límites

Comprobamos una mayoría como máximo por term en el caso enumerado, rechazo de logs atrasados, términos antiguos, restauración simulada y validación antes de cambiar estado. Un test adicional detectó que aceptábamos un voto imposible en el term inicial 0; se corrigió antes de escribir el extracto.

No hay clúster, almacenamiento durable, elección autónoma, temporizadores, replicación del log o protocolo de consenso completo. El fixture ayuda a leer una regla de Raft; no sustituye Raft.

## Ejercicio: localizar qué premisa has roto

Haz que un votante olvide su estado entre solicitudes. Busca un orden en que X obtenga dos votos y después Y también. Explica por qué no falla la propiedad de intersección: falla la conservación del voto.

La siguiente entrega trata otra fuente de confusión: [ordenar eventos con relojes lógicos](/posts/relojes-logicos-lamport-causalidad) no significa conocer su hora física ni alcanzar consenso.

## Referencias

- [Ongaro y Ousterhout: In Search of an Understandable Consensus Algorithm, secciones 5 y 6](https://raft.github.io/raft.pdf).
- [etcd 3.6: garantías del API](https://etcd.io/docs/v3.6/learning/api_guarantees/).

Fuentes consultadas el 21 de octubre de 2026. La exploración es finita y local, sin afirmaciones de rendimiento o tolerancia real a crashes.
