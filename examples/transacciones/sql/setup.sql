CREATE SCHEMA IF NOT EXISTS concept_examples;
SET search_path TO concept_examples;

CREATE TABLE IF NOT EXISTS accounts (
  id integer PRIMARY KEY,
  balance_minor bigint NOT NULL CHECK (balance_minor >= 0)
);
CREATE TABLE IF NOT EXISTS inventory (
  sku text PRIMARY KEY,
  available integer NOT NULL CHECK (available >= 0)
);
CREATE TABLE IF NOT EXISTS documents (
  id integer PRIMARY KEY,
  body text NOT NULL
);

-- Reinicia únicamente las tablas ficticias de estos ejemplos.
TRUNCATE accounts, inventory, documents;
INSERT INTO accounts VALUES (1, 10000), (2, 5000);
INSERT INTO inventory VALUES ('T_SHIRT', 1);
INSERT INTO documents VALUES (1, 'draft');
