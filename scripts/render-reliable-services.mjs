import { D2 } from '@d2lang/d2'
import * as echarts from 'echarts'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile('docs/editorial/reliable-services-series.json', 'utf8'),
)
const entries = manifest.series.flatMap((series) => series.articles)
const destination = 'public/assets/visuals/reliable-services'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const entry of entries) {
    const source = await readFile(`assets/reliable-services/${entry.id}.d2`, 'utf8')
    const compiled = await d2.compile(source, { layout: 'elk' })
    await writeFile(
      `${destination}/${entry.id}.svg`,
      await d2.render(compiled.diagram, compiled.renderOptions),
    )
    console.log(entry.id)
  }
} finally {
  await d2.dispose()
}

const results = JSON.parse(
  await readFile('examples/servicios-fiables/results/load.json', 'utf8'),
)
const chart = echarts.init(null, null, {
  renderer: 'svg',
  ssr: true,
  width: 900,
  height: 450,
})
chart.setOption({
  backgroundColor: '#111827',
  title: {
    text: 'Más respuestas no implican más trabajo útil',
    subtext: 'HTTP local sintético · 120 solicitudes por etapa · cupo de 4',
    left: 24,
    textStyle: { color: '#f8fafc', fontSize: 23 },
    subtextStyle: { color: '#cbd5e1', fontSize: 15 },
  },
  legend: { top: 80, textStyle: { color: '#f8fafc' } },
  grid: { left: 80, right: 35, top: 125, bottom: 100 },
  xAxis: {
    type: 'category',
    data: results.stages.map((stage) => String(stage.concurrency)),
    name: 'Concurrencia de clientes',
    nameLocation: 'middle',
    nameGap: 32,
    axisLabel: { color: '#f8fafc' },
    nameTextStyle: { color: '#f8fafc' },
  },
  yAxis: {
    type: 'value',
    name: 'Solicitudes',
    max: 120,
    axisLabel: { color: '#cbd5e1' },
    nameTextStyle: { color: '#cbd5e1' },
    splitLine: { lineStyle: { color: '#334155' } },
  },
  series: [
    {
      name: '200: aceptadas',
      type: 'bar',
      stack: 'requests',
      data: results.stages.map((stage) => stage.successes),
      itemStyle: { color: '#38bdf8' },
      label: { show: true, color: '#111827' },
    },
    {
      name: '503: rechazadas',
      type: 'bar',
      stack: 'requests',
      data: results.stages.map((stage) => stage.errors),
      itemStyle: { color: '#fb923c' },
      label: { show: true, color: '#111827' },
    },
  ],
  graphic: {
    type: 'text',
    left: 24,
    bottom: 18,
    style: {
      text: `Node ${results.node} · cliente y servidor en un proceso · una ejecución\nNo representa capacidad de producción. Muestras y condiciones incluidas en el laboratorio.`,
      fill: '#cbd5e1',
      fontSize: 14,
    },
  },
})
await writeFile(`${destination}/load-results.svg`, chart.renderToSVGString())
chart.dispose()

// Actualización mecánica: dimensiones reales, sin reescribir la prosa de los artículos.
for (const entry of entries) {
  const path = `src/content/posts/es/${entry.slug}.md`
  let body = await readFile(path, 'utf8')
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/reliable-services\/[^\"]+)"[^>]+>/g,
  )) {
    const svg = await readFile(`public${asset}`, 'utf8')
    const [, , width, height] = svg
      .match(/viewBox="([^\"]+)"/)[1]
      .split(/\s+/)
      .map(Number)
    body = body.replace(
      tag,
      tag
        .replace(/width="\d+"/, `width="${Math.ceil(width)}"`)
        .replace(/height="\d+"/, `height="${Math.ceil(height)}"`),
    )
  }
  await writeFile(path, body)
}
