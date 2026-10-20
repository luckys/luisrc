import { startLab } from './lab.mjs'
import { createCredentials, identifyClient } from './credentials.mjs'
import { createCredentialClient } from './credential-client.mjs'

export async function observeRotation() {
  let time = 0
  const credentials = createCredentials({ now: () => time })
  const metadata = {
    subject: 'sync-north',
    tenantId: 'north',
    scopes: ['documents:read'],
    ttlMs: 20000,
  }
  const old = credentials.issue(metadata)
  const lab = await startLab({ identify: identifyClient(credentials) })
  const events = []
  const observations = []
  let source = { version: 'v1', token: old.token }
  const client = createCredentialClient({
    origin: lab.origin,
    tenantId: 'north',
    readSecret: async () => source,
    audit: (event) => events.push(event),
  })
  const status = async (token) =>
    (
      await fetch(`${lab.origin}/tenants/north/documents/d1`, {
        headers: { authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(1000),
      })
    ).status
  const observe = async (stage, next) =>
    observations.push({
      stage,
      old: await status(old.token),
      next: next ? await status(next.token) : null,
      client: (await client.getDocument()).status,
    })
  try {
    await client.reload()
    await observe('initial')
    const next = credentials.issue(metadata)
    await observe('overlap', next)
    source = { version: 'v2', token: next.token }
    await client.reload()
    await observe('reloaded', next)
    credentials.revoke(old.id)
    await observe('revoked', next)
    time = 20000
    await observe('expired', next)
    return { kind: 'local-http-logical-clock', observations, events }
  } finally {
    await lab.close()
  }
}
