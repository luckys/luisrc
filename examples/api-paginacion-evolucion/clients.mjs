function page(value) {
  return (
    value &&
    Array.isArray(value.items) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  )
}
function common(item) {
  return (
    item &&
    typeof item.id === 'string' &&
    typeof item.createdAt === 'string' &&
    ['paid', 'pending'].includes(item.status)
  )
}

export function readV1(value) {
  if (
    !page(value) ||
    !value.items.every(
      (item) =>
        common(item) &&
        Number.isSafeInteger(item.amountMinor) &&
        item.amountMinor > 0 &&
        item.currency === 'EUR',
    )
  )
    throw new Error('contract_v1')
  return value.items.map((item) => item.amountMinor)
}

export function readV2(value) {
  if (
    !page(value) ||
    !value.items.every(
      (item) =>
        common(item) &&
        item.money &&
        Number.isSafeInteger(item.money.minorUnits) &&
        item.money.minorUnits > 0 &&
        item.money.currency === 'EUR',
    )
  )
    throw new Error('contract_v2')
  return value.items.map((item) => item.money.minorUnits)
}
