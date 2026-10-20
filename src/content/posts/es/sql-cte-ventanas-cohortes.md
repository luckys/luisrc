---
id: DB-ANALYTICS
title: 'SQL para análisis: CTE, window functions y cohortes sin perder el detalle'
published: 2026-10-17T00:04:00Z
locale: es
translationKey: database-sql-windows-cohorts
slug: sql-cte-ventanas-cohortes
draft: true
status: draft
level: intermedio
prerequisites: [DB-SQL]
description: 'Construye acumulados, rankings y cohortes con CTE y window functions. Entiende PARTITION BY, el frame de una ventana y el denominador de la retención.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['sql', 'postgresql', 'window-functions', 'analitica', 'cohortes']
---

Quieres mostrar cada pedido junto al gasto acumulado del cliente. Un `GROUP BY customer_id` calcula el total, pero elimina el detalle de cada compra. Añadir más columnas al grupo no resuelve la pregunta: cambia lo que estás agrupando.

Las **window functions** calculan sobre un conjunto de filas relacionadas sin reducirlas a una sola. Las **CTE** ayudan a separar etapas cuando la consulta ya responde varias preguntas.

Esta es la segunda parte de SQL en **Fundamentos de bases de datos**. Conviene haber leído [JOIN, NULL y agregaciones](/posts/sql-joins-null-agregaciones). Vamos a numerar compras, calcular acumulados y construir una cohorte, distinguiendo un conteo de actividad de una tasa de retención.

## Una ventana conserva una fila por pedido

**PARTITION BY** define grupos lógicos para el cálculo, no tablas particionadas en disco. **ORDER BY** dentro de `OVER` ordena las filas para esa función; no garantiza el orden final del resultado.

<img src="/assets/visuals/database-series/ventanas.svg" alt="Las compras de Ana son 3000 y 500 céntimos. GROUP BY las reduce a un total de 3500. Una ventana conserva ambas filas y muestra acumulados de 3000 y 3500." width="1064" height="446" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/ventanas.svg).

Un **window frame** delimita qué filas de la partición participan en un cálculo para la fila actual. Elegimos `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`: desde la primera fila hasta la actual, siguiendo un orden determinista.

Sin especificarlo, el frame predeterminado con ordenación puede incluir filas empatadas. Para un acumulado compra a compra es mejor expresar la intención y desempatar por un identificador. [Window functions](https://www.postgresql.org/docs/18/tutorial-window.html).

## Un ejemplo completo de acumulados y cohortes

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/05-analitica.sql). Desde `database-fundamentals/`, arranca `docker compose up -d --wait` y ejecuta:

Archivo: terminal.

```bash
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/05-analitica.sql
```

El script incluye el modelo y las vistas de la entrega anterior; no requiere que hayas ejecutado otros capítulos. Reinicia los datos ficticios `db_model`.

Archivo: `database-fundamentals/sql/05-analitica.sql`.

```sql
\ir 04-consultas.sql
SET search_path TO db_model;
CREATE VIEW order_analysis AS
SELECT o.id,o.customer_id,o.created_at,t.total_minor,
  row_number() OVER (
    PARTITION BY o.customer_id ORDER BY o.created_at,o.id
  ) AS purchase_number,
  sum(t.total_minor) OVER (
    PARTITION BY o.customer_id ORDER BY o.created_at,o.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_minor
FROM orders o JOIN order_totals t ON t.order_id=o.id;
WITH first_purchase AS (
  SELECT customer_id,min(created_at) AS first_day
  FROM orders GROUP BY customer_id
), activity AS (
  SELECT DISTINCT o.customer_id,
    date_trunc('month',f.first_day)::date AS cohort,
    date_trunc('month',o.created_at)::date AS activity_month
  FROM orders o JOIN first_purchase f USING (customer_id)
)
SELECT cohort,activity_month,count(*) AS active_customers
FROM activity GROUP BY cohort,activity_month ORDER BY cohort,activity_month;
SELECT * FROM order_analysis ORDER BY customer_id,created_at,id;
```

La vista obtiene dos filas para Ana: compra 1 de 3000 con acumulado 3000 y compra 2 de 500 con acumulado 3500. El orden incluye `id` para que dos compras en la misma fecha no intercambien posiciones arbitrariamente.

