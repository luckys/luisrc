import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import YAML from 'yaml'
import { trajectory } from '../examples/matematicas-estadistica/simulator.mjs'

const manifest = JSON.parse(await readFile('docs/editorial/math-series.json', 'utf8'))
const normalize = (text) => text.replace(/\s+/g, '')
const result = JSON.parse(
  await readFile('examples/matematicas-estadistica/results/calculations.json', 'utf8'),
)

test('matemáticas: diez drafts españoles, fórmulas habilitadas y dependencias acíclicas', async () => {
  assert.equal(manifest.articles.length, 10)
  const seen = new Set()
  let previous = 0
  for (const [index, entry] of manifest.articles.entries()) {
    assert.equal(entry.id, `P0${76 + index}`)
    for (const prerequisite of entry.prerequisites)
      assert.ok(seen.has(prerequisite), prerequisite)
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const header = YAML.parse(body.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title']) assert.equal(header[key], entry[key])
    assert.equal(header.series, manifest.name)
    assert.equal(header.author, 'Luis Ramírez Calle')
    assert.equal(header.locale, 'es')
    assert.equal(header.draft, true)
    assert.equal(header.status, 'draft')
    assert.equal(header.math, true)
    assert.deepEqual(header.prerequisites, entry.prerequisites)
    const date = new Date(header.published).valueOf()
    assert.ok(date > previous)
    previous = date
    assert.ok(!/PaySafe|—/.test(body))
    for (const section of ['## Garantías y límites', '## Ejercicio:', '## Referencias'])
      assert.ok(body.includes(section), entry.id)
    assert.ok(body.includes('/assets/examples/matematicas-estadistica-lab.zip'))
    const words = body.split(/\s+/).length
    assert.ok(words >= 700 && words < 1600, `${entry.id}: ${words}`)
    seen.add(entry.id)
  }
})

test('matemáticas: recursos y enlaces internos existentes; SVG con dimensiones reales', async () => {
  const slugs = new Set(
    (await readdir('src/content/posts/es'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3)),
  )
  for (const entry of manifest.articles) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, slug] of body.matchAll(/\]\(\/posts\/([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(slugs.has(slug), slug)
    const diagrams = [
      ...body.matchAll(
        /<img src="([^\"]+)" alt="([^\"]+)" width="(\d+)" height="(\d+)"/g,
      ),
    ]
    assert.ok(diagrams.length, entry.id)
    for (const [, path, alt, width, height] of diagrams) {
      assert.ok(alt.length > 40)
      const svg = await readFile(`public${path}`, 'utf8')
      const [, , expectedWidth, expectedHeight] = svg
        .match(/viewBox="([^\"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(Number(width), Math.ceil(expectedWidth))
      assert.equal(Number(height), Math.ceil(expectedHeight))
    }
  }
})

test('matemáticas: extractos publicados coinciden con Python ejecutado', async () => {
  let count = 0
  for (const entry of manifest.articles) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, path, snippet] of body.matchAll(
      /Archivo: `matematicas-estadistica\/([^`]+)`[^\n]*\n\n```python\n([\s\S]*?)\n```/g,
    )) {
      assert.ok(
        normalize(
          await readFile(`examples/matematicas-estadistica/${path}`, 'utf8'),
        ).includes(normalize(snippet)),
        entry.id,
      )
      count++
    }
  }
  assert.equal(count, 10)
})

test('matemáticas: ZIP contiene todo el laboratorio y excluye bytecode', async () => {
  async function collect(directory) {
    const files = []
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (
        item.name.startsWith('.') ||
        item.name === '__pycache__' ||
        item.name.endsWith('.pyc')
      )
        continue
      const path = `${directory}/${item.name}`
      if (item.isDirectory()) files.push(...(await collect(path)))
      else if (item.isFile()) files.push(path.replace(/^examples\//, ''))
    }
    return files
  }
  const paths = JSON.parse(
    await readFile('assets/math-series/download-manifest.json', 'utf8'),
  ).paths
  assert.deepEqual(
    [...paths].sort(),
    (await collect('examples/matematicas-estadistica')).sort(),
  )
  const zip = 'public/assets/examples/matematicas-estadistica-lab.zip'
  const actual = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
    .trim()
    .split('\n')
  assert.deepEqual(actual.sort(), [...paths].sort())
  assert.ok(paths.includes('matematicas-estadistica/simulator.html'))
  assert.ok(paths.includes('matematicas-estadistica/tests/test_foundations.py'))
  for (const path of paths) {
    assert.ok(!/\.pyc|__pycache__|\.env|node_modules/.test(path))
    assert.deepEqual(
      execFileSync('unzip', ['-p', zip, path]),
      await readFile(`examples/${path}`),
      path,
    )
  }
})

test('matemáticas: cálculos archivados coinciden con la ejecución y valores conocidos', () => {
  const actual = JSON.parse(
    execFileSync('python3', ['experiments.py'], {
      cwd: 'examples/matematicas-estadistica',
      encoding: 'utf8',
    }),
  )
  assert.deepEqual(actual, result)
  assert.equal(result.data, 'synthetic')
  assert.equal(result.bayes.analytic, 90 / 585)
  assert.equal(result.bayes.simulated, result.bayes.spam_flags / result.bayes.flags)
  assert.equal(result.ab.assignments, 20)
  assert.equal(result.ab.p_value, 0.1)
  assert.equal(result.latency.samples_ms.length, 1000)
  assert.equal(result.inference.observations.length, 200)
  assert.equal(result.inference.accuracy, 155 / 200)
  assert.equal(result.pca.squared_error, 0.5)
})

test('matemáticas: simulador JavaScript coincide con las trayectorias Python', () => {
  for (const row of result.optimization) {
    const points = trajectory('quadratic', 2, row.rate, 15)
    for (const [index, [, loss]] of points.entries())
      assert.ok(
        Math.abs(loss - row.points[index][1]) <= Math.max(1e-12, Math.abs(loss) * 1e-12),
      )
  }
  assert.deepEqual(trajectory('double', 0, 0.1, 3), [
    [0, 1],
    [0, 1],
    [0, 1],
    [0, 1],
  ])
  assert.ok(trajectory('double', 2, 1.1).length < 31)
})
