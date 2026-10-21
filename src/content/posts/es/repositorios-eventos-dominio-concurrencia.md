---
id: DOMAIN-REPOSITORIES
title: 'Repositorios: cargar y confirmar un agregado sin perder decisiones'
published: 2026-10-20T09:06:00Z
locale: es
translationKey: domain-repositories-events-concurrency
slug: repositorios-eventos-dominio-concurrencia
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-AGGREGATES, DOMAIN-SERVICES, DB-CONCURRENCY]
description: 'Define un repository con semántica de lectura y confirmación por revisión. Comprueba conflictos y fallos con un fake sin confundir su interfaz con garantías SQL.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, repository, concurrencia, typescript]
---

Dos tareas leen un pago con 100 euros disponibles. Una decide reservar 70 y otra 40. Cada copia del agregado acepta su operación, porque ninguna sabe que la otra está tomando una decisión sobre el mismo estado.

Si el almacenamiento se limita a guardar «la última copia que llegue», podemos perder una reserva. Si además enviamos ambos reembolsos antes de confirmar, ya habremos producido dos efectos que el estado final ni siquiera representa correctamente.

Venimos de [proteger la regla dentro del agregado](/posts/value-objects-agregados-invariantes). Ahora coordinaremos la confirmación y veremos qué debe prometer un **repository** para que el caso de uso pueda confiar en él. Los [domain events tienen su propia entrega](/posts/domain-events-hechos-confirmacion); aquí son parte del contrato que debe conservarse junto al estado.

## El agregado decide; el caso de uso coordina

La regla «no reservar más de lo capturado» pertenece a `Payment`. Saber cómo cargarlo y guardar su decisión pertenece al caso de uso. Este también necesitaría coordinar autorización y una transacción real si formaran parte del alcance.

Por eso no añadimos `payment.save()` ni un cliente SQL al modelo. La misma regla se puede ejecutar sin HTTP, sin una DB y sin credenciales de un proveedor.

Nuestro **repository** ofrece acceso al agregado con un contrato específico. No es un `GenericRepository<T>` con cualquier consulta posible ni una interfaz obligatoria por tabla. Para este flujo necesita dos operaciones: cargar un pago con su revisión y confirmar una decisión si esa revisión sigue vigente.

Archivo: `packages/domain-design/src/application.ts`.

```typescript
export type StoredPayment = Readonly<{ payment: Payment; revision: number }>
export interface Payments {
  load(id: string): Promise<StoredPayment>
  commit(expectedRevision: number, decision: RefundDecision): Promise<void>
}

export async function requestRefund(
  repository: Payments,
  paymentId: string,
  refundId: string,
  amount: Money,
): Promise<RefundRequested> {
  const { payment, revision } = await repository.load(paymentId)
  const decision = payment.requestRefund(refundId, amount)
  await repository.commit(revision, decision)
  return decision.event
}
```

El archivo importa los tipos y clases de `domain.ts`; el enlace al laboratorio incluye ese contexto completo. El caso de uso espera a que termine `commit` antes de devolver el evento. Si el almacenamiento falla, no comunica un éxito.

La firma no describe todo el contrato. `commit` debe comprobar la revisión y guardar estado más evento como una sola confirmación. Dos adaptadores con esos mismos métodos no son sustituibles si uno publica éxito antes de escribir o guarda el evento por separado.

## Una revisión detecta que la decisión se tomó sobre datos antiguos

Al cargar `p1`, ambas tareas reciben revisión 0. La primera confirma y el repositorio pasa a revisión 1. La segunda sigue presentando 0: su decisión se tomó sobre una versión que ya no es la actual.

Este es **optimistic concurrency control**. No significa «probablemente no habrá carreras». Significa que aceptamos leer sin bloquear y verificamos al confirmar que no cambió la condición necesaria para nuestra decisión.

<img src="/assets/visuals/domain-design/DOMAIN-REPOSITORIES.svg" alt="A y B leen revisión cero; A confirma y avanza a uno; B no puede confirmar cero y debe releer para volver a evaluar la regla antes de cualquier nuevo intento." width="236" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar la secuencia](/assets/visuals/domain-design/DOMAIN-REPOSITORIES.svg).

Archivo: `packages/domain-design/src/application.ts`, parte de `InMemoryPayments.commit`.

```typescript
if (expectedRevision !== this.#stored.revision) throw new Error('revision conflict')
if (
  decision.next.id !== this.#stored.payment.id ||
  decision.event.paymentId !== decision.next.id
)
  throw new Error('payment identity mismatch')
this.#stored = Object.freeze({ payment: decision.next, revision: expectedRevision + 1 })
this.#events.push(decision.event)
```

En este fake la comprobación, el reemplazo y la incorporación del evento ocurren síncronamente, sin un `await` entre ellos. Eso permite modelar una confirmación indivisible respecto de las otras tareas del mismo proceso.

No es una implementación transaccional para producción. Un `Map` y un array se pierden al reiniciar; no coordinan varios procesos. Tampoco son una frontera de seguridad contra código que fabrique una decisión: la interfaz se utiliza entre componentes internos de confianza.

