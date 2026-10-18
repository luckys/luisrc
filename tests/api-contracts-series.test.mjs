import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { simulateChange } from '../examples/api-paginacion-evolucion/model.mjs'
import YAML from 'yaml'

const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
test('APIs: doce entregas españolas, extractos reales y esquemas compartidos', async () => {
  assert.deepEqual(
    manifest.articles.map((x) => x.id),
    [
      'P020',
      'P021',
      'P022',
      'API-VALIDATION-ZOD',
      'API-VALIDATION-PYDANTIC',
      'P023',
      'API-ERROR-LOGGING',
      'P024',
      'API-PAGINATION-CONSISTENCY',
      'API-PAGINATION-PERFORMANCE',
      'P025',
      'API-VERSION-MIGRATION',
    ],
  )
  const source = (await readFile('examples/api-contratos/server.mjs', 'utf8')).replace(
    /\s/g,
    '',
  )
  const api = JSON.parse(await readFile('examples/api-contratos/openapi.json', 'utf8'))
  const validationSource = (
    await Promise.all(
      ['validation.mjs', 'problems.mjs', 'service.mjs', 'server.mjs'].map((file) =>
        readFile(`examples/api-validacion-errores/${file}`, 'utf8'),
      ),
    )
  )
    .join('\n')
    .replace(/\s/g, '')
  const python = (
    await readFile('examples/api-validacion-errores/validation.py', 'utf8')
  ).replace(/\s/g, '')
  const schema = JSON.parse(
    await readFile('examples/api-validacion-errores/reservation.schema.json', 'utf8'),
  )
  let snippets = 0
  let pythonSnippets = 0
  let sqlSnippets = 0
  const paginationSource = (
    await Promise.all(
      [
        'queries.mjs',
        'schema.sql',
        'tests/postgres.test.mjs',
        'representations.mjs',
        'clients.mjs',
      ].map((file) => readFile(`examples/api-paginacion-evolucion/${file}`, 'utf8')),
    )
  )
    .join('\n')
    .replace(/\s/g, '')
  for (const entry of manifest.articles) {
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const metadata = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title', 'prerequisites'])
      assert.deepEqual(metadata[key], entry[key])
    assert.equal(metadata.locale, 'es')
    assert.equal(metadata.author, 'Luis Ramírez Calle')
    assert.equal(metadata.draft, true)
    assert.equal(metadata.status, 'draft')
    assert.equal(metadata.series, manifest.name)
    for (const [, slug] of text.matchAll(/\]\(\/posts\/([^/)#]+)(?:#[^)]*)?\)/g))
      await readFile(`src/content/posts/es/${slug}.md`, 'utf8')
    for (const heading of ['Garantías y límites', 'Ejercicio:', 'Referencias'])
      assert.ok(text.includes(`## ${heading}`))
    assert.ok(!text.includes('—'))
    assert.ok(text.split(/\s+/).length > 1100)
    for (const [, snippet] of text.matchAll(/```javascript\n([\s\S]*?)\n```/g)) {
      assert.ok(
        (source + validationSource + paginationSource).includes(
          snippet.replace(/\s/g, ''),
        ),
        snippet,
      )
      snippets++
    }
    for (const [, snippet] of text.matchAll(/```json\n([\s\S]*?)\n```/g))
      assert.deepEqual(
        JSON.parse(snippet),
        entry.id === 'P022' ? schema.allOf[0] : api.components.schemas.OrderInput,
      )
    for (const [, snippet] of text.matchAll(/```python\n([\s\S]*?)\n```/g)) {
      assert.ok(python.includes(snippet.replace(/\s/g, '')))
      pythonSnippets++
    }
    for (const [, snippet] of text.matchAll(/```sql\n([\s\S]*?)\n```/g)) {
      assert.ok(paginationSource.includes(snippet.replace(/\s/g, '')), snippet)
      sqlSnippets++
    }
    for (const [, asset, width, height] of text.matchAll(
      /<img src="([^"]+)"[^>]+width="(\d+)" height="(\d+)"/g,
    )) {
      const svg = await readFile(`public${asset}`, 'utf8')
      const [w, h] = svg.includes('viewBox=')
        ? svg
            .match(/viewBox="([^"]+)"/)[1]
            .split(/\s+/)
            .map(Number)
            .slice(2)
        : [+svg.match(/width="(\d+)"/)[1], +svg.match(/height="(\d+)"/)[1]]
      assert.equal(+width, Math.ceil(w))
      assert.equal(+height, Math.ceil(h))
    }
  }
  assert.equal(snippets, 9)
  assert.equal(pythonSnippets, 3)
  assert.equal(sqlSnippets, 4)
})

