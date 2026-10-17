DROP SCHEMA IF EXISTS db_concurrency CASCADE;
CREATE SCHEMA db_concurrency;
CREATE TABLE db_concurrency.stock (
  id integer PRIMARY KEY,
  available integer NOT NULL CHECK (available >= 0),
  version integer NOT NULL DEFAULT 1
);
INSERT INTO db_concurrency.stock VALUES (1,1,1),(2,1,1);
CREATE TABLE db_concurrency.reservations (
  resource_id integer NOT NULL,
  user_id integer NOT NULL,
  PRIMARY KEY (resource_id)
);
