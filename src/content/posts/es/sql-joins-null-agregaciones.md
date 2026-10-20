---
id: DB-SQL
title: 'SQL sin totales duplicados: JOIN, NULL y agregaciones'
published: 2026-10-17T00:03:00Z
locale: es
translationKey: database-sql-joins-null-aggregation
slug: sql-joins-null-agregaciones
draft: true
status: draft
level: intermedio
prerequisites: [DB-MODEL]
description: 'Aprende a razonar sobre el grano de una consulta, evitar importes duplicados en JOIN y tratar NULL, LEFT JOIN, EXISTS, GROUP BY y HAVING.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['sql', 'postgresql', 'joins', 'backend', 'analisis-de-datos']
---

El informe de ventas devuelve 65 euros, pero las líneas de los pedidos solo suman 35. No hay datos corruptos ni un fallo de red. Un `JOIN` ha repetido importes y el `SUM` los ha sumado correctamente, sobre filas que no eran las que queríamos.

Antes de optimizar una consulta, necesitamos poder defender su resultado. El punto de partida es una pregunta sencilla: **¿qué representa una fila en cada paso?**

Esta primera parte de SQL en la serie parte del [modelo relacional](/posts/modelado-relacional-integridad-datos). Aprenderás a controlar la multiplicación de filas, conservar entidades sin coincidencias y tratar valores desconocidos. Dejaremos CTE, ventanas y cohortes para [la segunda parte](/posts/sql-cte-ventanas-cohortes).

## El grano de una consulta determina qué puedes sumar

El **grain**, o nivel de detalle, expresa qué significa una fila. Una tabla de pedidos tiene una fila por pedido; sus líneas tienen una fila por producto dentro del pedido.

Si unes ambas tablas, el resultado tiene una fila por línea. Repetir la fecha del pedido puede ser correcto. Repetir su total y sumarlo después probablemente no.

<img src="/assets/visuals/database-series/joins.svg" alt="Un pedido de 3000 céntimos tiene dos líneas. Al unirlo con las líneas, su total aparece dos veces. Preagregar antes del JOIN conserva un total por pedido." width="1047" height="434" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/joins.svg).

No todos los joins multiplican siempre, pero el potencial depende de la cardinalidad. Unir por una clave incompleta, por ejemplo `product_id` sin `tenant_id`, puede producir coincidencias válidas sintácticamente y equivocadas para el negocio.

## Reproduce el total incorrecto

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/04-consultas.sql), entra en `database-fundamentals/` y ejecuta:

Archivo: terminal, preparación.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/04-consultas.sql
docker compose exec postgres psql -X -U lab -d series_lab
```

El pedido 10 tiene dos líneas y total 3000; el 11 tiene una línea y total 500. La vista `order_totals` calcula el total de cada pedido desde sus líneas.

Archivo: sesión `psql`, consulta deliberadamente incorrecta.

```sql
SELECT sum(t.total_minor)
FROM db_model.orders o
JOIN db_model.order_totals t ON t.order_id=o.id
JOIN db_model.order_items i ON i.order_id=o.id;
```

Obtienes `6500`: el total 3000 aparece dos veces y el 500 una. **SUM(DISTINCT total_minor) no es la solución**: si dos pedidos distintos costaran lo mismo, eliminaría uno de sus importes.

Hay dos caminos razonables. Si necesitas sumar líneas, suma sus cantidades por precio. Si necesitas sumar totales de pedidos, trabaja con una fila por pedido y no vuelvas a unir líneas sin necesidad.

## Preagrega en el nivel que necesitas

Este es el archivo completo que prepara las vistas del ejemplo. Reinicia exclusivamente el esquema ficticio `db_model`, incluyendo sus datos.

Archivo: `database-fundamentals/sql/04-consultas.sql`.

```sql
\ir 01-modelo.sql
SET search_path TO db_model;
CREATE VIEW order_totals AS
SELECT order_id, sum(quantity * unit_price_minor) AS total_minor
FROM order_items GROUP BY order_id;
CREATE VIEW customer_totals AS
SELECT c.id, c.name, coalesce(sum(t.total_minor),0) AS total_minor
FROM customers c
LEFT JOIN orders o ON o.customer_id=c.id
LEFT JOIN order_totals t ON t.order_id=o.id
GROUP BY c.id,c.name;
SELECT * FROM customer_totals ORDER BY id;
```

`\ir` es una instrucción de **psql** que carga otro archivo relativo al actual, no SQL del servidor. `GROUP BY order_id` produce una fila por pedido antes del join con clientes. **COALESCE** transforma el total ausente en cero porque, en este informe, un cliente sin compras tiene gasto cero.

El resultado contiene a Ana con 3500 y a Luis y Eva con cero. La consulta no inventa pedidos para quienes no tienen: conserva sus filas mediante **LEFT JOIN**. [Expresiones de tabla](https://www.postgresql.org/docs/18/queries-table-expressions.html).

## Un filtro puede deshacer tu LEFT JOIN

Supón que necesitas incluir a todos los clientes y sumar solo pedidos de febrero. Si añades `WHERE o.created_at >= date '2026-02-01'`, las filas sin pedido tienen una fecha nula y quedan fuera.

Archivo: sesión `psql`, filtro sobre las coincidencias, no sobre el cliente.

```sql
SELECT c.id,c.name,coalesce(sum(t.total_minor),0) AS february_minor
FROM db_model.customers c
LEFT JOIN db_model.orders o
  ON o.customer_id=c.id
  AND o.created_at>=date '2026-02-01'
  AND o.created_at<date '2026-03-01'
