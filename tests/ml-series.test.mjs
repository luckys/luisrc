import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import YAML from 'yaml'
import { evaluate } from '../examples/machine-learning/explorer.mjs'

const manifest = JSON.parse(await readFile('docs/editorial/ml-series.json', 'utf8'))
const result = JSON.parse(
  await readFile('examples/machine-learning/results/experiments.json', 'utf8'),
)
const protocol = JSON.parse(
  await readFile('examples/machine-learning/protocol.json', 'utf8'),
)
const normalize = (text) => text.replace(/\s+/g, '')
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`)

test('ML: explorador dinámico coincide con Python y solo usa validation', async () => {
  const { y, logistic } = result.validation_predictions
  assert.equal(y.length, 180)
  assert.equal(
    y.reduce((a, b) => a + b, 0),
    44,
  )
  for (const row of result.threshold_validation) {
    const actual = evaluate(y, logistic, row.threshold)
    assert.deepEqual(actual.matrix, row.confusion)
    near(actual.precision, row.precision)
    near(actual.recall, row.recall)
  }
  assert.equal(evaluate(y, logistic, 0.5).cost, 175)
  assert.equal(evaluate(y, logistic, 0.2).cost, 90)
  assert.throws(() => evaluate([1], [1.2], 0.5))
  assert.throws(() => evaluate([2], [0.5], 0.5))
  assert.throws(() => evaluate([1], [0.5], 0.5, -1))
  assert.deepEqual(
    JSON.parse(
      await readFile('public/assets/interactive/ml-series/validation.json', 'utf8'),
    ),
    result.validation_predictions,
  )
  for (const name of ['explorer.html', 'explorer.mjs', 'validation.json'])
    assert.deepEqual(
      await readFile(`public/assets/interactive/ml-series/${name}`),
      await readFile(`examples/machine-learning/${name}`),
    )
})

test('ML: diez drafts españoles, orden, metadatos y dependencias sin ciclos', async () => {
  const seen = new Set()
  let previous = 0
  for (const [index, entry] of manifest.articles.entries()) {
    assert.equal(entry.id, `P0${86 + index}`)
    for (const prerequisite of entry.prerequisites) assert.ok(seen.has(prerequisite))
    const source = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    const header = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)[1])
    for (const key of ['id', 'slug', 'title']) assert.equal(header[key], entry[key])
    assert.equal(header.series, manifest.name)
    assert.equal(header.author, 'Luis Ramírez Calle')
    assert.equal(header.locale, 'es')
    assert.equal(header.draft, true)
    assert.equal(header.status, 'draft')
    assert.equal(header.math, true)
    assert.deepEqual(header.prerequisites, entry.prerequisites)
    assert.ok(new Date(header.published).valueOf() > previous)
    previous = new Date(header.published).valueOf()
    assert.ok(!/PaySafe|—/.test(source))
    for (const section of ['## Garantías y límites', '## Ejercicio:', '## Referencias'])
      assert.ok(source.includes(section))
    assert.ok(source.includes('/assets/examples/machine-learning-lab.zip'))
    const words = source.split(/\s+/).length
    assert.ok(words >= 800 && words < 1500, `${entry.id}: ${words}`)
    seen.add(entry.id)
  }
  assert.equal(seen.size, 10)
})

test('ML: enlaces, alt y dimensiones de quince recursos visuales', async () => {
  const slugs = new Set(
    (await readdir('src/content/posts/es'))
      .filter((x) => x.endsWith('.md'))
      .map((x) => x.slice(0, -3)),
  )
  let images = 0
  for (const entry of manifest.articles) {
    const body = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, slug] of body.matchAll(/\]\(\/posts\/([^)#]+)(?:#[^)]*)?\)/g))
      assert.ok(slugs.has(slug), slug)
    for (const [, path, alt, width, height] of body.matchAll(
      /<img src="([^\"]+)" alt="([^\"]+)" width="(\d+)" height="(\d+)"/g,
    )) {
      assert.ok(alt.length > 40)
      const svg = await readFile(`public${path}`, 'utf8')
      const [, , w, h] = svg
        .match(/viewBox="([^\"]+)"/)[1]
        .split(/\s+/)
        .map(Number)
      assert.equal(Number(width), Math.ceil(w))
      assert.equal(Number(height), Math.ceil(h))
      images++
    }
  }
  assert.equal(images, 15)
})

test('ML: diez fragmentos coinciden con código ejecutado y diez problemas completos', async () => {
  let count = 0
  for (const entry of manifest.articles) {
    const source = await readFile(`src/content/posts/es/${entry.slug}.md`, 'utf8')
    for (const [, path, snippet] of source.matchAll(
      /Archivo: `machine-learning\/([^`]+)`[^\n]*\n\n```python\n([\s\S]*?)\n```/g,
    )) {
      assert.ok(
        normalize(await readFile(`examples/machine-learning/${path}`, 'utf8')).includes(
          normalize(snippet),
        ),
        entry.id,
      )
      count++
    }
  }
  assert.equal(count, 10)
  const tasks = JSON.parse(await readFile('examples/machine-learning/tasks.json', 'utf8'))
  assert.equal(tasks.length, 10)
  for (const task of tasks)
    for (const key of ['problem', 'task', 'target', 'unit', 'data', 'metric'])
      assert.ok(key in task)
  assert.ok(tasks.some((x) => x.task === 'causal experiment'))
  assert.ok(tasks.some((x) => x.task === 'deterministic rule'))
})

