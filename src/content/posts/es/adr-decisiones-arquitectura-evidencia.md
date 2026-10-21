---
id: ARCH-ADR
title: 'ADR: explicar una decisión de arquitectura sin fingir que era inevitable'
published: 2026-10-20T09:09:00Z
locale: es
translationKey: architecture-decisions-adr-evidence
slug: adr-decisiones-arquitectura-evidencia
draft: true
status: draft
level: intermedio
prerequisites: [P047, DB-STORAGE]
description: 'Escribe una ADR con contexto, alternativas, costes y condiciones de revisión. Compara PostgreSQL y DynamoDB sin inventar benchmarks ni descartar capacidades que sí existen.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [arquitectura, adr, rfc, postgresql, dynamodb]
---

«Elegimos PostgreSQL porque es más robusto» no ayuda a quien tenga que mantener el sistema dentro de un año. No cuenta qué necesitábamos, qué alternativas evaluamos ni qué coste aceptamos. Tampoco permite saber si la elección sigue teniendo sentido cuando cambien los requisitos.

Una **Architecture Decision Record**, o **ADR**, conserva ese razonamiento. Su utilidad no está en certificar que encontramos la mejor tecnología, sino en permitir revisar la decisión sin tener que reconstruir la conversación original.

Después de [dibujar el diseño con C4](/posts/c4-contexto-contenedores-componentes), documentaremos una propuesta de almacenamiento para las solicitudes de reembolso. Veremos cómo separar restricciones, supuestos y evidencia, y cuándo una **RFC** ayuda a discutir antes de decidir.

## Una ADR registra una decisión significativa, no cada detalle del código

Un cambio merece una ADR cuando afecta a compromisos que otras personas tendrán que entender: persistencia, contratos entre módulos, dependencia de un proveedor o condiciones de recuperación, por ejemplo.

No necesitamos una para cada función auxiliar. Registrar decisiones triviales con el mismo peso que las importantes vuelve difícil encontrar lo que sí condiciona el sistema.

[Michael Nygard propuso un formato breve](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) con contexto, decisión, estado y consecuencias. Usaremos esa base y añadiremos alternativas y evidencia porque ayudan a revisar este caso. No son un schema universal que haya que rellenar aunque una sección no aporte nada.

## El contexto debe permitir entender por qué esta elección encaja aquí

Nuestro diseño objetivo necesita confirmar una reserva y un evento juntos. Soporte quiere consultar por pago, solicitud y fecha. Además, suponemos un equipo con experiencia SQL y capacidad para operar PostgreSQL.

Las dos primeras condiciones describen necesidades del escenario. La tercera es un **supuesto**, no una propiedad de la base de datos ni una entrevista que hayamos realizado. Si otro equipo opera DynamoDB y conoce accesos estables por clave, parte del razonamiento podría cambiar.

Archivo: `packages/domain-design/docs/adr/0001-refund-storage.md`, extracto.

```markdown
## Contexto

El diseño objetivo necesita confirmar la reserva y el evento en una misma
transacción. Soporte necesita consultar por pago, solicitud y fecha sin depender
exclusivamente de una clave de acceso. El equipo del escenario conoce SQL y puede
operar PostgreSQL. Son supuestos del ejercicio, no una entrevista a un equipo real.

El laboratorio solo ejecuta un fake en memoria y comprueba reglas, conflictos de
revisión y fallos previos al commit. No ejecuta PostgreSQL ni DynamoDB.
```

La última parte impide usar los tests del modelo como una comparación de motores. Que esas pruebas pasen no permite afirmar que PostgreSQL responde antes, cuesta menos o se recupera mejor que DynamoDB en esta aplicación.

Un requisito de **carga** también necesitaría unidades, distribución y alcance. «Muchas peticiones» no permite dimensionar nada. Si añadimos cifras hipotéticas para preparar un ensayo, deben permanecer identificadas como hipótesis hasta medirlas.

## Comparar alternativas exige describirlas de forma justa

**PostgreSQL** ofrece transacciones locales, relaciones y constraints, además de consultas SQL. Para nuestro objetivo, la combinación de integridad y consultas operativas cambiantes justifica evaluarlo. También obliga a diseñar índices, gestionar migraciones y ensayar backups y restauración.

**DynamoDB** no se descarta diciendo que «NoSQL no tiene transacciones». Esa afirmación es incorrecta: su [documentación de transacciones](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) describe operaciones de lectura y escritura con comportamiento todo o nada, bajo sus condiciones y límites. Habría que diseñar claves e índices a partir de los accesos y comprobar el coste y las garantías que necesita el caso.

Un **Map en memoria** sigue siendo una alternativa válida para enseñar reglas en un proceso. No lo es como sustitución demostrada de persistencia y recuperación del servicio objetivo. Incluirlo aclara qué resolvemos hoy y qué todavía no.

No asignamos puntuaciones como «PostgreSQL 9, DynamoDB 7». Sin un método y una necesidad que den significado a esos números, la tabla solo convertiría preferencias en una apariencia de precisión. Para profundizar en motores, conviene volver a [elegir almacenamiento por accesos y garantías](/posts/elegir-sql-nosql-motores-especializados).

## La decisión debe aceptar costes, no solo anunciar beneficios

Proponemos PostgreSQL y un **outbox** en la misma base para el diseño objetivo. No porque sea la única opción capaz de guardar un pago, sino por los accesos y el conocimiento operativo asumidos en este escenario.

Archivo: `packages/domain-design/docs/adr/0001-refund-storage.md`, extracto.

