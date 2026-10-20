---
id: DB-NORMALIZATION
title: 'Normalización y desnormalización: qué duplicación evita errores y cuál los provoca'
published: 2026-10-17T00:05:00Z
locale: es
translationKey: database-normalization-denormalization
slug: normalizacion-desnormalizacion-datos
draft: true
status: draft
level: intermedio
prerequisites: [DB-MODEL, DB-SQL]
description: 'Entiende dependencias funcionales, 1NF, 2NF y 3NF con pedidos. Distingue hechos históricos de datos derivados y prueba la obsolescencia de una materialized view.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['bases-de-datos', 'normalizacion', 'postgresql', 'modelado', 'sql']
---

Un cliente cambia de dirección y aparecen tres versiones distintas en la base de datos. Actualizaste su perfil, pero otras tablas conservaban copias que la aplicación seguía tratando como actuales.

La **normalización** ayuda a identificar qué hecho depende de qué clave. La **desnormalización** introduce redundancia deliberada para un acceso concreto. Ninguna de las dos se puede elegir contando tablas o repitiendo que «los joins son lentos».

Partimos del [modelo de pedidos](/posts/modelado-relacional-integridad-datos) y de las [agregaciones SQL](/posts/sql-joins-null-agregaciones). Vamos a reconocer dependencias, separar hechos históricos de copias accidentales y observar qué pasa cuando un resumen deja de estar actualizado.

## Una dependencia funcional expresa una regla del dominio

Decir **customer_id → customer_name** significa que, dentro del modelo, un identificador de cliente determina un único nombre actual. No significa que nombres e identificadores sean intercambiables: dos clientes pueden llamarse igual.

Imagina una tabla con clave `(order_id, sku)` y columnas `customer_id`, `customer_name`, `product_name`, `quantity` y `unit_price_minor`. El nombre actual del producto depende de `sku`, no de toda la combinación. El nombre del cliente depende de su identificador, al que llegamos mediante el pedido.

<img src="/assets/visuals/database-series/normalizacion.svg" alt="Una tabla de líneas repite el nombre del cliente y del producto. Separar Customers, Orders y Products deja cada dato actual asociado a su identificador; la línea conserva cantidad y precio histórico." width="945" height="542" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/normalizacion.svg).

Esa repetición produce **update anomalies** si actualizas solo algunas copias. Puede producir **insert anomalies** si necesitas registrar un producto pero la única tabla exige un pedido. Y **delete anomalies** si al borrar su última línea pierdes la única descripción del producto.

## 1NF, 2NF y 3NF sin aprenderlas como un eslogan

La **first normal form**, o **1NF**, evita grupos repetidos en una fila: `product_1`, `product_2`, `product_3` convierten el número máximo de productos en parte del esquema. Una fila por línea permite representar cualquier cantidad de líneas sin nuevas columnas.

La noción de valor atómico depende del dominio y de las operaciones. Que PostgreSQL soporte arrays o JSON no decide por sí solo si tu modelo es apropiado.

La **second normal form**, o **2NF**, exige que los atributos no primos no dependan solo de parte de una clave candidata compuesta. En nuestro ejemplo, el nombre actual del producto pertenece a `products`, porque depende de `sku`. Añadir un identificador artificial a cada línea no elimina esa dependencia.

La **third normal form**, o **3NF**, se expresa formalmente así: para cada dependencia funcional no trivial `X → A`, `X` debe ser una superclave o `A` un atributo primo. Una **superclave** identifica de forma única la fila; una **clave candidata** es una superclave sin atributos sobrantes. Un atributo primo participa en alguna clave candidata. En el caso sencillo de una sola clave, la intuición es evitar depender de ella a través de otro dato no clave: `order_id → customer_id → customer_name`.

