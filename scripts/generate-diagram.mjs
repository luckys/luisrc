import { D2 } from '@d2lang/d2'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath || !outputPath.endsWith('.svg')) {
  console.error('Uso: pnpm visuals:diagram archivo.d2 salida.svg')
  process.exit(1)
}

const source = await readFile(inputPath, 'utf8')
const d2 = new D2()
try {
  const result = await d2.compile(source, { layout: 'elk' })
  const svg = await d2.render(result.diagram, result.renderOptions)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, svg)
  console.log(`Diagrama generado: ${outputPath}`)
} finally {
  await d2.dispose()
}