test('APIs: la división conserva seis URLs y seis fichas; Python es una ruta opcional', async () => {
  const counts = {}
  const positions = new Map(manifest.articles.map((entry, index) => [entry.id, index]))
  const dates = []
  for (const [index, entry] of manifest.articles.entries()) {
    counts[entry.roadmapId] = (counts[entry.roadmapId] ?? 0) + 1
    const text = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const metadata = YAML.parse(text.match(/^---\n([\s\S]*?)\n---/)[1])
    dates.push(new Date(metadata.published).getTime())
    for (const prerequisite of entry.prerequisites)
      if (positions.has(prerequisite)) assert.ok(positions.get(prerequisite) < index)
    if (entry.id !== 'API-VALIDATION-PYDANTIC')
      assert.ok(!entry.prerequisites.includes('API-VALIDATION-PYDANTIC'))
    const body = text.replace(/^---\n[\s\S]*?\n---/, '')
    assert.equal(
      [...body.matchAll(/<img /g)].length,
      entry.id === 'API-PAGINATION-PERFORMANCE' ? 2 : 1,
      entry.id,
    )
  }
  assert.deepEqual(counts, { P020: 1, P021: 1, P022: 3, P023: 2, P024: 3, P025: 2 })
  assert.deepEqual(
    dates,
    dates.toSorted((a, b) => a - b),
  )
  assert.equal(new Set(dates).size, 12)
  assert.deepEqual(
    manifest.articles.filter((entry) => entry.optional).map((entry) => entry.id),
    ['API-VALIDATION-PYDANTIC'],
  )
  const preserved = {
    P020: 'api-contrato-esquema-clientes',
    P021: 'recursos-http-metodos-idempotencia',
    P022: 'validacion-runtime-json-schema-zod-pydantic',
    P023: 'errores-api-problem-details-stock-concurrencia',
    P024: 'paginacion-offset-keyset-postgresql-concurrencia',
    P025: 'evolucion-api-versiones-consumidores-contratos',
  }
  for (const [id, slug] of Object.entries(preserved))
    assert.equal(manifest.articles.find((entry) => entry.id === id).slug, slug)
  const metrics = await readFile(
    'src/content/posts/es/paginacion-postgresql-indices-explain-mediciones.md',
    'utf8',
  )
  assert.ok(metrics.includes('pagination-timings.svg'))
  const entry = await readFile(
    'src/content/posts/es/paginacion-offset-keyset-postgresql-concurrencia.md',
    'utf8',
  )
  assert.ok(!entry.includes('pagination-timings.svg'))
  assert.ok(!entry.includes('## Keyset no congela'))
  const schemaArticle = await readFile(
    'src/content/posts/es/validacion-runtime-json-schema-zod-pydantic.md',
    'utf8',
  )
  assert.ok(!schemaArticle.includes('## Zod valida'))
  assert.ok(!schemaArticle.includes('## Pydantic necesita'))
  const errors = await readFile(
    'src/content/posts/es/errores-api-problem-details-stock-concurrencia.md',
    'utf8',
  )
  assert.ok(!errors.includes('## Request ID permite'))
  const contracts = await readFile(
    'src/content/posts/es/evolucion-api-versiones-consumidores-contratos.md',
    'utf8',
  )
  assert.ok(!contracts.includes('## Deprecar comunica'))
  assert.ok(!contracts.includes('## SemVer del SDK'))
})

