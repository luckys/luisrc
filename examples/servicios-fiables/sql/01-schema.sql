-- Reinicia SOLO el esquema ficticio del laboratorio, nunca usar con datos reales.
DROP SCHEMA IF EXISTS reliable_lab CASCADE;
CREATE SCHEMA reliable_lab;
SET search_path TO reliable_lab;
CREATE TABLE operations (
  id text PRIMARY KEY,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency = 'EUR'),
  state text NOT NULL CHECK (state IN ('created','processing','unknown','succeeded','failed')),
  version integer NOT NULL DEFAULT 1
);
CREATE TABLE idempotency (
  scope text NOT NULL,
  key text NOT NULL,
  fingerprint text NOT NULL,
  operation_id text NOT NULL REFERENCES operations(id),
  PRIMARY KEY (scope, key)
);
CREATE TABLE outbox (
  id text PRIMARY KEY,
  operation_id text NOT NULL REFERENCES operations(id),
  type text NOT NULL,
  published_at timestamptz
);
CREATE TABLE inbox (
  consumer text NOT NULL,
  event_id text NOT NULL,
  PRIMARY KEY (consumer,event_id)
);
CREATE TABLE projection (
  operation_id text PRIMARY KEY,
  notifications integer NOT NULL DEFAULT 0
);
