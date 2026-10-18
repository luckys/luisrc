export function formatOrder(row, version, change = 'additive') {
  const common = {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    status: row.status,
  }
  if (version === 'v2' || change === 'breaking')
    return { ...common, money: { minorUnits: row.amount_minor, currency: row.currency } }
  return {
    ...common,
    amountMinor: row.amount_minor,
    currency: row.currency,
    ...(change === 'additive' ? { label: row.description } : {}),
  }
}
