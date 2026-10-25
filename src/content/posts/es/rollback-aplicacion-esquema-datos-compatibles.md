---
id: CD-ROLLBACK
title: 'Rollback de aplicación y esquema: volver a una versión que todavía entiende los datos'
published: 2026-10-25T13:07:00Z
locale: es
translationKey: progressive-delivery-rollback
slug: rollback-aplicacion-esquema-datos-compatibles
draft: true
status: draft
level: intermedio
prerequisites: [CD-CANARY, DB-MIGRATIONS]
description: 'Verifica rollback de tráfico, flag e image sin retirar el contrato SQL antiguo. Una fila creada por la versión nueva debe seguir siendo legible y la versión anterior debe poder continuar escribiendo.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [rollback, postgresql, migrations, delivery]
---

La image anterior vuelve a arrancar, pero su primera consulta falla: la columna que leía ya no existe. El comando de rollback terminó correctamente; el servicio sigue sin poder atender al usuario.

Volver de aplicación, retirar exposición y recuperar datos son operaciones diferentes. Para que un **rollback** sea viable, la versión recuperada debe seguir entendiendo el estado que encuentra, incluidas las escrituras de la versión nueva.

Cerramos la ruta después de [detectar la regresión con el canary](/posts/canary-releases-candidato-control-muestras) y retomamos [expand–migrate–contract](/posts/migraciones-base-datos-sin-romper-aplicacion) con dos releases ejecutándose de verdad.

## Tráfico, flag e image ofrecen vueltas distintas

Retirar el canary cambia qué instancias reciben nuevas peticiones. Apagar la flag cambia qué comportamiento ejecutan. Restaurar una image cambia el artefacto que se instala.

El fixture registra los tres pasos por separado. Primero retira la cohorte defectuosa. Después fuerza una exposición incorrecta dentro del entorno desechable para probar su mitigación. Apaga la flag y comprueba el precio correcto sin cambiar la image; por último restaura la image estable.

La exposición forzada está marcada como prueba negativa que el gate normal no aprobaría. No forma parte de una recomendación de seguir liberando después de detectar el fallo.

Elegimos recuperar el artefacto estable porque conservamos su contrato y podemos verificarlo. Si esa versión ya no fuera compatible, un **roll forward** con una corrección compatible podría ser preferible. La decisión depende del estado real, no de una regla de que todo incidente se resuelva volviendo atrás.

## Expand conserva el contrato que necesita la versión anterior

La tabla inicial contiene `id`, `name` y `price_cents`. La candidata quiere leer `display_name`. El archivo `sql/02-expand.sql` añade la columna sin eliminar la anterior:

```sql
BEGIN;
SET LOCAL lock_timeout = '1s';
ALTER TABLE products ADD COLUMN display_name text;
UPDATE products SET display_name = name;
COMMIT;
```

`display_name` permite nulos. La versión antigua puede seguir insertando únicamente `name`, como comprueba el ejercicio después de aplicar la expansión. La nueva lee con fallback y escribe ambos campos para sus productos nuevos.

El `lock_timeout` limita cuánto se espera para adquirir un lock; no hace instantánea la operación ni limita por sí solo toda su ejecución. El backfill recorre dos filas iniciales. No hemos medido el efecto de millones de filas o de transacciones largas.

## La compatibilidad se prueba en las dos direcciones

Después de expandir, v1 crea `legacy-after-expand` sin `display_name`. La candidata debe leer su nombre mediante `COALESCE(display_name, name)` y conservar `1234` céntimos.

Más tarde, v2 crea `new-from-v2` con `2345` céntimos y escribe ambos campos. Tras restaurar la image v1, el router consulta ese producto y debe seguir obteniendo el mismo nombre y precio.

Los productos del ejemplo son inmutables. Si hubiera actualizaciones, el dual write necesitaría una política de fuente de verdad y sincronización entre escritores antiguos y nuevos. Un fallback de lectura no resuelve por sí solo divergencias entre valores existentes.

<img src="/assets/visuals/progressive-delivery/CD-ROLLBACK.svg" alt="La expansión mantiene name y añade display_name nullable. La versión nueva escribe ambas columnas; restaurar la image antigua conserva lecturas y una escritura nueva. El contract prematuro se ensaya aparte y se revierte dentro de la transacción." width="292" height="708" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-ROLLBACK.svg).

## La vuelta de image mantiene el esquema expandido

El harness retira green de la ruta antes de recrearlo. Cambia su referencia al image ID estable, espera readiness y vuelve a probarlo. Se inspecciona el contenido que ejecuta el container, no solo un nombre de release.