test('paginación/evolución: ZIP y visor públicos contienen los mismos archivos probados', async () => {
  const archive = 'public/assets/examples/api-paginacion-evolucion-lab.zip'
  const files = JSON.parse(
    await readFile('assets/api-contracts/pagination-download-manifest.json', 'utf8'),
  )
  assert.equal(files.length, 24)
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    files.toSorted(),
  )
  for (const file of files)
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-paginacion-evolucion/${file}`),
    )
  for (const file of ['model.mjs', 'explorer.mjs', 'explorer.html'])
    assert.deepEqual(
      await readFile(`public/assets/interactive/api-pagination/${file}`),
      await readFile(`examples/api-paginacion-evolucion/${file}`),
    )
})

test('paginación: muestras/planes y tabla son recalculables; el visor reproduce el caso observado', async () => {
  const directory = 'examples/api-paginacion-evolucion'
  const results = JSON.parse(
    await readFile(`${directory}/results/experiments.json`, 'utf8'),
  )
  const article = await readFile(
    'src/content/posts/es/paginacion-postgresql-indices-explain-mediciones.md',
    'utf8',
  )
  assert.equal(results.rows, 1000000)
  assert.equal(results.qualifyingRows, 400000)
  for (const [file, hash] of Object.entries(results.sourceHashes))
    assert.equal(
      createHash('sha256')
        .update(await readFile(`${directory}/${file}`))
        .digest('hex'),
      hash,
    )
  assert.deepEqual(
    results.cases.map((x) => x.offset),
    [0, 10000, 100000, 300000],
  )
  for (const entry of results.cases) {
    assert.equal(entry.samples.length, 7)
    assert.equal(entry.sameIds, true)
    assert.equal(entry.anchorCostIncluded, false)
    for (const [index, sample] of entry.samples.entries()) {
      assert.deepEqual(
        Object.keys(sample),
        index % 2 ? ['keyset', 'offset'] : ['offset', 'keyset'],
      )
      for (const strategy of ['offset', 'keyset']) {
        assert.equal(sample[strategy].ms, sample[strategy].plan[0]['Execution Time'])
        assert.equal(sample[strategy].scan, 'Index Only Scan')
        assert.equal(
          sample[strategy].scanOutputRows,
          strategy === 'offset' ? entry.offset + 50 : 50,
        )
      }
    }
    const medians = ['offset', 'keyset'].map((strategy) =>
      entry.samples
        .map((sample) => sample[strategy].ms)
        .toSorted((a, b) => a - b)[3]
        .toFixed(3)
        .replace('.', ','),
    )
    const tableRow = article
      .split('\n')
      .find(
        (line) =>
          line.startsWith('|') &&
          line.split('|')[1].trim() === entry.offset.toLocaleString('es-ES'),
      )
    assert.ok(tableRow)
    assert.deepEqual(
      tableRow
        .split('|')
        .slice(2, 4)
        .map((value) => value.trim()),
      medians,
    )
  }
  const model = simulateChange('insert')
  for (const field of ['first', 'offset', 'keyset'])
    assert.deepEqual(model[field], results.concurrent[field])
  assert.equal(results.concurrent.connectionsDistinct, true)
  assert.deepEqual(results.concurrent.offsetOverlap, ['999988'])
  assert.deepEqual(results.concurrent.keysetOverlap, [])
})

test('APIs: ZIP con inventario exacto y archivos idénticos al laboratorio', async () => {
  const archive = 'public/assets/examples/api-contratos-lab.zip'
  const files = JSON.parse(
    await readFile('assets/api-contracts/download-manifest.json', 'utf8'),
  )
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    [...files].sort(),
  )
  for (const file of files)
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-contratos/${file}`),
    )
})

test('validación/errores: ZIP reproducible con lockfile, sin dependencias instaladas', async () => {
  const archive = 'public/assets/examples/api-validacion-errores-lab.zip'
  const files = JSON.parse(
    await readFile('assets/api-contracts/validation-download-manifest.json', 'utf8'),
  )
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort(),
    [...files].sort(),
  )
  assert.ok(files.includes('pnpm-lock.yaml'))
  assert.ok(!files.some((file) => /node_modules|__pycache__/.test(file)))
  for (const file of files)
    assert.deepEqual(
      execFileSync('unzip', ['-p', archive, file]),
      await readFile(`examples/api-validacion-errores/${file}`),
    )
})
