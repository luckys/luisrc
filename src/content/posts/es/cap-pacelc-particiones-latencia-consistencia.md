---
id: DIST-CAP
title: 'CAP y PACELC: describir qué deja de garantizar una operación cuando falla la red'
published: 2026-10-21T11:04:00Z
locale: es
translationKey: distributed-cap-pacelc-tradeoffs
slug: cap-pacelc-particiones-latencia-consistencia
draft: true
status: draft
level: intermedio
prerequisites: [DIST-CLOCKS, P048]
description: 'Distingue la disponibilidad formal de CAP de un SLO, razona sobre una réplica aislada y usa PACELC para hablar del coste de coordinar sin etiquetar productos enteros.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos distribuidos: réplicas, orden y particiones'
tags: [sistemas-distribuidos, cap, pacelc, consistencia, disponibilidad]
---

Una réplica aislada conserva `pending`. En el otro lado de la red, una escritura ya confirmó `shipped`. Si la réplica aislada debe responder sin comunicarse, no puede averiguar ese cambio por mucho que esperemos que «el sistema sea consistente y esté disponible».

**CAP** ayuda a precisar esa incompatibilidad. No es un menú para elegir dos letras ni una razón para aceptar cualquier pérdida de datos.

Volvemos al [registro replicado](/posts/replicacion-consistencia-lecturas-obsoletas). Los [relojes lógicos](/posts/relojes-logicos-lamport-causalidad) tampoco aportan el mensaje que falta: un contador local no revela una escritura remota que nunca recibimos.

## La C de CAP no es la C de ACID

En la formulación de [Gilbert y Lynch](https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.pdf), la consistencia es **atomic consistency**, también llamada **linearizability**. Las operaciones deben poder ordenarse como si fueran instantáneas, respetando las que terminan antes de que otras empiecen.

La **availability** formal exige que cada petición recibida por un nodo que no falla termine con una respuesta válida según la especificación del objeto. No fija un límite concreto de latencia. No es el porcentaje de éxito mensual de nuestro SLO.

Una **partition** impide la comunicación entre partes del sistema. Puede afectar unos enlaces y no otros. No hace falta que todos los servidores estén caídos: varios pueden seguir funcionando y atendiendo clientes sin poder intercambiar los mensajes necesarios.

Devolver un error no equivale a completar satisfactoriamente la lectura del registro. De lo contrario, responder siempre «no sé» resolvería falsamente la incompatibilidad. Tampoco hablamos de la consistencia de reglas de negocio de ACID: son usos diferentes de la misma palabra.

## Dos historias indistinguibles para B exigen respuestas diferentes

Imagina estas dos ejecuciones con B aislada:

1. En A no se ha escrito nada. El valor sigue siendo `pending`.
2. A confirmó `shipped` antes de que empiece la lectura en B.

En ambas, B solo conoce su copia `pending` y no recibe mensajes de A. Su información local es igual. Sin embargo, si queremos una lectura linearizable, la segunda historia no permite responder `pending`, mientras que la primera no permite inventar `shipped`.

La dificultad no es que el algoritmo tarde en encontrar un dato escondido. En ese momento B no dispone de información que distinga los casos. Esta explicación ilustra el argumento; la prueba formal trata el modelo y sus ejecuciones con mayor precisión.

<img src="/assets/visuals/distributed-foundations/DIST-CAP.svg" alt="A confirma shipped pero no comunica con B; B solo conserva pending y debe elegir entre responder ese valor sin linearizability o no confirmar una lectura actual, reduciendo disponibilidad de la operación." width="386" height="782" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/distributed-foundations/DIST-CAP.svg).

## El laboratorio contrasta una respuesta antigua con un rechazo explícito

Archivo: `packages/distributed-foundations/tests/replication.test.mjs`, cuerpo del caso de frescura.

```javascript
const pair = replicaPair()
const receipt = pair.write('shipped')
assert.throws(() => pair.readFollower(receipt.version), /not_caught_up/)
assert.deepEqual(pair.readFollower(), { version: 0, value: 'pending' })
pair.deliver(0)
assert.deepEqual(pair.readFollower(receipt.version), receipt)
```

Sin entregar el mensaje, la lectura sin condición responde el valor antiguo. La lectura con mínimo 1 se rechaza. Una devuelve datos con menor frescura; la otra evita confirmar una frescura que no puede cumplir.

El token le da al lector una información adicional que en el argumento anterior B no tenía. Por eso **este test no demuestra CAP** ni implementa un sistema CP: solo permite observar dos contratos de lectura ante el mismo retraso controlado.

Retener mensajes indefinidamente representa falta de comunicación en el modelo; entregarlos simula que se recupera. No hay una red particionada real, detección de fallos o timeouts de transporte.

