---
id: DIST-QUORUM
title: 'Quorum: qué garantiza R + W > N y qué no puedes deducir de esa fórmula'
published: 2026-10-21T11:01:00Z
locale: es
translationKey: distributed-quorum-intersection
slug: quorum-interseccion-lecturas-escrituras
draft: true
math: true
status: draft
level: intermedio
prerequisites: [P048]
description: 'Comprueba la intersección de conjuntos de lectura y escritura, sus supuestos y los límites de deducir consistencia o consenso a partir de una mayoría.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos distribuidos: réplicas, orden y particiones'
tags: [sistemas-distribuidos, quorum, replicacion, consistencia, typescript]
---

Escribimos un valor en A y B. Después leemos solo C y recibimos el anterior. Haber confirmado en dos de tres copias no sirve si la lectura no toca ninguna de ellas.

Un **quorum** permite razonar sobre los conjuntos que deben responder a una operación. La parte difícil empieza cuando convertimos una propiedad de esos conjuntos en una promesa sobre los datos.

En [replicación y lecturas obsoletas](/posts/replicacion-consistencia-lecturas-obsoletas) retuvimos un mensaje entre dos copias. Ahora usaremos tres miembros fijos para ver de dónde sale **R + W > N** y por qué no es una implementación completa de consistencia.

## N, W y R cuentan miembros distintos de un mismo conjunto

**N** es el número de réplicas del conjunto considerado. **W** es el número de réplicas distintas que deben confirmar la escritura. **R** es el número de réplicas distintas cuyas respuestas exige una lectura.

No contamos paquetes: recibir dos veces la respuesta de A no convierte a A en dos miembros. Tampoco podemos usar N de una topología y las respuestas de otra sin explicar la transición.

Supongamos N = 3 y membresía fija `{A, B, C}`. Una escritura confirmada por `{A, B}` toca dos miembros. Una lectura de `{B, C}` también toca dos. Ambas se cruzan en B.

El razonamiento no depende de que B sea especial. Cualesquiera dos subconjuntos de tamaño 2 dentro de esos tres miembros comparten al menos uno.

## La desigualdad demuestra una intersección

Llamemos $S_W$ al conjunto de escritura y $S_R$ al de lectura. Como su unión cabe dentro de N miembros:

$$
|S_W \cap S_R| = |S_W| + |S_R| - |S_W \cup S_R| \ge W + R - N
$$

Si **W + R > N**, el lado derecho es mayor que cero. Por tanto, hay al menos un miembro compartido. Si W = 2, R = 1 y N = 3, no tenemos esa garantía: `{A, B}` y `{C}` son disjuntos.

Esto es una propiedad de conjuntos. Todavía no hemos dicho qué almacenó el miembro compartido, cómo identifica una versión ni qué hace con escrituras que se solapan.

<img src="/assets/visuals/distributed-foundations/DIST-QUORUM.svg" alt="Tres réplicas A B C forman una membresía fija; la escritura en A y B y la lectura en B y C comparten B, pero aún hace falta comparar las versiones recibidas." width="300" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/distributed-foundations/DIST-QUORUM.svg).

## Nueve pares de conjuntos comprueban el caso pequeño

Archivo: `packages/distributed-foundations/tests/quorum.test.mjs`. `subsets` enumera combinaciones sin repetir miembros y valida tamaños.

```javascript
const groups = subsets(['A', 'B', 'C'], 2)
assert.deepEqual(groups, [['A', 'B'], ['A', 'C'], ['B', 'C']])
for (const write of groups)
  for (const read of groups) assert.equal(overlaps(write, read), true)
```

Hay tres conjuntos posibles de escritura y tres de lectura: comprobamos nueve pares. Es un test exhaustivo de esa configuración, no de todas las topologías o protocolos posibles.

La prueba complementaria elige `{A, B}` y `{C}` y observa ausencia de intersección. Un ejemplo negativo ayuda a distinguir «elegimos un caso que funcionó» de «el tamaño obliga a cruzarse».

El laboratorio no contacta tres servidores. Son arrays de IDs; la entrega del post anterior es otro modelo. No hay un coordinador de red que ejecute lecturas de quorum.

## Leer varias respuestas no significa votar el valor más frecuente

Imagina que A tiene `1/shipped` y B y C conservan `0/pending`. Una lectura de las tres copias recibe más respuestas con `pending`, pero eso no convierte el valor antiguo en el correcto.

En nuestro modelo de un writer, las versiones crecientes permiten elegir la mayor. Archivo: `tests/quorum.test.mjs`.