Son herramientas para razonar sobre dependencias, no una obligación de convertir cada columna en una tabla. Puedes contrastar la intuición con la [introducción de Microsoft](https://learn.microsoft.com/en-us/previous-versions/troubleshoot/microsoft-365/microsoft-365-apps/access/database-normalization-description) y la definición formal en los [apuntes de bases de datos del Rensselaer Polytechnic Institute](https://www.cs.rpi.edu/~sibel/csci4380/fall2019/course_notes/normalization.html).

## Un precio histórico no es una copia desactualizada

En `products.price_minor` guardamos el precio actual. En `order_items.unit_price_minor`, el precio acordado cuando se compró. **Son hechos diferentes**. Cambiar ambos a la vez sería un error.

Lo mismo ocurre con una dirección de envío: puede ser una referencia al perfil actual o una snapshot de la dirección utilizada para entregar un pedido. La decisión depende de qué pregunta deba responder ese dato.

Antes de eliminar duplicación aparente, pregunta si las columnas describen el mismo hecho en el mismo momento. Normalizar sin ese análisis también puede destruir información.

## Un resumen ahorra cálculo, pero exige una política de actualización

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/06-normalizacion.sql), entra en `database-fundamentals/` y ejecuta:

Archivo: terminal.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/06-normalizacion.sql
```

Archivo: `database-fundamentals/sql/06-normalizacion.sql`.

```sql
\ir 04-consultas.sql
CREATE MATERIALIZED VIEW db_model.customer_summary AS
SELECT * FROM db_model.customer_totals;
CREATE UNIQUE INDEX customer_summary_id ON db_model.customer_summary(id);
-- Alias para mantener explícito el significado de la clave en el experimento.
ALTER MATERIALIZED VIEW db_model.customer_summary RENAME COLUMN id TO customer_id;
SELECT * FROM db_model.customer_summary ORDER BY customer_id;
```

Una **view** ordinaria conserva la consulta y la evalúa al leer. Una **materialized view** persiste el resultado de su evaluación. La elegimos como ejemplo de desnormalización porque hace visible quién calcula y cuándo se renueva el resumen.

Archivo: sesión `psql`, provocar y resolver obsolescencia.

```sql
UPDATE db_model.order_items
SET quantity=3 WHERE order_id=10 AND sku='BOOK';
SELECT total_minor FROM db_model.customer_summary WHERE customer_id=1;
REFRESH MATERIALIZED VIEW db_model.customer_summary;
SELECT total_minor FROM db_model.customer_summary WHERE customer_id=1;
```

El primer `SELECT` sigue mostrando 3500; después del **refresh**, muestra 4500. El dato antiguo no era un fallo de `SUM`: nadie había actualizado la copia. La prueba automática del laboratorio verifica los dos estados.

La materialized view no es adecuada si cada lectura exige inmediatamente el último estado. También tiene coste de refresco y locks; `REFRESH ... CONCURRENTLY` tiene requisitos y un coste distinto, no convierte la actualización en gratuita. [Materialized views](https://www.postgresql.org/docs/18/rules-materializedviews.html).

## Compara alternativas con el mismo requisito

Calcular al leer evita mantener una copia, pero repite trabajo. Mantener un resumen en la misma transacción puede dar coherencia inmediata, a cambio de ampliar escrituras y coordinar concurrencia. Refrescar periódicamente simplifica algunos accesos si el producto acepta una ventana explícita de antigüedad.

No afirmaremos una mejora de rendimiento a partir de tres líneas ficticias. Para decidir por rendimiento, mide con volumen representativo el tiempo de lectura, el coste de escritura y el de reconciliación. Una lectura rápida que devuelve una cifra inapropiada para el negocio no es una optimización completa.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-normalization/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

Un modelo normalizado reduce anomalías debidas a dependencias mal ubicadas. No evita por sí solo carreras, algoritmos incorrectos o permisos mal configurados.

Un resumen correctamente refrescado representa los datos de su evaluación. No promete mantenerse al día sin un proceso que lo garantice. Documenta fuente de verdad, antigüedad aceptada, método de actualización y recuperación tras fallos.

## Ejercicio: detecta una divergencia antes de repararla

Escribe una consulta que compare `customer_summary` con `customer_totals` por cliente. Debe no devolver diferencias tras un refresh y detectar a Ana después de cambiar la cantidad sin refrescar.

No repares automáticamente diferencias sin definir cuál es la fuente de verdad. Para acelerar consultas sin introducir otra copia lógica del total, sigue con [fundamentos de índices](/posts/indices-postgresql-fundamentos).

## Referencias

Consultadas el 17 de octubre de 2026: [normalización, Microsoft Learn](https://learn.microsoft.com/en-us/previous-versions/troubleshoot/microsoft-365/microsoft-365-apps/access/database-normalization-description), [materialized views de PostgreSQL 18](https://www.postgresql.org/docs/18/rules-materializedviews.html) y [REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html).