## «Elegir dos de tres» oculta cuándo aparece el conflicto

Cuando las partes no pueden comunicarse, no podemos garantizar a la vez esas definiciones de consistencia y disponibilidad para todas las ejecuciones permitidas. No podemos desactivar la posibilidad de que la red falle marcando una casilla de arquitectura.

Eso no significa que durante toda operación normal haya que renunciar a una propiedad. Tampoco significa que todo endpoint de una aplicación deba tener la misma política. Un detalle informativo puede tolerar antigüedad; una reserva de una unidad requiere describir qué autoridad puede confirmarla.

Decir «este producto es AP» sin mencionar operaciones, configuración y fallo observado suele esconder la parte importante. ¿Qué lectura puede ser antigua? ¿Qué escritura se rechaza? ¿Cómo se recuperan conflictos? ¿Qué garantías quedan durante el problema?

La misma aplicación puede servir contenido estático mientras no acepta nuevas reservas. Para el usuario no es un único interruptor de disponibilidad. Conviene declarar el modo degradado en términos que la interfaz y los tests puedan comprobar.

## PACELC añade la pregunta que sigue existiendo sin partición

Aunque todos los enlaces funcionen, esperar confirmaciones entre nodos cuesta comunicación. Una respuesta local puede evitar esa espera, pero quizá use una copia atrasada. El [trabajo de Daniel Abadi sobre PACELC](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf) incorpora ese trade-off al razonamiento.

Su lectura es: **si hay partición (P), disponibilidad (A) frente a consistencia (C); en otro caso (E, else), latencia (L) frente a consistencia (C)**. Es un marco para discutir decisiones, no una calculadora universal ni otra prueba de imposibilidad idéntica a CAP.

En nuestro registro, responder desde B sin esperar entrega evita esa dependencia del camino remoto, pero permite una versión anterior. Exigir que B alcance cierto punto introduce espera o rechazo. El fixture no mide latencia: `deliver` es un paso lógico, no una duración.

Tampoco afirmamos que cualquier mejora de consistencia tenga siempre un coste fijo ni que un producto solo admita una combinación. Topología, carga, semántica y opciones del sistema importan. Las optimizaciones cambian el coste concreto; no hacen que un mensaje ausente se convierta en conocimiento local.

## Un contrato operativo necesita más que las siglas

Para una consulta de seguimiento podríamos acordar que el listado admita datos antiguos, pero el detalle posterior a una actualización exija al menos la posición devuelta por esa escritura. Si no puede alcanzarse dentro del deadline, mostraríamos «actualización pendiente», no un falso rollback.

Para una reserva necesitaríamos especificar quién puede confirmarla cuando un grupo pierde comunicación. Seguir mostrando información no autoriza a ambos lados a vender independientemente la misma unidad.

La recuperación merece su propio diseño: qué cambia al reconectar, cómo se reparan copias y qué decisiones necesitan reconciliación. CAP no proporciona esa política ni convierte cualquier dato en fusionable.

Un test operativo debería comprobar el valor devuelto, los efectos confirmados y el estado tras recuperar comunicación. Medir solo HTTP 200 confundiría «respondió algo» con «cumplió el contrato».

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-cap/README.md), el [modelo de registro](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/distributed-foundations/src/replication.ts) y las pruebas de divergencia y frescura.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/distributed-foundations test
pnpm --dir packages/distributed-foundations typecheck
```

## Garantías y límites

Observamos una copia antigua y un rechazo condicionado por versión mínima, seguidos de éxito al entregar. No probamos un teorema, un SLO, un clúster CP/AP, recuperación de conflictos o diferencias de latencia entre regiones.

El resultado útil es un vocabulario preciso: qué operación, qué partición, qué respuesta y qué propiedad deja de garantizarse. Ese detalle permite elegir y probar un comportamiento sin apoyarse en una etiqueta de marketing.

## Ejercicio: escribir el modo degradado

Define el contrato de un listado informativo y el de una reserva con stock limitado. Para cada uno escribe qué puede responder un nodo aislado, qué no debe confirmar y cómo informaría al cliente. Separa datos antiguos, error y operación pendiente.

Después pregunta dónde vive cada dato. En [sharding y rebalanceo](/posts/sharding-claves-buckets-rebalanceo) pasamos de copiar registros a repartirlos, una decisión distinta que también cambia los fallos que puede observar el cliente.

## Referencias

- [Gilbert y Lynch: Brewer’s Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services](https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.pdf).
- [Daniel Abadi: Consistency Tradeoffs in Modern Distributed Database System Design](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf).

Fuentes consultadas el 21 de octubre de 2026. Las trazas ejecutadas son lógicas, no benchmarks ni una simulación completa del modelo formal.