## ROW_NUMBER, RANK y DENSE_RANK responden preguntas distintas

**ROW_NUMBER** asigna posiciones distintas. **RANK** asigna el mismo puesto a valores empatados y deja huecos después. **DENSE_RANK** mantiene empates sin huecos.

Para «las dos últimas compras de cada cliente», necesitas posiciones por cliente y un orden que deshaga empates. Para «los dos niveles de gasto más altos», quizá quieras `DENSE_RANK`. No intercambies estas funciones solo porque las tres devuelven números.

Archivo: sesión `psql`, filtrar después de calcular una ventana.

```sql
WITH ranked AS (
  SELECT id,customer_id,created_at,
    row_number() OVER (
      PARTITION BY customer_id ORDER BY created_at DESC,id DESC
    ) AS position
  FROM db_model.orders
)
SELECT id,customer_id,created_at FROM ranked
WHERE position<=2
ORDER BY customer_id,position;
```

No podemos usar `position` directamente en el `WHERE` del mismo nivel donde se calcula: el filtrado de filas ocurre antes de esa ventana. La CTE establece un nivel posterior desde el que ya se puede filtrar.

## Una CTE da nombre a una etapa, no promete acelerarla

**Common Table Expression** permite nombrar resultados intermedios con `WITH`. En el ejemplo, `first_purchase` responde «¿cuándo compró por primera vez cada cliente?» y `activity` responde «¿en qué meses compró?».

Esas etapas podrían escribirse con subconsultas. La elección favorece que podamos revisar el grano y probar cada resultado. No son necesariamente tablas temporales materializadas: PostgreSQL puede integrar ciertas CTE en la consulta y tiene reglas para `MATERIALIZED` y `NOT MATERIALIZED`. El plan real decide qué coste tiene. [WITH queries](https://www.postgresql.org/docs/18/queries-with.html).

Una CTE tampoco convierte una consulta difícil en correcta automáticamente. Si su primera etapa duplica pedidos, la ventana acumulará esas duplicaciones con precisión.

## Una cohorte necesita una definición de entrada y de actividad

Una **cohort** agrupa entidades según un acontecimiento inicial. Aquí elegimos el mes de primera compra. No es necesariamente el mes de registro ni el de primera visita.

`SELECT DISTINCT customer_id, cohort, activity_month` conserva una actividad por cliente y mes. Sin ese paso, tres pedidos de una persona contarían como tres clientes activos.

El ejemplo produce una persona activa en enero y una en febrero, ambas de la cohorte de enero. Son conteos, no una tasa de retención publicada como indicador de negocio.

Para calcular retención, divide clientes activos de cada mes por el tamaño inicial de la misma cohorte. Debes representar también meses con cero actividad, fijar zona horaria si usas timestamps y distinguir meses aún no observados de abandono real. La cohorte reciente no ha tenido el mismo tiempo para volver que una antigua.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-analytics/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

El cálculo conserva una fila por pedido y un acumulado por cliente. No garantiza eficiencia sin índices y un plan apropiado. Tampoco demuestra una tendencia con dos compras ficticias.

Las pruebas automáticas del laboratorio comprueban que se conservan las filas y que el último acumulado es 3500. Los rankings y cohortes son definiciones analíticas que debes validar con ejemplos de empates, meses vacíos y clientes nuevos antes de usarlas en producto.

## Ejercicio: empates y un mes sin compras

Añade dos compras en la misma fecha y comprueba que `created_at,id` produce un orden repetible. Después construye una cuadrícula de meses desde enero hasta marzo: marzo debe figurar con cero actividad, no desaparecer.

Acepta el ejercicio cuando puedas explicar por qué contar filas de pedidos no equivale a contar clientes. Si los mismos datos empiezan a repetirse entre tablas, continúa con [normalización y desnormalización](/posts/normalizacion-desnormalizacion-datos).

## Referencias

PostgreSQL 18, consultado el 17 de octubre de 2026: [window functions](https://www.postgresql.org/docs/18/tutorial-window.html), [CTE](https://www.postgresql.org/docs/18/queries-with.html), [orden de resultados](https://www.postgresql.org/docs/18/queries-order.html) y [procesamiento de expresiones de tabla](https://www.postgresql.org/docs/18/queries-table-expressions.html).
