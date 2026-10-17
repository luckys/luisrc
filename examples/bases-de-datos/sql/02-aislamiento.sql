DROP SCHEMA IF EXISTS db_isolation CASCADE;
CREATE SCHEMA db_isolation;
CREATE TABLE db_isolation.accounts (id integer PRIMARY KEY, balance bigint NOT NULL);
INSERT INTO db_isolation.accounts VALUES (1,10000);
CREATE TABLE db_isolation.on_call (id integer PRIMARY KEY, active boolean NOT NULL);
INSERT INTO db_isolation.on_call VALUES (1,true),(2,true);
