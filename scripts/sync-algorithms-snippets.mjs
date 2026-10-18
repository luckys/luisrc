import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'
const manifest = JSON.parse(
  await readFile('docs/editorial/algorithms-series.json', 'utf8'),
)
const functions = new Map()
for (const file of ['algorithms.ts', 'focused.ts']) {
  const text = await readFile(`examples/estructuras-algoritmos/${file}`, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  for (const node of source.statements)
    if (ts.isFunctionDeclaration(node) && node.name)
      functions.set(node.name.text, node.getText(source))
}
for (const entry of manifest.articles) {
  const path = `src/content/posts/es/${entry.slug}.md`
  const text = await readFile(path, 'utf8')
  const next = text.replace(
    /```typescript\nexport function (\w+)[\s\S]*?\n```/g,
    (block, name) => {
      if (!functions.has(name)) throw new Error(`Función no encontrada: ${name}`)
      return `\x60\x60\x60typescript\n${functions.get(name)}\n\x60\x60\x60`
    },
  )
  if (next !== text) await writeFile(path, next)
}
