type Principal = { tenant: string; user: string; role: 'reader' | 'admin' }
type Resource = { tenant: string; owner: string }

export function canRead(principal: Principal, resource: Resource): boolean {
  if (principal.tenant !== resource.tenant) return false
  return principal.role === 'admin' || principal.user === resource.owner
}

// Contrato de esta demo: cookie de sesión, un único origen y token ligado a sesión.
export function allowMutation(
  origin: string | undefined,
  token: string,
  sessionToken: string,
): boolean {
  return origin === 'https://shop.example' && token.length > 0 && token === sessionToken
}

export function allowedDestination(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (
      url.origin === 'https://provider.example' &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}
