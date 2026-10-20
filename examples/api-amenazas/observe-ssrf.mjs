import { startLab } from './lab.mjs'
import { startDestinations, fixedResolver, changingResolver } from './destinations.mjs'
import { createImporter } from './importer.mjs'

export const scenarios = [
  'direct',
  'redirect-unsafe',
  'redirect-safe',
  'dns-gap',
  'pinned',
]

export async function observeScenario(scenario) {
  if (!scenarios.includes(scenario)) throw new Error('Unknown scenario')
  const events = []
  const onEvent = (event) => events.push(event)
  const destinations = await startDestinations({ onEvent })
  const resolver = ['dns-gap', 'pinned'].includes(scenario)
    ? changingResolver(onEvent)
    : fixedResolver(onEvent)
  let lab
  try {
    lab = await startLab({
      importer: createImporter({ ...destinations, resolve: resolver.resolve }),
    })
    const input = { reference: scenario === 'redirect-safe' ? 'redirect' : 'a1' }
    let mode = 'safe'
    if (scenario === 'direct') {
      mode = 'unsafe-url'
      delete input.reference
      input.url = destinations.internalOrigin + '/marker'
    }
    if (scenario === 'redirect-unsafe') {
      mode = 'allowlist-only'
      delete input.reference
      input.url = destinations.providerOrigin + '/redirect'
    }
    if (scenario === 'dns-gap') mode = 'check-then-resolve'
    const response = await fetch(`${lab.origin}/tenants/north/imports?mode=${mode}`, {
      method: 'POST',
      headers: { authorization: 'Bearer demo-alice', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = await response.json()
    events.push({ kind: 'result', status: response.status })
    return {
      scenario,
      status: response.status,
      text: body.text ?? null,
      lookups: resolver.calls,
      providerRequests: destinations.metrics.provider.length,
      internalRequests: destinations.metrics.internal.length,
      events,
    }
  } finally {
    await lab?.close()
    await destinations.close()
  }
}
