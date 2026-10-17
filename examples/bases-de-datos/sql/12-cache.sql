DROP SCHEMA IF EXISTS db_cache CASCADE;
CREATE SCHEMA db_cache;
CREATE TABLE db_cache.products (id integer PRIMARY KEY,price_minor bigint NOT NULL);
INSERT INTO db_cache.products VALUES (1,1000);