```javascript
assert.deepEqual(newest([
  { version: 1, value: 'shipped' },
  { version: 0, value: 'pending' },
  { version: 0, value: 'pending' },
]), { version: 1, value: 'shipped' })
```

La función no conoce cuántas réplicas confirmaron esa versión. Solo selecciona dentro de las respuestas recibidas bajo una premisa: un writer asigna versiones únicas y comparables. Si recibe dos valores diferentes con la misma versión, falla con `conflicting_version`; no elige según el orden del array.

Leer el máximo de una escritura incompleta también puede hacer visible un valor que aún no tenía suficientes confirmaciones. Qué ocurre si después otra lectura no lo ve depende del protocolo. La desigualdad no resuelve ese caso por sí sola.

## Qué supuestos necesita la lectura del último valor confirmado

Para el caso sencillo, suponemos que la escritura terminó antes de empezar la lectura, no hay otra escritura concurrente y las copias que confirmaron conservan su versión. La lectura espera R respuestas del mismo conjunto y puede reconocer la más reciente.

Bajo esos supuestos, la intersección garantiza que toca al menos un miembro que recibió la escritura. Si ese miembro perdió sus datos y siguió respondiendo como si nada, hemos cambiado el modelo de fallo. Si el algoritmo ignora su versión, tampoco basta la intersección.

Para evitar que dos conjuntos de escritura sean disjuntos se usa otra condición: **2W > N**. Que ambos conjuntos compartan un miembro todavía exige reglas sobre cómo ese miembro acepta y ordena cambios. No transforma cualquier código de almacenamiento en un protocolo de consenso.

El [paper de Dynamo](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) describe un diseño con versiones, reparación y mecanismos adicionales. Dynamo de 2007 no es un nombre intercambiable con el producto actual DynamoDB. Conviene leer el protocolo y no extraer una garantía de tres parámetros aislados.

## Una réplica sustituta puede cambiar la premisa

Si A no responde y guardamos una escritura en un nodo D fuera del conjunto original, ya no estamos usando exactamente los conjuntos `{A, B, C}` del cálculo anterior. Esas variantes requieren mecanismos y reglas de reparación propios.

Lo mismo ocurre al cambiar la membresía. Dos mayorías de la configuración antigua y la nueva pueden no cruzarse si las reemplazamos sin un protocolo de transición. Una demostración para un conjunto fijo no cubre automáticamente esa operación.

Por eso no añadimos miembros dinámicos al laboratorio: ocultaría bajo una lista mutable el problema que queremos hacer visible.

## Más respuestas exigidas reducen el margen de fallo

Con tres réplicas y W = 2, no podemos confirmar una escritura si solo una está accesible. Con R = 1 podríamos leer alguna copia accesible, pero no se garantiza que toque la última escritura confirmada.

Son propiedades por operación, no una clasificación moral entre configuraciones. Un historial informativo y una regla que impide vender dos veces una unidad pueden necesitar contratos diferentes.

Esperar respuestas también introduce dependencia de la comunicación y del nodo que completa el conjunto requerido. No hemos medido que W = 2 cueste cierto número de milisegundos ni que duplicar réplicas duplique rendimiento. El modelo comprueba membresía e intersecciones, no capacidad.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-quorum/README.md), las [combinaciones y selección de versiones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/distributed-foundations/src/quorum.ts) y sus tests.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/distributed-foundations test
pnpm --dir packages/distributed-foundations typecheck
```

## Garantías y límites

Los tests comprueban nueve intersecciones con N = 3, R = W = 2; un contraejemplo con R = 1; selección por versión y rechazo de versiones contradictorias. La enumeración limita la membresía a dieciséis IDs para no generar combinaciones sin control.

No hay lecturas remotas, escrituras concurrentes, read repair, persistencia, membresía dinámica o prueba de linearizability. **Quorum no equivale a consenso**: es una pieza que un protocolo puede utilizar.

## Ejercicio: cambiar los conjuntos, no solo la fórmula

Enumera N = 5 con W = 3 y R = 3. Comprueba cada par. Repite con R = 2 y encuentra un par disjunto. Después introduce D y E como sustitutos de miembros de otra configuración y anota exactamente qué conjunto estás contando.

La siguiente entrega utiliza mayorías para estudiar [elecciones y consenso](/posts/consenso-raft-eleccion-lider-terminos), sin confundir el voto con el commit de un log.

## Referencias

- [DeCandia y colaboradores: Dynamo, secciones 4.4 y 4.5](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf).
- [Ongaro y Ousterhout: Raft, mayorías y cambios de configuración](https://raft.github.io/raft.pdf).

Fuentes consultadas el 21 de octubre de 2026. La evidencia ejecutada es combinatoria y local.
