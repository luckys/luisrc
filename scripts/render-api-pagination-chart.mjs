import * as echarts from 'echarts'
import { readFile, writeFile } from 'node:fs/promises'
const results = JSON.parse(
  await readFile('examples/api-paginacion-evolucion/results/experiments.json', 'utf8'),
)
const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]
const chart = echarts.init(null, null, {
  renderer: 'svg',
  ssr: true,
  width: 900,
  height: 500,
})
chart.setOption({
  animation: false,
  backgroundColor: '#111827',
  color: ['#fbbf24', '#38bdf8'],
  title: {
    text: 'Continuar una página: OFFSET y keyset',
    subtext: 'Siete muestras · 50 filas · PostgreSQL 17.11 · cachés calientes / tmpfs',
    left: 24,
    textStyle: { color: '#f8fafc', fontSize: 24 },
    subtextStyle: { color: '#cbd5e1', fontSize: 17 },
  },
  legend: { top: 85, textStyle: { color: '#e2e8f0', fontSize: 18 } },
  grid: { left: 95, right: 40, top: 150, bottom: 110 },
  xAxis: {
    type: 'category',
    data: results.cases.map((x) => x.offset.toLocaleString('es-ES')),
    name: 'Filas previas en el recorrido',
    nameLocation: 'middle',
    nameGap: 35,
    axisLabel: { color: '#e2e8f0', fontSize: 17 },
    nameTextStyle: { color: '#e2e8f0', fontSize: 17 },
  },
  yAxis: {
    type: 'log',
    name: 'ms · escala logarítmica',
    min: 0.01,
    max: 100,
    nameTextStyle: { color: '#e2e8f0', fontSize: 17 },
    axisLabel: { color: '#e2e8f0', fontSize: 17 },
    splitLine: { lineStyle: { color: '#334155' } },
  },
  series: ['offset', 'keyset'].map((name, i) => ({
    name: ['OFFSET', 'Keyset: ancla conocida'][i],
    type: 'line',
    symbolSize: 10,
    data: results.cases.map((x) => median(x.samples.map((sample) => sample[name].ms))),
  })),
  graphic: {
    type: 'text',
    left: 24,
    bottom: 18,
    style: {
      text: 'Execution Time con EXPLAIN ANALYZE, no latencia HTTP.\nCoste de obtener el ancla excluido. Sin escrituras durante estas muestras.',
      fill: '#cbd5e1',
      fontSize: 17,
    },
  },
})
await writeFile(
  'public/assets/visuals/api-contracts/pagination-timings.svg',
  chart.renderToSVGString(),
)
chart.dispose()
