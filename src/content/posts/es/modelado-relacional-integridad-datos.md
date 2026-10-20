---
id: DB-MODEL
title: 'Modelado relacional e integridad: qué reglas debe proteger la base de datos'
published: 2026-10-17T00:00:00Z
locale: es
translationKey: database-relational-modeling-integrity
slug: modelado-relacional-integridad-datos
draft: true
status: draft
level: intermedio
prerequisites: [DB-ACID, DB-TRANSACTIONS]
description: 'Diseña tablas, relaciones y constraints con un ejemplo de pedidos. Aprende qué garantizan PK, FK, CHECK y UNIQUE, y qué sigue dependiendo de la aplicación.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['bases-de-datos', 'postgresql', 'modelado', 'sql', 'integridad']
---

Una API rechaza pedidos con cantidades negativas. Un script de importación no pasa por esa API y termina guardando uno. La validación funcionaba, pero solo para una de las puertas de entrada.

El **modelado relacional** no consiste únicamente en repartir campos entre tablas. También decide qué significan los datos y qué estados debe rechazar la base de datos, independientemente de quién los escriba.

Este es el tercer artículo de **Fundamentos de bases de datos**. Después de [ACID](/posts/propiedades-acid-bases-de-datos) y [transacciones](/posts/transacciones-postgresql-ejemplos-practicos), vamos a definir las reglas que aquellas operaciones deben conservar. Necesitas SQL elemental. Al terminar podrás dibujar relaciones, expresarlas con **constraints** y distinguir integridad estructural de reglas de negocio.

## Antes de crear tablas, escribe las reglas

Usaremos una tienda ficticia que vende exclusivamente en euros. Un cliente puede tener varios pedidos; cada pedido pertenece a un cliente. Un producto puede aparecer en muchos pedidos y un pedido puede contener varios productos.

Es una relación **many-to-many** entre pedidos y productos. La tabla intermedia `order_items` representa cada línea y contiene datos de esa relación: cantidad y precio acordado.

<img src="/assets/visuals/database-series/modelo.svg" alt="Customers tiene una relación uno a muchos con Orders. Orders y Products se conectan mediante Order items, que guarda cantidad y precio histórico." width="1490" height="422" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/modelo.svg).

La **cardinalidad** expresa cuántas entidades pueden participar. No es lo mismo «un pedido tiene un cliente» que «un cliente tiene exactamente un pedido». Confundir ambas frases puede acabar en una restricción `UNIQUE` que impida compras legítimas.

Decidimos también que un producto aparece una sola vez por pedido: si alguien compra dos libros, tendrá una línea con cantidad dos. Es una decisión del ejemplo, no una regla universal. Una tienda que distingue lotes o descuentos por línea necesitaría otra identidad.

## Un laboratorio local, sin servicios externos

[Consulta el laboratorio de la serie en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/sql/01-modelo.sql), clona el repositorio y entra en `packages/database-fundamentals/`. Necesitas Docker con Compose. Para ejecutar las pruebas automáticas necesitarás además Node.js 22.12 o superior; no requieren instalar paquetes.

Archivo: `database-fundamentals/`, comandos de terminal.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/01-modelo.sql
```

El Compose fija imágenes por digest, no publica puertos y monta `sql/` en modo lectura. Las credenciales son ficticias. Cada script reinicia **solo su esquema didáctico**: no lo ejecutes contra una base de datos real.

## De las reglas al esquema SQL

Archivo: `database-fundamentals/sql/01-modelo.sql`.

```sql
-- Destructivo solo para el esquema ficticio de este capítulo.
DROP SCHEMA IF EXISTS db_model CASCADE;
CREATE SCHEMA db_model;
SET search_path TO db_model;
CREATE TABLE customers (
  id integer PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  email text NOT NULL UNIQUE
);
CREATE TABLE products (
  sku text PRIMARY KEY,
  name text NOT NULL,
  price_minor bigint NOT NULL CHECK (price_minor >= 0)
);
CREATE TABLE orders (
  id integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id),
  currency text NOT NULL CHECK (currency = 'EUR'),
  created_at date NOT NULL
);
CREATE TABLE order_items (
  order_id integer NOT NULL REFERENCES orders(id),
  sku text NOT NULL REFERENCES products(sku),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  PRIMARY KEY (order_id, sku)
);
INSERT INTO customers VALUES
  (1,'Ana','ana@example.test'),(2,'Luis','luis@example.test'),(3,'Eva','eva@example.test');
