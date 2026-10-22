---
id: TEST-DOUBLES
title: 'Test doubles: usar un fake sin confundirlo con la base de datos'
published: 2026-10-21T13:02:00Z
locale: es
translationKey: testing-doubles-shared-contract
slug: test-doubles-stubs-spies-fakes-contratos
draft: true
status: draft
level: intermedio
prerequisites: [TEST-TDD]
description: 'Distingue stubs, spies, mocks y fakes. Comprueba el mismo contrato contra Map y SQLite sin atribuir al doble garantías de persistencia o concurrencia.'
author: 'Luis Ramírez Calle'
series: 'Pruebas de software: reglas, fronteras y evidencia'
tags: [testing, test-doubles, typescript, sqlite]
---

Un repositorio falso que siempre devuelve `true` permite comprobar qué hace el servicio cuando una escritura sale bien. No permite comprobar qué ocurre si otra escritura se adelantó. Si todos los colaboradores responden lo que esperamos, podemos terminar probando un sistema que solo existe dentro del test.

Los **test doubles** son útiles precisamente porque controlan una parte del escenario. El problema aparece cuando olvidamos qué parte hemos sustituido. Seguiremos con el registro de trabajos de la [entrega sobre TDD](/posts/tdd-maquina-estados-red-green-refactor), esta vez al guardar sus cambios.

## Stub, spy, mock y fake no responden a la misma pregunta

Un **test double** sustituye un colaborador durante una prueba. La clasificación de [Test Double, de Martin Fowler](https://martinfowler.com/bliki/TestDouble.html), ayuda a precisar qué estamos usando:

<div role="region" aria-label="Tipos de test double y ejemplos de uso" tabindex="0" style="overflow-x:auto">

| Tipo | Papel en el test | Ejemplo |
| --- | --- | --- |
| **Dummy** | Rellena un parámetro que el escenario no utiliza | Un argumento obligatorio que no se consulta |
| **Stub** | Devuelve una respuesta preparada | `read` devuelve `null` |
| **Spy** | Registra las llamadas para inspeccionarlas | Una lista de escrituras recibidas |
| **Mock** | Comprueba expectativas de interacción predefinidas | Exigir una llamada con un argumento concreto |
| **Fake** | Implementa comportamiento simplificado con estado | Un repositorio basado en `Map` |

</div>

La diferencia no depende de que uses una biblioteca. Una función de mocking puede actuar como stub si solo la configuras para devolver un valor. Y un objeto escrito a mano puede verificar interacciones.

Tampoco necesitamos introducir los cinco tipos en cada suite. Nuestro laboratorio usa un stub con spy y un fake. No añade un parámetro innecesario para poder enseñar un dummy ni configura expectativas de llamadas que el contrato no exige.

## Un stub de ausencia permite observar que no se escribe

`execute` depende de `JobRepository`, un contrato pequeño declarado en `src/service.ts`:

```typescript
export interface JobRepository {
  read(id: string): Promise<Job | null>
  compareAndSet(next: Job, expectedVersion: number): Promise<boolean>
}
```

`Job` contiene ID, estado y versión. El servicio lee el registro, comprueba la versión enviada por quien solicita el cambio, aplica la transición y guarda con **compare-and-set**. Solo confirma si la versión almacenada seguía siendo la esperada.

Cuando el trabajo no existe no debe intentar escribir. Para probarlo no necesitamos SQL. En `tests/service.test.mjs` preparamos una ausencia y registramos cualquier intento de escritura:

```javascript
test('stub de ausencia y spy: no intenta escribir un trabajo inexistente', async () => {
  const writes = []
  const repository = {
    read: async () => null,
    compareAndSet: async (...args) => { writes.push(args); return true },
  }
  await assert.rejects(execute(repository, 'j-1', 'start', 0), /not_found/)
  assert.deepEqual(writes, [])
})
```

La respuesta `null` es el stub. `writes` hace de spy. La aserción de rechazo observa el resultado público y la lista vacía protege una interacción relevante: no se debe crear un cambio para un registro inexistente.

No comprobamos que `read` se llame exactamente una vez porque ese número no es parte del comportamiento que queremos proteger. Un refactor podría añadir una lectura legítima. Si una interacción es costosa o tiene efectos irreversibles, contarla puede importar; hay que justificarlo por el contrato, no por lo fácil que resulta hacerlo.

## Un fake con estado permite probar un recorrido

`MemoryJobs`, en `src/memory.ts`, mantiene registros inmutables en un `Map`. A diferencia de un stub con respuestas en una cola, lo que devuelve depende de las operaciones anteriores. Podemos insertar, iniciar y finalizar el mismo trabajo, y después consultar su versión.

Su `compareAndSet` devuelve `false` si el registro no existe o su versión ya cambió. Si coincide, guarda una copia congelada y devuelve `true`. Así permite probar que el servicio maneja tanto el éxito como un conflicto sin levantar almacenamiento externo.

Ese comportamiento tiene un coste: el fake también es código que podemos escribir mal. Si se le olvida comparar versiones, los tests del servicio podrían aprobar cambios que el adaptador real rechaza. Tener dos implementaciones exige alguna forma de contrastarlas.

<img src="/assets/visuals/testing-strategy/TEST-DOUBLES.svg" alt="execute depende del contrato JobRepository; un stub permite observar la ausencia y los mismos ejemplos comprueban Map y SQLite, sin extender sus garantías a PostgreSQL o failover." width="328" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/testing-strategy/TEST-DOUBLES.svg).

