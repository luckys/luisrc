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