INSERT INTO products VALUES ('BOOK','Libro',1000),('PEN','Bolígrafo',500);
INSERT INTO orders VALUES (10,1,'EUR','2026-01-05'),(11,1,'EUR','2026-02-02');
INSERT INTO order_items VALUES (10,'BOOK',2,1000),(10,'PEN',2,500),(11,'PEN',1,500);
```

La **primary key** identifica una fila. La clave compuesta de `order_items` identifica una combinación de pedido y producto. Una clave artificial por sí sola no impediría repetir esa combinación.

Las **foreign keys** impiden referencias inexistentes. No elegimos `ON DELETE CASCADE`: borrar un cliente con pedidos debe rechazarse hasta que exista una política explícita. Borrar historial como efecto secundario de eliminar un perfil sería una decisión importante, no un detalle de sintaxis.

`price_minor` y `unit_price_minor` parecen duplicados, pero describen hechos distintos. El primero es el precio actual del catálogo; el segundo es el precio histórico acordado en la compra. Cambiar el catálogo no debe reescribir una factura antigua.

## CHECK, NOT NULL y UNIQUE no son intercambiables

Un **CHECK** comprueba una condición sobre la fila, pero una expresión que resulte `NULL` no la rechaza. Por eso `CHECK (quantity > 0)` va acompañado de **NOT NULL**. [Constraints de PostgreSQL](https://www.postgresql.org/docs/18/ddl-constraints.html).

**UNIQUE** protege la unicidad declarada, incluso si varias sesiones intentan insertar a la vez. En PostgreSQL, por defecto admite varios valores nulos; `NULLS NOT DISTINCT` permite cambiar esa política. La unicidad textual del email tampoco resuelve por sí sola mayúsculas, espacios o equivalencias: hay que definir una normalización compatible con el producto.

La validación de la aplicación sigue siendo útil para devolver errores claros. La restricción tiene otro propósito: impedir que quede persistido un estado inválido. Comprobar antes con `SELECT` no sustituye a la constraint porque otra sesión puede escribir entre la comprobación y el `INSERT`.

## Intenta guardar lo que el modelo prohíbe

Abre `psql` con `docker compose exec postgres psql -X -U lab -d series_lab`. Ejecuta estas sentencias **por separado, fuera de un BEGIN**, para que un fallo no aborte las siguientes.

Archivo: sesión interactiva de `psql`, casos deliberadamente inválidos.

```sql
INSERT INTO db_model.orders VALUES (99,999,'EUR','2026-01-01');
INSERT INTO db_model.products VALUES ('BAD','Inválido',-1);
INSERT INTO db_model.customers VALUES (4,'Otra Ana','ana@example.test');
```

La referencia inexistente se rechaza con `23503`, el precio negativo con `23514` y el email repetido con `23505`. Puedes comprobar estas condiciones ejecutando `node --test tests/lab.test.mjs` desde el laboratorio. Las pruebas consultan el estado de PostgreSQL, no solo la respuesta de una función.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/db-model/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/database-fundamentals
```

## Garantías y límites

El esquema impide líneas con cantidad cero, productos inexistentes y asociaciones duplicadas. **No exige que un pedido tenga al menos una línea**: la foreign key protege de la línea hacia el pedido, no en sentido inverso. Tampoco verifica autorizaciones del usuario ni el estado de un cobro externo.

Una regla entre varias filas puede requerir un protocolo transaccional y control de concurrencia. No conviene esconder consultas a otras tablas dentro de un `CHECK` esperando que se reevalúen cuando cualquiera cambie.

Frente a un único documento JSON, las tablas facilitan declarar estas relaciones. Frente a un esquema excesivamente fragmentado, tienen un coste en joins y evolución. Empieza por hechos y reglas identificables; la [normalización](/posts/normalizacion-desnormalizacion-datos) ayudará a revisar dependencias, sin convertir «más tablas» en objetivo.

## Ejercicio: una referencia externa con ámbito

Añade referencias de importación únicas **por proveedor**, no globalmente. Deben aceptarse `('a','123')` y `('b','123')`, pero rechazarse dos `('a','123')`. Decide si el identificador puede ser nulo y prueba esa decisión.

El criterio de aceptación incluye dos inserciones simultáneas de la misma combinación: solo una puede persistirse. Ese caso conecta con [aislamiento y MVCC](/posts/aislamiento-mvcc-postgresql), donde veremos qué observa cada sesión mientras otra escribe.

## Referencias

Documentación de PostgreSQL 18, consultada el 17 de octubre de 2026: [constraints](https://www.postgresql.org/docs/18/ddl-constraints.html), [tablas](https://www.postgresql.org/docs/18/ddl-basics.html) y [schemas](https://www.postgresql.org/docs/18/ddl-schemas.html). El laboratorio en GitHub contiene las versiones exactas y las comprobaciones.