## El contrato compartido contrasta el fake con el adaptador real

La función `repositoryContract`, en `tests/repository-contract.mjs`, registra tres escenarios usando una factory de repositorio. Comprueba ausencia y unicidad, dos cambios con la misma versión esperada, y rechazo de un salto de versión.

Uno de sus escenarios es este:

```javascript
test(`${name}: compare-and-set elige un solo cambio de la versión cero`, async (t) => {
  const { repository, close } = await fixture()
  t.after(close)
  await repository.insert('j-1')
  const results = await Promise.all([
    repository.compareAndSet({ id: 'j-1', state: 'running', version: 1 }, 0),
    repository.compareAndSet({ id: 'j-1', state: 'cancelled', version: 1 }, 0),
  ])
  assert.deepEqual(results.toSorted(), [false, true])
  const winner = await repository.read('j-1')
  assert.equal(winner.version, 1)
  assert.ok(['running', 'cancelled'].includes(winner.state))
  assert.equal(await repository.compareAndSet({ id: 'j-2', state: 'running', version: 1 }, 0), false)
})
```

No exigimos qué cambio gana. Exigimos que ambos no se confirmen sobre la misma versión y que el ganador deje una versión coherente. El test se ejecuta contra `MemoryJobs` y contra `SqliteJobs(':memory:')`.

Aquí **SQLite en memoria sigue siendo el motor SQLite real**: ejecuta SQL y constraints, aunque los datos no se conserven al cerrar. El `Map` es el fake. Confundir ambos por compartir la palabra «memoria» oculta precisamente qué dependencia se está ejecutando.

El adaptador SQL utiliza una única sentencia condicional en `src/sqlite.ts`:

```typescript
async compareAndSet(next: Job, expectedVersion: number): Promise<boolean> {
  validateChange(next, expectedVersion)
  const result = this.database.prepare(
    'UPDATE jobs SET state = ?, version = ? WHERE id = ? AND version = ?',
  ).run(next.state, next.version, next.id, expectedVersion)
  return result.changes === 1
}
```

La comparación no ocurre en un `SELECT` separado seguido de un `UPDATE` incondicional. Forma parte de la escritura. `validateChange` comprueba formato y que la nueva versión sea la esperada más uno; la validez de la transición pertenece al servicio y al núcleo, no a este repositorio.

## Compartir tests no demuestra equivalencia completa

Los dos repositorios pasan los mismos tres escenarios. No significa que tengan idénticas garantías. `DatabaseSync` ejecuta sus operaciones sincrónicamente: el `Promise.all` del test no crea dos escritores en procesos distintos ni una carrera de locks del motor.

Además se prueba por separado un archivo temporal: guardar, cerrar la conexión, abrir otra y leer el valor. Eso demuestra persistencia entre conexiones con cierre limpio. No simula pérdida eléctrica, corrupción o caída del proceso durante un commit.

El contrato tampoco exige que cada lectura devuelva la misma referencia. El fake puede devolver su objeto congelado y SQLite construir otro equivalente. Comparamos valores y protección frente a mutación, que son las propiedades que sí consumimos.

Este contrato local entre adaptadores no es un **consumer-driven contract** entre servicios desplegados de forma independiente. Para eso necesitaremos expectativas de consumidores, versiones del proveedor y verificación de compatibilidad. Lo trataremos aparte, sin llamar contrato distribuido a cualquier función reutilizada en dos tests.

## Código completo y pruebas

Consulta [los archivos del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/test-doubles/README.md) y el [contrato ejecutable](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/testing-strategy/tests/repository-contract.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/testing-strategy test
pnpm --dir packages/testing-strategy test:integration
```

La primera suite tiene 28 tests del núcleo y del servicio. La segunda tiene once: seis ejecuciones del contrato compartido, una de reapertura del archivo y cuatro de HTTP. No necesita Docker ni bases de datos del usuario.

## Garantías y límites

El fake ayuda a probar decisiones del servicio, no SQL. El adaptador real comprueba SQLite, no PostgreSQL. No hay procesos escritores concurrentes, failover o efectos sobre proveedores. Los directorios temporales pertenecen exclusivamente al test y se retiran después de cerrar las conexiones.

## Ejercicio: hacer que el fake deje de respetar el contrato

En tu copia, elimina la comparación de versiones de `MemoryJobs` manteniendo la versión siguiente válida. Ejecuta el contrato: el escenario con dos cambios debe detectar dos éxitos. Restaura la implementación y comprueba si las pruebas del servicio, por sí solas, habrían detectado ese mismo defecto.

Seguiremos con [la frontera que ejecuta cada nivel de prueba](/posts/unit-integration-e2e-fronteras-piramide-pruebas), porque un doble bien diseñado tampoco sustituye probar el ensamblaje real.

## Referencias

- [Martin Fowler: Test Double](https://martinfowler.com/bliki/TestDouble.html).
- [Martin Fowler: Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html).
- [Node.js 24: SQLite y DatabaseSync](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

Fuentes consultadas el 21 de octubre de 2026; redacción revisada el 22. Laboratorio ejecutado con Node 24.19.0.
