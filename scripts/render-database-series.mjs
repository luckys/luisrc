import { D2 } from '@d2lang/d2'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import * as echarts from 'echarts'

const source = 'assets/database-series'
const destination = 'public/assets/visuals/database-series'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const name of (await readdir(source))
    .filter((name) => name.endsWith('.d2'))
    .sort()) {
    const compiled = await d2.compile(await readFile(`${source}/${name}`, 'utf8'), {
      layout: 'elk',
    })
    const svg = await d2.render(compiled.diagram, compiled.renderOptions)
    await writeFile(`${destination}/${name.replace('.d2', '.svg')}`, svg)
    console.log(name)
  }
} finally {
  await d2.dispose()
}

const results = JSON.parse(
  await readFile('examples/bases-de-datos/results/benchmark.json', 'utf8'),
)
const chart = echarts.init(null, null, {
  renderer: 'svg',
  ssr: true,
  width: 900,
  height: 400,
})
chart.setOption({
  backgroundColor: '#111827',
  title: {
    text: 'Misma consulta, antes y después del índice',
    subtext: `PostgreSQL ${results.postgres} · 100 000 filas · mediana de 7 ejecuciones`,
    left: 30,
    textStyle: { color: '#f8fafc', fontSize: 21 },
    subtextStyle: { color: '#cbd5e1', fontSize: 14 },
  },
  grid: { left: 160, right: 90, top: 110, bottom: 80 },
  xAxis: {
    type: 'value',
    name: 'Execution Time (ms)',
    nameLocation: 'middle',
    nameGap: 35,
    axisLabel: { color: '#cbd5e1' },
    nameTextStyle: { color: '#cbd5e1' },
    splitLine: { lineStyle: { color: '#334155' } },
  },
  yAxis: {
    type: 'category',
    data: ['Sin índice', 'Con índice'],
    axisLabel: { color: '#f8fafc', fontSize: 17 },
    inverse: true,
  },
  series: [
    {
      type: 'bar',
      data: [results.without_index.median_ms, results.with_index.median_ms],
      itemStyle: { color: '#38bdf8' },
      label: { show: true, position: 'right', color: '#f8fafc', fontSize: 17 },
    },
  ],
  graphic: {
    type: 'text',
    left: 30,
    bottom: 12,
    style: {
      text: 'Laboratorio sintético local. No predice el rendimiento de una aplicación real.',
      fill: '#cbd5e1',
      fontSize: 14,
    },
  },
})
await writeFile(`${destination}/consulta-indice-medicion.svg`, chart.renderToSVGString())
chart.dispose()

// Mantiene las dimensiones y el enlace de ampliación junto al SVG generado.
for (const name of (await readdir('src/content/posts/es')).filter((name) =>
  name.endsWith('.md'),
)) {
  const path = `src/content/posts/es/${name}`
  let body = await readFile(path, 'utf8')
  const original = body
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/database-series\/[^\"]+)"[^>]+>/g,
  )) {
    const svg = await readFile(`public${asset}`, 'utf8')
    const dimensions = svg
      .match(/viewBox="([^\"]+)"/)?.[1]
      .split(/\s+/)
      .map(Number)
    if (!dimensions) throw new Error(`Sin viewBox: ${asset}`)
    const updated = tag
      .replace(/width="\d+"/, `width="${Math.ceil(dimensions[2])}"`)
      .replace(/height="\d+"/, `height="${Math.ceil(dimensions[3])}"`)
    body = body.replace(tag, updated)
    if (!body.includes(`](${asset})`))
      body = body.replace(updated, `${updated}\n\n[Ampliar el recurso visual](${asset}).`)
  }
  if (body !== original) await writeFile(path, body)
}
