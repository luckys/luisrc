import { D2 } from '@d2lang/d2'
import * as echarts from 'echarts'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('docs/editorial/ml-series.json', 'utf8'))
const result = JSON.parse(
  await readFile('examples/machine-learning/results/experiments.json', 'utf8'),
)
const destination = 'public/assets/visuals/ml-series'
await mkdir(destination, { recursive: true })
const d2 = new D2()
try {
  for (const entry of manifest.articles) {
    const compiled = await d2.compile(
      await readFile(`assets/ml-series/${entry.id}.d2`, 'utf8'),
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

async function graph(name, title, subtitle, xAxis, yAxis, series, layout = {}) {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 900,
    height: layout.height ?? 480,
  })
  const axis = {
    axisLabel: {
      color: '#cbd5e1',
      fontSize: 14,
      formatter: (value) => String(value).replace('.', ','),
    },
    nameTextStyle: { color: '#cbd5e1', fontSize: 15 },
    splitLine: { lineStyle: { color: '#334155' } },
  }
  chart.setOption({
    animation: false,
    backgroundColor: '#111827',
    color: ['#38bdf8', '#fbbf24', '#fb7185', '#a78bfa'],
    title: {
      text: title,
      subtext: subtitle,
      left: 24,
      textStyle: { color: '#f8fafc', fontSize: 23 },
      subtextStyle: { color: '#cbd5e1', fontSize: 15 },
    },
    legend: { top: 80, textStyle: { color: '#cbd5e1' } },
    grid: { left: 90, right: 45, top: 125, bottom: 105, ...layout.grid },
    xAxis: {
      ...axis,
      axisLine: { onZero: false },
      nameLocation: 'middle',
      nameGap: 35,
      ...xAxis,
    },
    yAxis: { ...axis, axisLine: { onZero: false }, ...yAxis },
    series,
    graphic: {
      type: 'text',
      left: 24,
      bottom: 15,
      style: {
        text: 'Datos sintéticos · resultados locales de NumPy/pandas/scikit-learn\nNo son métricas de producción ni un benchmark de bibliotecas.',
        fill: '#cbd5e1',
        fontSize: 14,
      },
    },
  })
  await writeFile(`${destination}/${name}.svg`, chart.renderToSVGString())
  chart.dispose()
}
await graph(
  'distance-histogram',
  'Distancias disponibles en train: 530 envíos',
  'Diez distancias ausentes no entran en el histograma',
  {
    type: 'category',
    name: 'Intervalo de distancia (km)',
    data: ['0–100', '100–200', '200–300', '300–400', '400–500', '500–600', '600–700'],
  },
  { type: 'value', name: 'Envíos', minInterval: 1 },
  [{ name: 'Conteo', type: 'bar', data: result.eda_train.distance_histogram }],
)
await graph(
  'tree-depth',
  'Más profundidad no garantiza generalizar mejor',
  'Mismo pipeline · mínimo diez observaciones por hoja',
  {
    type: 'category',
    name: 'Profundidad máxima',
    data: result.tree_depth.map((row) => row.depth ?? 'Sin límite'),
  },
  { type: 'value', name: 'Average precision', min: 0, max: 1 },
  ['train_ap', 'validation_ap'].map((key, i) => ({
    name: ['Train', 'Validation'][i],
    type: 'line',
    symbolSize: 9,
    data: result.tree_depth.map((row) => row[key]),
  })),
)
await graph(
  'clustering',
  'K-means no sigue necesariamente las dos curvas',
  '240 puntos de make_moons · k = 2 · coordenadas estandarizadas',
  { type: 'value', name: 'Coordenada 1', min: -2.5, max: 2.5 },
  {
    type: 'value',
    name: 'Coordenada 2',
    nameLocation: 'middle',
    nameGap: 50,
    min: -2.5,
    max: 2.5,
  },
  [0, 1].map((label) => ({
    name: `Grupo ${label}`,
    type: 'scatter',
    symbolSize: 6,
    data: result.clustering.points.filter(
      (_, i) => result.clustering.kmeans_labels[i] === label,
    ),
  })),
  { height: 660, grid: { left: 235, right: 235 } },
)
await graph(
  'precision-recall',
  'El ranking no fija un único punto de operación',
  'Validation: 44 retrasos de 180 envíos · curvas sin suavizado',
  { type: 'value', name: 'Recall', min: 0, max: 1 },
  { type: 'value', name: 'Precision', min: 0, max: 1 },
  ['logistic', 'forest', 'boosting', 'baseline'].map((kind) => ({
    name: {
      logistic: 'Logística',
      forest: 'Random Forest',
      boosting: 'Boosting',
      baseline: 'Constante',
    }[kind],
    type: 'line',
    showSymbol: false,
    data: result.validation[kind].pr_curve,
    ...(kind === 'baseline'
      ? {
          data: [
            [0, 44 / 180],
            [1, 44 / 180],
          ],
          lineStyle: { type: 'dashed' },
        }
      : {}),
  })),
)
await graph(
  'calibration',
  'Probabilidades medias frente a resultados observados',
  'Logística sin recalibrar · validation · cinco bins uniformes no vacíos',
  { type: 'value', name: 'Probabilidad media', min: 0, max: 1 },
  { type: 'value', name: 'Fracción positiva', min: 0, max: 1 },
  [
    {
      name: 'Logística',
      type: 'line',
      symbolSize: 10,
      data: result.calibration_validation.mean_prediction.map((p, i) => [
        p,
        result.calibration_validation.observed_fraction[i],
      ]),
    },
    {
      name: 'Referencia diagonal',
      type: 'line',
      showSymbol: false,
      lineStyle: { type: 'dashed' },
      data: [
        [0, 0],
        [1, 1],
      ],
    },
  ],
)

for (const entry of manifest.articles) {
  const path = `src/content/posts/es/${entry.slug}.md`
  let body = await readFile(path, 'utf8')
  for (const [tag, asset] of body.matchAll(
    /<img src="(\/assets\/visuals\/ml-series\/[^\"]+)"[^>]+>/g,
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
