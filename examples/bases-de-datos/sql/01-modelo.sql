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
