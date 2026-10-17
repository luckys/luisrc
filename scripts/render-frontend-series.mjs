import { D2 } from '@d2lang/d2'
import * as echarts from 'echarts'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('docs/editorial/frontend-series.json', 'utf8'))
const destination = 'public/assets/visuals/frontend-series'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const entry of manifest.articles) {
    const source = await readFile(`assets/frontend-series/${entry.id}.d2`, 'utf8')
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

const measurement = JSON.parse(
  await readFile('examples/frontend-tiempo-real/results/dom.json', 'utf8'),
)
const chart = echarts.init(null, null, {
  renderer: 'svg',
  ssr: true,
  width: 900,
  height: 460,
})
chart.setOption({
  backgroundColor: '#111827',
  title: {
    text: 'Montar menos filas reduce el trabajo DOM de esta prueba',
    left: 24,
    subtext: 'Creación de nodos + layout síncrono · mediana de siete muestras',
    textStyle: { color: '#f8fafc', fontSize: 23 },
    subtextStyle: { color: '#cbd5e1', fontSize: 15 },
  },
  grid: { left: 150, right: 110, top: 105, bottom: 130 },
  xAxis: {
    type: 'value',
    name: 'ms',
    axisLabel: { color: '#cbd5e1' },
    nameTextStyle: { color: '#cbd5e1' },
    splitLine: { lineStyle: { color: '#334155' } },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: measurement.medians.map(
      (row) => `${row.mounted.toLocaleString('es-ES')} filas`,
    ),
    axisLabel: { color: '#f8fafc', fontSize: 17 },
  },
  series: [
    {
      type: 'bar',
      data: measurement.medians.map((row) => row.ms),
      itemStyle: { color: '#38bdf8' },
      label: {
        show: true,
        position: 'right',
        color: '#f8fafc',
        fontSize: 18,
        formatter: (item) => `${Number(item.value).toFixed(1)} ms`,
      },
    },
  ],
  graphic: {
    type: 'text',
    left: 24,
    bottom: 22,
    style: {
      text: `Chromium ${measurement.chromium} · ${measurement.os} · viewport 1280 × 720\nMicroexperimento aislado: no mide React, scroll ni INP. No extrapolar a producción.`,
      fill: '#cbd5e1',
      fontSize: 15,
    },
  },
})
await writeFile(`${destination}/dom-measurement.svg`, chart.renderToSVGString())
chart.dispose()

for (const entry of manifest.articles) {
  const path = `src/content/posts/es/${entry.slug}.md`
  let body = await readFile(path, 'utf8')
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/frontend-series\/[^\"]+)"[^>]+>/g,
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