```markdown
## Decisión propuesta

Proponemos PostgreSQL para el servicio objetivo y un outbox en la misma base.
El motivo es la combinación de consultas operativas cambiantes, integridad local
y experiencia SQL asumida, no que otro motor sea incapaz de guardar pagos.

## Consecuencias

Hay que probar el adaptador y el relay, definir retención e idempotencia y ensayar
restauración. Añadir índices aumenta el coste de escritura. El esquema y las
migraciones pasan a formar parte del contrato operativo. La elección no resuelve
por sí sola una respuesta perdida del proveedor ni garantiza entrega exactly once.
```

La palabra **propuesta** importa. No hay una aprobación de un equipo real ni un adaptador SQL de este nuevo laboratorio. Marcarla como aceptada solo porque el texto está escrito confundiría documentación con evidencia.

<img src="/assets/visuals/domain-design/ARCH-ADR.svg" alt="Un requisito y sus supuestos conducen a comparar alternativas; la propuesta registra consecuencias y pruebas pendientes; nueva evidencia puede confirmar la decisión o abrir otra ADR sin borrar la anterior." width="277" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recorrido de la decisión](/assets/visuals/domain-design/ARCH-ADR.svg).

## La evidencia pendiente debe poder convertirse en una comprobación

Antes de aceptar la persistencia propuesta hay que confirmar reserva y evento con una transacción real, forzar dos escrituras sobre la misma revisión y comprobar rollback. También habría que ensayar qué ocurre al reiniciar y restaurar datos.

Cada comprobación responde una pregunta distinta. Una prueba de conflicto no prueba una restauración. Una restauración no prueba que el proveedor tolere una solicitud repetida. Si la ADR mezcla todos esos resultados bajo «funciona», deja de ser útil para decidir qué falta.

La revisión también debe registrar quién mantiene los índices y el relay, qué consultas espera soporte y qué riesgo queda abierto. El mecanismo no sustituye el **ownership**: alguien tiene que responder cuando cambien los accesos o falle una publicación.

En el laboratorio, las pruebas de documentación verifican secciones, referencias e indicación de estado. No evalúan si la decisión es buena. Esa valoración exige discutir el contexto y obtener la evidencia que la propia ADR declara pendiente.

## Una RFC abre la conversación; una ADR conserva el resultado

Utilizamos **RFC**, Request for Comments, para una propuesta todavía abierta a revisión. En nuestro ejercicio pregunta si existen motivos verificables para preferir DynamoDB o mantener PostgreSQL con los accesos descritos.

No hay un proceso de RFC único para todos los equipos. Aquí sería suficiente pedir revisión a backend, operación y a quien conozca las consultas de soporte. El archivo del laboratorio recoge esos roles de forma hipotética, sin inventar revisiones o aprobaciones.

La RFC enumera objeciones que deben responderse: qué consultas necesitamos, qué confirma una escritura, cómo se recupera un resultado incierto y qué sucede si el relay repite trabajo. Una vez discutidas, la ADR puede conservar la decisión y enlazar la conversación.

Si se cambia más adelante, lo útil es crear una nueva ADR y marcar la anterior como **superseded**, enlazando su sustitución. No borrar el razonamiento pasado. Así puede entenderse por qué una decisión razonable dejó de encajar.

## Cuándo reabrir la decisión sin diseñar para un futuro imaginario

Un requisito multi-region, accesos que se estabilizan alrededor de claves o una limitación operativa medida pueden justificar otra evaluación. Ninguno de esos hechos elige automáticamente un motor.

«Algún día creceremos» no es una condición de revisión comprobable. «El ensayo representativo incumple el objetivo acordado después de revisar el plan y los índices» permite una discusión mucho más concreta. Hay que definir el ensayo y el objetivo antes de utilizarlo como argumento.

Frente a una ADR, un comentario en código puede bastar para explicar una decisión local. Una conversación informal puede ser suficiente para explorar opciones. La ADR añade valor cuando necesitamos conservar el compromiso y sus consecuencias para otras personas o para el futuro.

## Documentos y laboratorio reproducibles

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/arch-adr/README.md), la [ADR completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/docs/adr/0001-refund-storage.md) y la [RFC de revisión](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/docs/rfc/refund-storage-review.md). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
```

## Garantías y límites

La ADR hace explícitos el estado de la propuesta, los supuestos, las alternativas y las consecuencias. No certifica rendimiento, coste, seguridad o adecuación para otro equipo. El diseño sigue pendiente de integración SQL y no hay una comparación ejecutada contra DynamoDB.

Tampoco elimina desacuerdos. Permite localizarlos: quizá la consulta cambiante no sea un requisito real o quizá el equipo no pueda operar la base elegida. Encontrar eso durante la revisión es más útil que una aprobación basada en nombres de tecnologías.

## Ejercicio: una objeción que cambie el contexto

Supón que soporte deja de necesitar consultas variables y solo consulta por `paymentId`. Añade esa información a una RFC, sin cambiar retrospectivamente la ADR. Explica qué alternativas volverías a evaluar y qué prueba falta antes de decidir.

El criterio de aceptación no es elegir DynamoDB. Es mostrar qué parte del razonamiento ha cambiado, qué permanece y qué evidencia necesitas. Así cerramos este bloque de la serie: un modelo expresa reglas; sus diagramas comunican fronteras; una decisión documentada conserva por qué esas fronteras y herramientas encajan, de momento.

## Referencias

- [Michael Nygard: Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
- [AWS: funcionamiento de las transacciones de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).
- [PostgreSQL 18: constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

Fuentes consultadas el 20 de octubre de 2026. ADR y RFC son documentos educativos; no se atribuyen aprobaciones, mediciones o decisiones a un equipo real.
