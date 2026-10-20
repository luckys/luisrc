import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
const entries = manifest.articles.filter((entry) => entry.roadmapId === 'P030')

test('amenazas: nueve entregas específicas con código real, diagramas y límites explícitos', async () => {
  assert.deepEqual(
    entries.map((entry) => entry.id),
    [
      'P030',
      'API-THREATS-ASSIGNMENT',
      'API-THREATS-SQL',
      'API-THREATS-SSRF',
      'API-THREATS-DNS',
      'API-THREATS-CAPACITY',
      'API-THREATS-RATE',
      'API-THREATS-CREDENTIALS',
      'API-THREATS-SECRETS',
    ],
  )
  const code = (
    await Promise.all(
      [
        'command.mjs',
        'store.mjs',
        'importer.mjs',
        'admission.mjs',
        'credentials.mjs',
        'credential-client.mjs',
      ].map((file) => readFile(`examples/api-amenazas/${file}`, 'utf8')),
    )
  )
    .join('\n')
    .replace(/\s/g, '')
  let snippets = 0
  for (const entry of entries) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const meta = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'title', 'slug', 'prerequisites'])
      assert.deepEqual(meta[key], entry[key])
    assert.equal(meta.locale, 'es')
    assert.equal(meta.draft, true)
    assert.equal(meta.status, 'draft')
    assert.equal(meta.author, 'Luis Ramírez Calle')
    assert.equal(meta.series, manifest.name)
    assert.ok(!text.includes('—'))
    for (const heading of ['Garantías y límites', 'Ejercicio:', 'Referencias'])
      assert.ok(text.includes(`## ${heading}`), entry.id)
    assert.ok(text.includes('/assets/examples/api-amenazas-lab.zip'))
    for (const [, snippet] of text.matchAll(/```javascript\n([\s\S]*?)\n```/g)) {
      assert.ok(
        code.includes(snippet.replace(/\s/g, '')),
        `${entry.id}: extracto obsoleto`,
      )
      snippets++
    }
    for (const [, slug] of text.matchAll(/\]\(\/posts\/([^/)#]+)(?:#[^)]*)?\)/g))
      await readFile(`src/content/posts/es/${slug}.md`)
    const images = [
      ...text.matchAll(/<img src="([^"]+)" alt="([^"]+)" width="(\d+)" height="(\d+)"/g),
    ]
    assert.equal(images.length, 1)
    for (const [, asset, alt, width, height] of images) {
      assert.ok(alt.length > 80)
      const svg = await readFile(`public${asset}`, 'utf8')
      const [, , w, h] = svg
        .match(/viewBox="([^"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(+width, Math.ceil(w))
      assert.equal(+height, Math.ceil(h))
      await readFile(`assets/api-contracts/${entry.id}.d2`)
    }
  }
  assert.equal(snippets, 14)
  const model = JSON.parse(
    await readFile('examples/api-amenazas/threat-model.json', 'utf8'),
  )
  assert.deepEqual(
    model.threats.filter((t) => t.state === 'pending').map((t) => t.id),
    [],
  )
  for (const threat of model.threats) {
    for (const key of ['scenario', 'asset', 'priority', 'owner', 'control', 'residual'])
      assert.ok(threat[key])
    if (threat.state === 'pending') assert.equal(threat.test, null)
    else {
      const source = await readFile(`examples/api-amenazas/${threat.test}`, 'utf8')
      assert.match(source, new RegExp(`test\\(\\s*['"]${threat.id}:`))
    }
  }
})

test('amenazas: ZIP exacto y visor sin servidor; no se distribuyen bases ni credenciales reales', async () => {
  const files = JSON.parse(
    await readFile('assets/api-contracts/threats-download-manifest.json', 'utf8'),
  )
  const archive = 'public/assets/examples/api-amenazas-lab.zip'
  assert.equal(files.length, 40)
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    files.toSorted(),
  )
  for (const file of files) {
    assert.ok(!/node_modules|\.pem|\.env|\.key|\.db$|\.sqlite$/.test(file))
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-amenazas/${file}`),
    )
  }
  for (const file of ['command.mjs', 'explorer.html', 'explorer.css', 'explorer.mjs'])
    assert.deepEqual(
      await readFile(`public/assets/interactive/api-assignment/${file}`),
      await readFile(`examples/api-amenazas/${file}`),
    )
  const readme = await readFile('examples/api-amenazas/README.md', 'utf8')
  for (const limitation of [
    'intencionadamente vulnerable',
    'credenciales públicas',
    'resolver programado',
    'sin TLS',
    'last write wins',
    'parcial',
  ])
    assert.ok(readme.includes(limitation), limitation)
})

test('SSRF: visor muestra evidencia archivada de cinco recorridos, no una API de consultas externas', async () => {
  for (const file of [
    'ssrf-explorer.html',
    'ssrf-explorer.css',
    'ssrf-explorer.mjs',
    'ssrf-evidence.json',
  ])
    assert.deepEqual(
      await readFile(`public/assets/interactive/api-ssrf/${file}`),
      await readFile(`examples/api-amenazas/${file}`),
    )
  const evidence = JSON.parse(
    await readFile('examples/api-amenazas/ssrf-evidence.json', 'utf8'),
  )
  assert.deepEqual(
    evidence.observations.map((row) => [
      row.scenario,
      row.status,
      row.lookups,
      row.providerRequests,
      row.internalRequests,
    ]),
    [
      ['direct', 200, 0, 0, 1],
      ['redirect-unsafe', 200, 1, 1, 1],
      ['redirect-safe', 502, 1, 1, 0],
      ['dns-gap', 200, 2, 0, 1],
      ['pinned', 200, 1, 1, 0],
    ],
  )
  for (const row of evidence.observations) {
    assert.equal(
      row.events.filter((event) => event.kind === 'lookup').length,
      row.lookups,
    )
    for (const destination of ['provider', 'internal'])
      assert.equal(
        row.events.filter(
          (event) => event.kind === 'request' && event.destination === destination,
        ).length,
        row[`${destination}Requests`],
      )
    assert.equal(row.events.at(-1).status, row.status)
  }
  const source = await readFile('examples/api-amenazas/ssrf-explorer.mjs', 'utf8')
  assert.deepEqual(
    [...source.matchAll(/fetch\('([^']+)'/g)].map((match) => match[1]),
    ['./ssrf-evidence.json'],
  )
  assert.ok(source.includes('textContent'))
  assert.ok(!/innerHTML|eval\(/.test(source))
})

test('cuota: visor y algoritmo público coinciden con las fuentes probadas, sin llamadas a una API', async () => {
  for (const file of [
    'admission.mjs',
    'quota-model.mjs',
    'quota-explorer.html',
    'quota-explorer.css',
    'quota-explorer.mjs',
  ])
    assert.deepEqual(
      await readFile(`public/assets/interactive/api-quota/${file}`),
      await readFile(`examples/api-amenazas/${file}`),
    )
  const { simulateQuota } = await import('../examples/api-amenazas/quota-model.mjs')
  assert.deepEqual(
    simulateQuota().map((row) => [row.allowed, row.remaining]),
    [
      [true, 3],
      [true, 2],
      [true, 1],
      [true, 0],
      [false, 0],
      [false, 0.5],
      [true, 0],
      [true, 3],
    ],
  )
  const source = await readFile('examples/api-amenazas/quota-explorer.mjs', 'utf8')
  assert.ok(source.includes('textContent'))
  assert.ok(!/fetch\(|innerHTML|eval\(/.test(source))
  const html = await readFile('examples/api-amenazas/quota-explorer.html', 'utf8')
  assert.ok(html.includes('no segundos'))
  assert.ok(html.includes('No simula el límite de trabajos activos'))
})

test('secretos: evidencia y tabla editorial conservan cinco etapas sin distribuir credenciales', async () => {
  const source = await readFile('examples/api-amenazas/credential-evidence.json', 'utf8')
  const evidence = JSON.parse(source)
  assert.deepEqual(
    evidence.observations.map(({ stage, old, next, client }) => [
      stage,
      old,
      next,
      client,
    ]),
    [
      ['initial', 200, null, 200],
      ['overlap', 200, 200, 200],
      ['reloaded', 200, 200, 200],
      ['revoked', 401, 200, 200],
      ['expired', 401, 401, 401],
    ],
  )
  assert.ok(!/lab1\.|Bearer|digest|token|127\.0\.0\.1/.test(source))
  const post = await readFile(
    'src/content/posts/es/secretos-rotacion-recarga-revocacion.md',
    'utf8',
  )
  assert.match(
    post,
    /role="region" aria-label="Etapas de rotación y respuestas HTTP" tabindex="0"/,
  )
  assert.ok(post.includes('pnpm demo:credentials'))
  const packageJson = JSON.parse(
    await readFile('examples/api-amenazas/package.json', 'utf8'),
  )
  assert.equal(packageJson.scripts['demo:credentials'], 'node demo-credentials.mjs')
})
