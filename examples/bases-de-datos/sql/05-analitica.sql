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
