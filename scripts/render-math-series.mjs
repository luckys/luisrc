import { D2 } from '@d2lang/d2'
import * as echarts from 'echarts'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('docs/editorial/math-series.json', 'utf8'))
const result = JSON.parse(
  await readFile('examples/matematicas-estadistica/results/calculations.json', 'utf8'),
)
const destination = 'public/assets/visuals/math-series'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const entry of manifest.articles) {
    const compiled = await d2.compile(
      await readFile(`assets/math-series/${entry.id}.d2`, 'utf8'),
      { layout: 'elk' },
    )
    await writeFile(
      `${destination}/${entry.id}.svg`,
      await d2.render(compiled.diagram, compiled.renderOptions),
    )
    console.log(entry.id)
  }
} finally {
  await d2.dispose()
}

async function graph(name, title, subtitle, xAxis, yAxis, series) {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 900,
    height: 460,
  })
  const axis = {
    axisLabel: {
      color: '#cbd5e1',
      fontSize: 14,
      formatter: (raw) => {
        const value = Number(raw)
        if (value === 0) return '0'
        return Math.abs(value) < 1e-3 || Math.abs(value) >= 1e4
          ? value.toExponential(0)
          : String(value).replace('.', ',')
      },
    },
    nameTextStyle: { color: '#cbd5e1', fontSize: 15 },
    splitLine: { lineStyle: { color: '#334155' } },
  }
  chart.setOption({
    animation: false,
    backgroundColor: '#111827',
    color: ['#38bdf8', '#fbbf24', '#fb7185'],
    title: {
      text: title,
      subtext: subtitle,
      left: 24,
      textStyle: { color: '#f8fafc', fontSize: 23 },
      subtextStyle: { color: '#cbd5e1', fontSize: 15 },
    },
    legend: { top: 80, textStyle: { color: '#cbd5e1' } },
    grid: { left: 95, right: 60, top: 125, bottom: 105 },
    xAxis: { ...axis, nameLocation: 'middle', nameGap: 35, ...xAxis },
    yAxis: { ...axis, ...yAxis },
    series,
    graphic: {
      type: 'text',
      left: 24,
      bottom: 15,
      style: {
        text: `Python ${result.python} · cálculo local con biblioteca estándar\nDatos ficticios. No son mediciones de un modelo o servicio real.`,
        fill: '#cbd5e1',
        fontSize: 14,
      },
    },
  })
  await writeFile(`${destination}/${name}.svg`, chart.renderToSVGString())
  chart.dispose()
}
await graph(
  'derivative-error',
  'Un paso demasiado pequeño también introduce error',
  'Diferencia central de sin(x) en x = 1 · ambos ejes logarítmicos',
  { type: 'log', name: 'Paso h', min: 1e-16, max: 0.1 },
  { type: 'log', name: 'Error absoluto' },
  [
    {
      name: 'Error frente a cos(1)',
      type: 'line',
      symbolSize: 9,
      data: result.derivatives
        .map((row) => [row.h, row.sin_error])
        .sort((a, b) => a[0] - b[0]),
    },
  ],
)
await graph(
  'learning-rates',
  'La misma parábola, tres tamaños de paso',
  'L(x) = x² · x inicial = 2 · eje de pérdida logarítmico',
  { type: 'value', name: 'Paso', minInterval: 1 },
  { type: 'log', name: 'Pérdida' },
  result.optimization.map((row) => ({
    name: `η = ${row.rate}`,
    type: 'line',
    showSymbol: false,
    data: row.points,
  })),
)
const sorted = [...result.latency.samples_ms].sort((a, b) => a - b)
await graph(
  'latency-cdf',
  'Una media no muestra la forma de la cola',
  'Distribución acumulada empírica · 1.000 latencias log-normales sintéticas',
  { type: 'value', name: 'Latencia (ms)' },
  { type: 'value', name: 'Fracción ≤ x', min: 0, max: 1 },
  [
    {
      name: 'ECDF',
      type: 'line',
      step: 'end',
      showSymbol: false,
      data: sorted.map((value, index) => [value, (index + 1) / sorted.length]),
    },
  ],
)
await graph(
  'spectrum',
  'Dos componentes conocidas, dos picos en el espectro',
  '64 muestras a 64 Hz · amplitud unilateral normalizada',
  {
    type: 'category',
    name: 'Frecuencia (Hz)',
    data: result.fourier.amplitudes.map(([k]) => String(k)),
  },
  { type: 'value', name: 'Amplitud', min: 0, max: 1.1 },
  [
    {
      name: 'Amplitud',
      type: 'bar',
      data: result.fourier.amplitudes.map(([, amplitude]) => amplitude),
    },
  ],
)

for (const entry of manifest.articles) {
  const path = `src/content/posts/es/${entry.slug}.md`
  let body = await readFile(path, 'utf8')
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/math-series\/[^\"]+)"[^>]+>/g,
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
