export const firstPageSQL = `SELECT id, tenant_id, status, created_at, amount_minor, currency, description
FROM orders
WHERE tenant_id = $1 AND status = $2
ORDER BY created_at DESC, id DESC
LIMIT $3`

export const nextPageSQL = `SELECT id, tenant_id, status, created_at, amount_minor, currency, description
FROM orders
WHERE tenant_id = $1 AND status = $2
  AND (created_at, id) < ($3::timestamptz, $4::bigint)
ORDER BY created_at DESC, id DESC
LIMIT $5`

export const offsetSQL = `SELECT id, tenant_id, status, created_at, amount_minor, currency, description
FROM orders
WHERE tenant_id = $1 AND status = $2
ORDER BY created_at DESC, id DESC
LIMIT $3 OFFSET $4`
