import { parseCredential } from './credentials.mjs'

export function createCredentialClient({
  origin,
  tenantId,
  readSecret,
  audit = () => {},
}) {
  const url = new URL(origin)
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.origin !== origin ||
    !['north', 'south'].includes(tenantId)
  ) {
    throw new RangeError('Only the local fixture origin is allowed')
  }
  const endpoint = `${origin}/tenants/${tenantId}/documents/d1`
  let current
  let loading
  const report = (event) => {
    // La disponibilidad del audit no cambia la credencial seleccionada.
    try {
      audit(event)
    } catch {
      /* Política explícita del laboratorio. */
    }
  }
  const request = async (token) => {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(1000),
    })
    return { status: response.status, body: await response.json() }
  }
  async function load() {
    try {
      const candidate = await readSecret()
      if (
        !candidate ||
        typeof candidate.version !== 'string' ||
        !/^v[1-9]\d{0,5}$/.test(candidate.version) ||
        typeof candidate.token !== 'string' ||
        !parseCredential(`Bearer ${candidate.token}`)
      )
        throw new Error('Invalid candidate')
      // Copiar antes del await impide que el source cambie el objeto comprobado.
      const next = { version: candidate.version, token: candidate.token }
      if ((await request(next.token)).status !== 200) throw new Error('Probe failed')
      current = next
      report({ event: 'secret_loaded', version: next.version })
    } catch {
      report({ event: 'secret_reload_failed' })
      throw new Error('credential_reload_failed')
    }
  }
  return {
    reload() {
      // Dos recargas simultáneas comparten una lectura, no compiten por sobrescribirse.
      if (!loading)
        loading = load().finally(() => {
          loading = undefined
        })
      return loading
    },
    async getDocument() {
      if (!current) throw new Error('credential_not_loaded')
      return request(current.token)
    },
  }
}
