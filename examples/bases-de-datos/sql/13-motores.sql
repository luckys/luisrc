\ir 01-modelo.sql
SELECT o.id,jsonb_build_object(
  'customer_id',o.customer_id,
  'currency',o.currency,
  'items',jsonb_agg(jsonb_build_object('sku',i.sku,'quantity',i.quantity)
    ORDER BY i.sku)
) AS document
FROM db_model.orders o JOIN db_model.order_items i ON i.order_id=o.id
GROUP BY o.id ORDER BY o.id;
