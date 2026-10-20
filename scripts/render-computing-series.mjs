import { D2 } from '@d2lang/d2'
import * as echarts from 'echarts'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile('docs/editorial/computing-series.json', 'utf8'),
)
const results = JSON.parse(
  await readFile('assets/evidence/computing-networks/results/experiments.json', 'utf8'),
)
const browser = JSON.parse(
  await readFile('assets/evidence/computing-networks/results/browser.json', 'utf8'),
)
const destination = 'public/assets/visuals/computing-series'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const entry of manifest.articles) {
    const compiled = await d2.compile(
      await readFile(`assets/computing-series/${entry.id}.d2`, 'utf8'),
      { layout: 'elk' },
    )
    await writeFile(
      `${destination}/${entry.id}.svg`,
      await d2.render(compiled.diagram, compiled.renderOptions),
    )
  }
} finally {
  await d2.dispose()
}

async function graph(name, title, subtitle, xAxis, yAxis, series, note, grid = {}) {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 900,
    height: 480,
  })
  const axis = {
    axisLabel: {
      color: '#cbd5e1',
      fontSize: 14,
      formatter: (x) => String(x).replace('.', ','),
    },
    nameTextStyle: { color: '#cbd5e1', fontSize: 15 },
    splitLine: { lineStyle: { color: '#334155' } },
  }
  chart.setOption({
    animation: false,
    backgroundColor: '#111827',
    color: ['#38bdf8', '#fbbf24', '#c4b5fd'],
    title: {
      text: title,
      subtext: subtitle,
      left: 24,
      textStyle: { color: '#f8fafc', fontSize: 23 },
      subtextStyle: { color: '#cbd5e1', fontSize: 15 },
    },
    legend: { top: 80, textStyle: { color: '#cbd5e1' } },
    grid: { left: 90, right: 50, top: 125, bottom: 105, ...grid },
    xAxis: { ...axis, nameLocation: 'middle', nameGap: 35, ...xAxis },
    yAxis: { ...axis, ...yAxis },
    series,
    graphic: {
      type: 'text',
      left: 24,
      bottom: 15,
      style: { text: note, fill: '#cbd5e1', fontSize: 14 },
    },
  })
  await writeFile(`${destination}/${name}.svg`, chart.renderToSVGString())
  chart.dispose()
}
await graph(
  'memory-samples',
  'Dos recorridos, el mismo contenido procesado',
  '2 MiB · tres calentamientos · orden alternado · nueve muestras',
  {
    type: 'category',
    name: 'Muestra',
    data: results.memory.samples.map((_, i) => String(i + 1)),
  },
  { type: 'value', name: 'Tiempo (ms)', min: 0 },
  ['memory_ms', 'file_ms'].map((key, i) => ({
    type: 'line',
    name: ['Procesar Buffer', 'Leer y procesar'][i],
    data: results.memory.samples.map((row) => row[key]),
    symbolSize: 8,
  })),
  `Medición local: ${results.environment.node} · ${results.environment.cpu}\nFichero recién escrito: no aísla lectura física en frío ni latencia de RAM.`,
)
await graph(
  'transport-delivery',
  'La pérdida anterior cambia cuándo se entrega',
  'Modelo conceptual · latencia 40 ms · recuperación 100 ms · deadline +80 ms',
  { type: 'category', name: 'Unidad', data: ['0', '1', '2', '3', '4', '5'] },
  { type: 'value', name: 'Instante (ms)', min: 0, max: 200 },
  [
    {
      name: 'Ordenada',
      type: 'line',
      symbolSize: 9,
      data: results.transport.ordered.map((row) => row.delivered),
    },
    {
      name: 'Datagramas',
      type: 'line',
      symbolSize: 9,
      connectNulls: false,
      data: results.transport.datagram.map((row) => row.delivered),
    },
    {
      name: 'Deadline',
      type: 'line',
      lineStyle: { type: 'dashed' },
      data: results.transport.ordered.map((row) => row.deadline),
    },
  ],
  'Tiempos hipotéticos calculados, no mediciones de TCP/UDP/QUIC.\nUnidad 1 sin entrega en datagramas: el hueco no es un tiempo cero.',
)
const events = [
  { name: 'responseEnd', time: browser.navigation.responseEnd },
  { name: 'domInteractive', time: browser.navigation.domInteractive },
  ...browser.events.filter((row) =>
    ['DOMContentLoaded', 'fetch:response', 'busy:start', 'busy:end', 'timer'].includes(
      row.name,
    ),
  ),
]
await graph(
  'browser-timeline',
  'Del documento recibido al bloqueo deliberado',
  'Traza real de Chromium · instantes relativos al inicio de navegación',
  { type: 'value', name: 'Instante (ms)', min: 0 },
  { type: 'category', data: events.map((row) => row.name), inverse: true },
  [
    {
      name: 'Evento observado',
      type: 'scatter',
      symbolSize: 11,
      data: events.map((row) => [row.time, row.name]),
    },
  ],
  'El clic se provoca después de cargar: el hueco no se atribuye al servidor.\nUna traza del fixture no establece tiempos universales del navegador.',
  { left: 210 },
)

for (const entry of manifest.articles) {
  const path = `src/content/posts/es/${entry.slug}.md`
  let body = await readFile(path, 'utf8')
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/computing-series\/[^\"]+)"[^>]+>/g,
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
console.log('9 diagramas y 3 gráficas generados desde fuentes y resultados')
