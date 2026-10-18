import { readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile('docs/editorial/computing-series.json', 'utf8'),
)
const excerpts = JSON.parse(
  await readFile('assets/computing-series/code-excerpts.json', 'utf8'),
)
const updates = []
for (const item of excerpts) {
  const source = await readFile(`examples/computacion-redes/${item.file}`, 'utf8')
  const start = source.indexOf(item.start)
  if (start < 0) throw new Error(`Inicio no encontrado: ${item.id}`)
  const marker = item.until ?? item.end
  const finish = source.indexOf(marker, start)
  if (finish < 0) throw new Error(`Final no encontrado: ${item.id}`)
  const lineStart = source.lastIndexOf('\n', start) + 1
  const indent = source.slice(lineStart, start)
  const snippet = source
    .slice(lineStart, finish + (item.until ? 0 : item.end.length))
    .split('\n')
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n')
    .trimEnd()
  const post = manifest.articles.find((entry) => entry.id === item.id)
  const path = `src/content/posts/es/${post.slug}.md`
  const body = await readFile(path, 'utf8')
  if (!/```javascript\n[\s\S]*?\n```/.test(body))
    throw new Error(`Sin bloque: ${item.id}`)
  updates.push([
    path,
    body.replace(
      /```javascript\n[\s\S]*?\n```/,
      `\x60\x60\x60javascript\n${snippet}\n\x60\x60\x60`,
    ),
  ])
}
for (const [path, body] of updates) await writeFile(path, body)
console.log('9 fragmentos sincronizados con el código formateado')
