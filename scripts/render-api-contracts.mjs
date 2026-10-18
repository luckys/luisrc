import { D2 } from '@d2lang/d2'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const manifest = JSON.parse(
  await readFile('docs/editorial/api-contracts-series.json', 'utf8'),
)
await mkdir('public/assets/visuals/api-contracts', { recursive: true })
const d2 = new D2()
try {
  for (const entry of manifest.articles) {
    const compiled = await d2.compile(
      await readFile(`assets/api-contracts/${entry.id}.d2`, 'utf8'),
      {
        layout: 'elk',
        ...(['P022', 'P023'].includes(entry.id) ? { pad: 16 } : {}),
      },
    )
    const svg = await d2.render(compiled.diagram, compiled.renderOptions)
    await writeFile(`public/assets/visuals/api-contracts/${entry.id}.svg`, svg)
    const [, , width, height] = svg
      .match(/viewBox="([^"]+)"/)[1]
      .split(/\s+/)
      .map(Number)
    const path = `src/content/posts/es/${entry.slug}.md`
    const text = await readFile(path, 'utf8')
    await writeFile(
      path,
      text.replace(
        /width="\d+" height="\d+"/,
        `width="${Math.ceil(width)}" height="${Math.ceil(height)}"`,
      ),
    )
  }
} finally {
  await d2.dispose()
}
