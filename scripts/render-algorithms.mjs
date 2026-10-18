import { D2 } from '@d2lang/d2'
import * as echarts from 'echarts'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile('docs/editorial/algorithms-series.json', 'utf8'),
)
const results = JSON.parse(
  await readFile('examples/estructuras-algoritmos/results/benchmark.json', 'utf8'),
)
const destination = 'public/assets/visuals/algorithms-series'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const entry of manifest.articles.filter(({ id }) =>
    ['P011', 'DSA-02', 'DSA-03'].includes(id),
  )) {
    const compiled = await d2.compile(
      await readFile(`assets/algorithms-series/${entry.id}.d2`, 'utf8'),
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

const variants = ['scan', 'indexed', 'fresh']
const names = ['Lineal', 'Map preparado', 'Construir + consultar']
function chart(title, subtitle, labels, data, note) {
  const plot = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 900,
    height: 500,
  })
  plot.setOption({
    animation: false,
    backgroundColor: '#111827',
    color: ['#38bdf8', '#fbbf24', '#c4b5fd'],
    title: {
      text: title,
      subtext: subtitle,
      left: 24,
      textStyle: { color: '#f8fafc', fontSize: 23 },
      subtextStyle: { color: '#cbd5e1', fontSize: 16 },
    },
    legend: { top: 90, textStyle: { color: '#e2e8f0', fontSize: 16 } },
    grid: { left: 90, right: 40, top: 155, bottom: 110 },
    xAxis: {
      type: 'category',
      data: labels,
      name: 'Documentos / muestra (según título)',
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: '#e2e8f0', fontSize: 15 },
      axisLabel: { color: '#e2e8f0', fontSize: 15 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: 'ms / lote',
      nameTextStyle: { color: '#e2e8f0', fontSize: 17 },
      axisLabel: {
        color: '#e2e8f0',
        fontSize: 15,
        formatter: (value) => String(value).replace('.', ','),
      },
      splitLine: { lineStyle: { color: '#334155' } },
    },
    series: variants.map((key, i) => ({
      name: names[i],
      type: 'line',
      symbolSize: 9,
      data: data.map((row) => row[key]),
    })),
    graphic: {
      type: 'text',
      left: 24,
      bottom: 18,
      style: { text: note, fill: '#cbd5e1', fontSize: 15 },
    },
  })
  const svg = plot.renderToSVGString()
  plot.dispose()
  return svg
}
const mixed = results.cases.filter((row) => row.pattern === 'mixed')
await writeFile(
  `${destination}/mixed-timings.svg`,
  chart(
    'Búsquedas mixtas: incluir el índice cambia la comparación',
    'Medianas de nueve muestras · 200 consultas por lote · 50 % ausencias',
    mixed.map((row) => row.n.toLocaleString('es-ES')),
    mixed.map((row) => row.medians_ms),
    'Node 24.19.0 · medición local en memoria, no latencia HTTP.\nMap preparado: menos de 0,004 ms/lote; la tabla conserva cifras pequeñas.',
  ),
)
const largest = mixed.find((row) => row.n === 20000)
await writeFile(
  `${destination}/mixed-samples.svg`,
  chart(
    'Nueve muestras: 20.000 documentos, carga mixta',
    '200 consultas por lote · cinco warmups por variante · orden rotatorio',
    largest.samples.map((row) => String(row.sample)),
    largest.samples.map((row) =>
      Object.fromEntries(variants.map((key) => [key, row[`${key}_ms`]])),
    ),
    'No se elimina ninguna muestra ni se impone un umbral de velocidad.\nEl registro descargable conserva los valores sin redondear.',
  ),
)

for (const entry of manifest.articles) {
  const path = `src/content/posts/es/${entry.slug}.md`
  let body = await readFile(path, 'utf8')
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/algorithms-series\/[^\"]+)"[^>]+>/g,
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
console.log('3 diagramas y 2 gráficas generados desde fuentes y muestras archivadas')