Un adaptador PostgreSQL necesitaría comprobar la revisión en la escritura y guardar el evento en la misma transacción, además de detectar que la actualización no afectó ninguna fila. No lo implementamos aquí: para las garantías SQL están [control de concurrencia](/posts/concurrencia-bloqueos-postgresql) y [Transactional Outbox](/posts/transactional-outbox-inbox-eventos), con sus propios laboratorios.

## Un conflicto técnico puede convertirse en un rechazo de negocio

La segunda tarea no debe cambiar el número de revisión y volver a guardar la decisión antigua. Debe cargar el estado nuevo y **volver a decidir**.

Con 70 euros ya reservados, pedir 40 excede los 30 disponibles. El resultado deja de ser `revision conflict` y pasa a ser `refund limit`. Con solicitudes de 20 y 30, en cambio, la segunda puede aceptarse después de releer y termina habiendo 50 reservados.

El visor permite recorrer ambas trazas. No ejecuta pagos o una DB desde tu navegador: reproduce estados generados al ejecutar el laboratorio TypeScript.

<iframe src="/assets/interactive/domain-design/explorer.html" title="Traza de dos solicitudes y relectura tras un conflicto de versión" width="100%" height="700" loading="lazy" style="border:1px solid #64748b;border-radius:12px" ></iframe>

[Abrir el visor por separado](/assets/interactive/domain-design/explorer.html).

El caso de uso no hace retries automáticos. La relectura aparece en el generador de trazas para enseñar la diferencia. Añadir reintentos requiere un límite, un tratamiento del conflicto y una identidad estable de la intención, no un bucle infinito alrededor de cualquier error.

## Un repository no necesita exponer todas las consultas

El [patrón Repository de Fowler](https://martinfowler.com/eaaCatalog/repository.html) separa el acceso a objetos del modelo de los detalles de mapeo y consulta. En este ejercicio lo concretamos en un contrato pequeño para un caso de uso, no en un CRUD universal.

Una consulta de reporting puede devolver una proyección sin reconstruir todos los agregados. Hacerla pasar por el mismo repository solo por convención puede cargar estado innecesario o convertir su interfaz en un catálogo de filtros. Separar lecturas es una opción, no una obligación de desplegar CQRS o dos bases.

El fake sirve para probar al consumidor del contrato. Un adaptador SQL necesitaría además reconstruir un estado válido, tratar IDs y versiones y demostrar las mismas garantías con el motor real. Pasar los tests con un fake no prueba ese adaptador pendiente.

## Prueba el fallo de coordinación y el fallo de almacenamiento

Consulta el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-repositories/README.md) y el [caso de uso con su fake](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/application.ts). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
pnpm --dir packages/domain-design demo
```

La demo lanza las dos llamadas con `Promise.allSettled`. Sus lecturas ocurren antes de que las continuaciones intenten confirmar: el test verifica una aceptación, un conflicto, 7000 unidades menores reservadas y un evento. No es una prueba de carga ni de concurrencia entre máquinas.

Otra prueba simula un fallo de almacenamiento **antes** de confirmar y verifica que no cambia estado, revisión o eventos. No simula una caída en un commit de DB ni una respuesta perdida después de haber persistido: ese último caso tendría resultado incierto y necesitaría reconciliación o idempotencia.

## Alternativas: bloquear o reducir la operación a una escritura condicional

Una **escritura condicional** puede ser suficiente si la regla cabe en ella. Es una opción más simple que reconstruir un objeto grande para modificar un contador.

Un **lock pesimista** permite coordinar una decisión mientras otros esperan. Puede ser útil, pero exige controlar la duración de la transacción, el orden de locks y los deadlocks. No conviene mantenerlo mientras se espera a un proveedor remoto.

La revisión optimista hace visible el conflicto sin mantener un lock durante toda la lectura. Bajo mucha contención puede producir reintentos frecuentes. No hay un mecanismo ganador sin conocer la regla y el patrón de acceso.

## Garantías y límites

El fixture confirma una sola decisión por revisión y conserva estado más evento juntos dentro del proceso. Rechaza el exceso después de releer. No demuestra durabilidad, atomicidad SQL, entrega de mensajes, autorización, autenticidad de capturas ni ejecución de reembolsos.

La traducción logística del post de bounded contexts y la política temporal de Returns tampoco se han conectado a este caso de uso. Antes de construir un flujo real habría que definir cuándo se comprueba elegibilidad y qué hacer si cambia entre la decisión y el efecto.

## Ejercicio: prueba el contrato, no el nombre del adaptador

Implementa otro fake que falle una vez antes del commit. La primera ejecución debe rechazar sin guardar nada; un nuevo intento sobre el mismo estado debe guardar una sola reserva y un evento. Después haz que una copia antigua intente confirmar y comprueba que no sobrescribe lo nuevo.

Seguimos con [domain events](/posts/domain-events-hechos-confirmacion): falta precisar cuándo un hecho se considera confirmado y por qué guardarlo no significa haberlo entregado a otro proceso.

## Referencias

- [Martin Fowler: Repository](https://martinfowler.com/eaaCatalog/repository.html).
- [PostgreSQL 18: aislamiento y decisiones concurrentes](https://www.postgresql.org/docs/18/transaction-iso.html).
- [Vaughn Vernon: Effective Aggregate Design, parte I](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf).

Fuentes consultadas el 20 de octubre de 2026. Las trazas pertenecen a un fake en memoria, no a PostgreSQL, un broker ni una integración bancaria.