test('ML: ZIP completo, bytes idénticos y sin artefactos instalados', async () => {
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
    await readFile('assets/ml-series/download-manifest.json', 'utf8'),
  ).paths
  assert.deepEqual([...paths].sort(), (await collect('examples/machine-learning')).sort())
  const zip = 'public/assets/examples/machine-learning-lab.zip'
  assert.deepEqual(
    execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').sort(),
    [...paths].sort(),
  )
  for (const path of paths) {
    assert.ok(!/node_modules|\.pyc|__pycache__|\.env/.test(path))
    assert.deepEqual(
      execFileSync('unzip', ['-p', zip, path]),
      await readFile(`examples/${path}`),
    )
  }
})

test('ML: hashes, protocolo y métricas finales reconstruidas desde predicciones', async () => {
  for (const [path, field] of [
    ['data/logistics-v1.csv', 'dataset_sha256'],
    ['protocol.json', 'protocol_sha256'],
  ]) {
    assert.equal(
      createHash('sha256')
        .update(await readFile(`examples/machine-learning/${path}`))
        .digest('hex'),
      result[field],
    )
  }
  const runtime = JSON.parse(
    await readFile('examples/machine-learning/runtime.json', 'utf8'),
  )
  for (const [name, version] of Object.entries(result.environment))
    assert.equal(runtime[name], version)
  const { y, id } = result.test_predictions
  assert.equal(y.length, 180)
  assert.deepEqual(
    id,
    Array.from({ length: 180 }, (_, i) => 720 + i),
  )
  assert.equal(
    y.reduce((a, b) => a + b, 0),
    47,
  )
  assert.deepEqual(Object.keys(result.final_test), protocol.final_models)
  for (const kind of protocol.final_models) {
    const p = result.test_predictions[kind]
    assert.equal(p.length, y.length)
    assert.ok(p.every((x) => x >= 0 && x <= 1))
    const cm = [
      [0, 0],
      [0, 0],
    ]
    y.forEach((actual, i) => cm[actual][Number(p[i] >= protocol.threshold)]++)
    const [[tn, fp], [fn, tp]] = cm
    const row = result.final_test[kind]
    assert.deepEqual(row.confusion, cm)
    near(row.accuracy, (tn + tp) / y.length)
    near(row.recall, tp / (tp + fn))
    near(row.precision, tp + fp ? tp / (tp + fp) : 0)
    near(row.brier, y.reduce((sum, v, i) => sum + (v - p[i]) ** 2, 0) / y.length)
    let correctPairs = 0,
      pairs = 0
    y.forEach((a, i) => {
      if (a === 1)
        y.forEach((b, j) => {
          if (b === 0) {
            pairs++
            correctPairs += p[i] > p[j] ? 1 : p[i] === p[j] ? 0.5 : 0
          }
        })
    })
    near(row.roc_auc, correctPairs / pairs)
    const levels = [...new Set(p)].sort((a, b) => b - a)
    let seen = 0,
      positives = 0,
      ap = 0
    for (const level of levels) {
      const indexes = p.flatMap((v, i) => (v === level ? [i] : []))
      const added = indexes.reduce((sum, i) => sum + y[i], 0)
      seen += indexes.length
      positives += added
      ap += ((added / 47) * positives) / seen
    }
    near(row.average_precision, ap)
  }
  assert.ok(result.calibration_toy.confident.brier > result.calibration_toy.honest.brier)
  near(result.calibration_toy.honest.roc_auc, result.calibration_toy.confident.roc_auc)
  assert.ok(result.temporal_demo.future_mae > 50 * result.temporal_demo.random_mae)
})