LEFT JOIN db_model.order_totals t ON t.order_id=o.id
GROUP BY c.id,c.name
ORDER BY c.id;
```

El filtro en `ON` decide qué pedidos coinciden; no elimina al cliente sin coincidencias. Ana tiene 500 y los demás cero. El intervalo semiabierto también evita tener que adivinar «la última hora del último día» si después usas timestamps.

**WHERE** filtra filas antes de agrupar. **HAVING** filtra grupos después: `HAVING sum(t.total_minor) >= 1000` seleccionaría clientes cuyo gasto agregado supera ese umbral.

## NULL no es una cadena vacía ni el número cero

**NULL** representa información ausente o desconocida según el modelo. `value = NULL` no pregunta si falta el valor; usa `IS NULL`. Una comparación ordinaria con un valor nulo produce desconocido, y `WHERE` conserva solo condiciones verdaderas. [Operadores de comparación](https://www.postgresql.org/docs/18/functions-comparison.html).

`COUNT(*)` cuenta filas. `COUNT(o.id)` cuenta identificadores no nulos. Tras un `LEFT JOIN`, un cliente sin pedidos conserva una fila, por lo que el primero puede dar uno y el segundo cero.

No conviertas cualquier nulo en cero automáticamente: un precio desconocido no significa que el producto sea gratis. La elección de `COALESCE` debe corresponder al significado del informe.

## Si solo preguntas si existe, usa EXISTS

Un join no siempre es necesario. Para encontrar clientes con alguna compra:

Archivo: sesión `psql`, consulta de existencia.

```sql
SELECT c.id,c.name
FROM db_model.customers c
WHERE EXISTS (
  SELECT 1 FROM db_model.orders o WHERE o.customer_id=c.id
)
ORDER BY c.id;
```

**EXISTS** expresa la pregunta sin producir una fila por pedido. Para quienes no compraron, usa `NOT EXISTS`. Con `NOT IN`, un nulo en la subconsulta puede convertir comparaciones en desconocidas y sorprenderte. No es una regla de rendimiento universal; es una elección de semántica. [Subconsultas](https://www.postgresql.org/docs/18/functions-subquery.html).

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-sql/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

La preagregación corrige el grano del ejemplo; no demuestra que cualquier join posterior sea seguro. Comprueba las claves y la cardinalidad en cada paso. También necesitas acordar qué operaciones cuentan como ventas, cómo tratar devoluciones y en qué moneda agregar.

Aquí solo existen euros y pedidos sin devoluciones. No sumamos monedas distintas ni afirmamos que este total sea contabilidad de producción. Las pruebas del laboratorio comparan el total erróneo 6500, el correcto 3500 y la presencia de clientes sin pedidos.

## Ejercicio: un segundo pedido con el mismo importe

Añade otro pedido de 500 céntimos. El total de Ana debe pasar a 4000 y la consulta debe conservar a Luis y Eva. Comprueba que `SUM(DISTINCT ...)` no supera la prueba.

Después clasifica las compras sin perder las filas originales en [CTE, window functions y cohortes](/posts/sql-cte-ventanas-cohortes).

## Referencias

PostgreSQL 18, consulta del 17 de octubre de 2026: [JOIN y agrupaciones](https://www.postgresql.org/docs/18/queries-table-expressions.html), [comparaciones y NULL](https://www.postgresql.org/docs/18/functions-comparison.html) y [EXISTS y subconsultas](https://www.postgresql.org/docs/18/functions-subquery.html).
