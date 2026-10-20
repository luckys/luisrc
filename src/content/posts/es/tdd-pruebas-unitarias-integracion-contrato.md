---
id: DESIGN-TDD
title: 'TDD sin probar detalles internos: reglas, integración y contratos'
published: 2026-10-17T02:03:00Z
locale: es
translationKey: reliable-tdd-testing
slug: tdd-pruebas-unitarias-integracion-contrato
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-STATES]
description: 'Elige pruebas por el riesgo que detectan. Desarrolla una regla con red-green-refactor y evita que un mock se convierta en evidencia de persistencia real.'
author: 'Luis Ramírez Calle'
series: 'Diseñar servicios que se puedan cambiar'
tags: [tdd, testing, typescript, calidad]
---

Cambias una función privada y fallan veinte tests, aunque la aplicación siga haciendo lo mismo. Semanas después, un rollback roto llega a producción porque el mock de la base de datos siempre respondía bien. Había muchas pruebas, pero estaban observando cosas poco útiles.

**TDD** sirve para concretar comportamiento mediante ejemplos y recibir feedback temprano. Su valor no depende de contar aserciones ni de reproducir cada detalle de implementación. Cerraremos esta serie con las reglas de la [máquina de estados](/posts/maquinas-estados-reglas-negocio).

## Red: una regla antes de su implementación

Queremos que un éxito confirmado no cambie por un rechazo atrasado. La primera prueba expresa esa decisión y debe fallar si la implementación simplemente asigna cualquier estado recibido.

Archivo: `reliable-services/tests/core.test.mjs` (extracto).

```javascript
assert.equal(transition('created', 'submit'), 'processing')
assert.equal(transition('processing', 'uncertain'), 'unknown')
assert.equal(transition('unknown', 'confirm'), 'succeeded')
assert.equal(transition('succeeded', 'confirm'), 'succeeded')
assert.throws(() => transition('succeeded', 'decline'))
assert.throws(() => transition('created', 'confirm'))
```

Al preparar el laboratorio se ejecutaron primero sus tests antes de crear los módulos y se observó el fallo por implementación ausente. Ese primer rojo comprueba el cableado, no demuestra todavía que cada test detecte cualquier implementación incorrecta. Para comprobar eso necesitamos contraejemplos y, cuando compense, mutation testing.

**Green** consiste en implementar lo suficiente para satisfacer la regla. **Refactor** mejora estructura conservando comportamiento. No significa generalizar inmediatamente una solución para estados que todavía no existen.

<img src="/assets/visuals/reliable-services/DESIGN-TDD.svg" alt="Un ciclo red-green-refactor rodea las reglas; las pruebas de integración comprueban PostgreSQL real y los contratos verifican lo que observa un consumidor." width="573" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DESIGN-TDD.svg).

## Cada nivel responde a una incertidumbre

Una **unit test** puede comprobar que la tabla rechaza una transición. Una **integration test** verifica que el SQL confirma el cambio y el evento juntos. Una **contract test** comprueba que un consumidor sigue interpretando la respuesta. Una **E2E** recorre una interacción completa y detecta errores de ensamblaje.

No hay un porcentaje universal para cada nivel. Si el riesgo dominante es una constraint, cien tests de funciones puras no sustituyen una prueba con el motor real. Si la regla es una tabla de estados, levantar todo el sistema para cada combinación hace más lento el feedback sin aportar necesariamente más evidencia sobre esa tabla.

La forma de una pirámide puede recordar que los tests caros no deben ser la única defensa. No obliga a minimizar precisamente las pruebas que detectan tus fallos más probables.

## Un fake debe reconocer su frontera

El `OrderWriter` falso permite observar el pedido recibido y provocar un rechazo. No demuestra que PostgreSQL respete un `UNIQUE`, que una transacción haga rollback o que dos conexiones se coordinen.

Por eso el laboratorio mantiene otro grupo con PostgreSQL real. Comprueba atomicidad, unicidad concurrente y consumo repetido de un evento. Utiliza Docker Compose en lugar de Testcontainers para mantener cero dependencias runtime y dejar visible el motor; ambos enfoques pueden servir si aíslan y limpian el entorno correctamente.

Al probar concurrencia, evita «esperar un poco a que la otra tarea avance». Una barrera o una condición observable hace explícito el intercalado. El test del contador utiliza esa técnica y obtiene siempre el mismo fallo.

## Una suite útil también explica el rechazo

Los casos normales son insuficientes. Añade un dato inválido, una operación duplicada, un estado atrasado y un fallo entre dos pasos. Inspecciona el efecto de negocio: un solo email lógico, una sola transición o ninguna fila parcial, según corresponda.

**Coverage** indica qué código se ejecutó. No demuestra que las aserciones distingan un resultado correcto de uno incorrecto. Un test que solo exige «no lanzó error» puede ejecutar todo el handler y seguir sin detectar un cargo duplicado.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/design-tdd/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

Las pruebas reducen incertidumbre dentro de sus escenarios. No prueban seguridad completa, disponibilidad ni ausencia de todas las carreras. La suite del núcleo contiene modelos en memoria; la suite PostgreSQL comprueba otros límites. Mantener esa separación es parte del resultado.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/tests/core.test.mjs). Desde `reliable-services/`:

```bash
node --test tests/core.test.mjs
docker compose up -d --wait
node --test tests/postgres.test.mjs
```

## Ejercicio: demostrar que el test puede fallar

En una copia local, permite que `succeeded` acepte `decline`. La suite debe detectar la regresión. Restaura la regla y prueba una mutación distinta: repetir el efecto aunque el estado no cambie. Identifica qué prueba faltaría para detectarla.

La siguiente serie empieza con [fallos parciales y resultados desconocidos](/posts/fallos-parciales-timeout-resultado-desconocido).

## Referencias

- [Node.js 24: test runner](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [PostgreSQL 18: transacciones](https://www.postgresql.org/docs/18/tutorial-transactions.html).
- [Stryker: qué es mutation testing](https://stryker-mutator.io/docs/).

Fuentes consultadas el 17 de octubre de 2026. Mutation testing se propone como ampliación; no se ha ejecutado Stryker en este laboratorio.