Al probar la fila nueva exige estas condiciones en `scripts/exercise.mjs`:

```javascript
  assert.equal(oldReadsNew.body.revision, 'v1'); assert.equal(oldReadsNew.body.priceCents, newProduct.priceCents)
  assert.equal(oldReadsNew.body.name, newProduct.name)
```

Además se ejecuta el smoke de los productos iniciales. El rollback mantiene la columna nueva: devolver la aplicación a v1 no exige eliminarla. Retirar esa estructura podría destruir información que aún necesite una corrección posterior.

## Un contract prematuro rompe el camino de vuelta

El laboratorio ensaya la retirada de `name` en `sql/03-unsafe-contract.sql`. La operación está dentro de una transacción y termina en `ROLLBACK`; no deja aplicada una migración destructiva.

El bloque exige observar el error de la consulta antigua:

```sql
DO $$
BEGIN
  PERFORM name FROM products;
  RAISE EXCEPTION 'La consulta antigua debía fallar';
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'expected_undefined_column_42703';
END $$;
```

El archivo completo abre la transacción, retira la columna, ejecuta este bloque y revierte. El marcador corresponde al SQLSTATE `42703`. Después se comparan columnas y filas con las capturadas antes del ensayo.

No se trata de borrar una columna de producción para averiguar si alguien la usa. Es una prueba negativa sobre la base ficticia y aislada del ejercicio. Demuestra que la consulta antigua depende de ese contrato y que aquí no podemos retirarlo conservando esa opción de rollback.

## ROLLBACK de SQL no deshace una migración ya confirmada

La instrucción **ROLLBACK** descarta los cambios de la transacción actual. Por eso sirve para deshacer el ensayo antes de confirmar. No devuelve por sí sola una base de datos al estado que tenía antes de un `COMMIT` anterior.

Una migración inversa que vuelva a añadir una columna no recupera automáticamente los valores que se perdieron al eliminarla. Restaurar un backup cumple otro propósito y obliga a considerar las escrituras posteriores a la copia.

En este caso conservamos la expansión y comprobamos que los datos sigan sirviendo. Para una retirada definitiva exigiríamos identificar consumidores antiguos, terminar la ventana de vuelta y verificar la migración de datos con criterios propios.

## Recuperación incluye leer, escribir y conservar lo anterior

Antes de restaurar la image se guardan cuatro filas: las dos iniciales, una escrita por v1 tras expandir y otra por v2. Después de recuperar v1 y ensayar el contract, esas cuatro deben ser iguales a sus valores anteriores.

Por último, v1 inserta `after-rollback`. El estado final contiene cinco filas y conserva las cuatro previas sin modificaciones. Esto evita dar por recuperado un servicio que solo puede leer datos antiguos, pero ya no admite trabajo nuevo.

La regresión del fixture alteraba una respuesta, no el precio almacenado. No hemos reparado importes corruptos ni compensado efectos externos. Si existieran, su reconciliación necesitaría otro procedimiento y evidencia propia.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-rollback/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

El archivo completo separa órdenes de routing, SQL y comprobaciones. El [visor del recorrido](/assets/interactive/progressive-delivery/explorer.html) permite revisar `candidate_write`, `image_rollback`, `unsafe_contract_rejected` y `rollback_integrity` sin ejecutar esas órdenes.

## Garantías y límites

La image anterior leyó una fila creada por la candidata y admitió una escritura nueva. Columnas y cuatro filas anteriores permanecieron iguales; el ensayo destructivo se revirtió sin confirmarlo.

No hay restauración de backups, migración masiva, pérdida del disco, corrupción provocada, efectos externos o garantía de downtime cero. El caso demuestra compatibilidad y recuperación en este recorrido local.

## Ejercicio: escribir las precondiciones de una vuelta posible

Antes de retirar una columna, enumera qué aplicaciones, workers, informes y procedimientos de recuperación podrían usarla. Define qué evidencia permitiría cerrar la ventana de rollback y qué harías si la nueva versión ya hubiera escrito datos que la anterior no puede interpretar.

## Referencias

- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html).
- [PostgreSQL: ROLLBACK y su alcance transaccional](https://www.postgresql.org/docs/18/sql-rollback.html).
- [AWS: cambios de esquema compatibles entre grupos](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/best-practices-for-managing-data-synchronization-and-schema-changes.html).
- [Google SRE: release engineering y recuperación de versiones](https://sre.google/sre-book/release-engineering/).

Fuentes consultadas el 25 de octubre de 2026.
