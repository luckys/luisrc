\ir 04-consultas.sql
CREATE MATERIALIZED VIEW db_model.customer_summary AS
SELECT * FROM db_model.customer_totals;
CREATE UNIQUE INDEX customer_summary_id ON db_model.customer_summary(id);
-- Alias para mantener explícito el significado de la clave en el experimento.
ALTER MATERIALIZED VIEW db_model.customer_summary RENAME COLUMN id TO customer_id;
SELECT * FROM db_model.customer_summary ORDER BY customer_id;
