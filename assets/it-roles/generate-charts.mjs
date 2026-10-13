import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as echarts from 'echarts'

const locale = process.argv[2] ?? 'es'
if (!['es', 'en'].includes(locale)) {
  throw new Error('Supported chart locales: es, en')
}
const translations =
  locale === 'en'
    ? JSON.parse(await readFile(new URL('./en/chart-text.json', import.meta.url), 'utf8'))
    : undefined
const data = JSON.parse(
  await readFile(
    new URL('../../public/assets/data/it-roles-2026-10-13.json', import.meta.url),
    'utf8',
  ),
)
const output = new URL(
  `../../public/assets/visuals/it-roles/${locale === 'en' ? 'en/' : ''}`,
  import.meta.url,
)
await mkdir(output, { recursive: true })
const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
const number = new Intl.NumberFormat(numberLocale, { useGrouping: 'always' })
const percentNumber = new Intl.NumberFormat(numberLocale, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const percent = (value) => `${value > 0 ? '+' : ''}${percentNumber.format(value)} %`
const ink = '#172b3a'
const blue = '#12638b'
const orange = '#a44720'

const localizeRows = (rows, labels) =>
  rows.map((row) => ({
    ...row,
    label: labels?.[row.code ?? row.sourceLabel] ?? row.label,
  }))
const postingLegend = translations?.usPostings.legend ?? [
  'Frente al 02/10/2025',
  'Frente al 01/02/2020',
]

async function render(
  name,
  title,
  subtitle,
  rows,
  series,
  axis,
  footer,
  height = 520,
  legend,
) {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 640,
    height,
  })
  try {
    chart.setOption({
      animation: false,
      backgroundColor: '#ffffff',
      textStyle: { fontFamily: 'Arial, sans-serif', color: ink },
      title: {
        text: title,
        subtext: subtitle,
        left: 22,
        top: 20,
        textStyle: { fontSize: 25, color: ink },
        subtextStyle: { fontSize: 17, color: '#475569', lineHeight: 24 },
      },
      legend: legend
        ? {
            data: legend,
            top: 96,
            left: 22,
            itemWidth: 20,
            textStyle: { fontSize: 17, color: ink },
            selectedMode: false,
          }
        : undefined,
      grid: { left: 240, right: 90, top: legend ? 155 : 115, bottom: 98 },
      xAxis: {
        type: 'value',
        ...axis,
        axisLabel: { fontSize: 17, color: '#475569', formatter: axis.formatter },
        splitLine: { lineStyle: { color: '#dce4ec' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map((row) => row.label),
        axisLabel: { fontSize: 21, color: ink, lineHeight: 26, margin: 18 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series,
      graphic: [
        {
          type: 'text',
          left: 22,
          bottom: 18,
          style: {
            text: footer,
            fill: '#475569',
            font: '17px Arial, sans-serif',
            lineHeight: 24,
          },
        },
      ],
    })
    const svg = chart.renderToSVGString()
    await writeFile(new URL(name, output), svg)
    console.log(
      `${fileURLToPath(new URL(name, output))}: ${Buffer.byteLength(svg)} bytes`,
    )
  } finally {
    chart.dispose()
  }
}

await render(
  'eu-job-postings-2024.svg',
  translations?.europe.title ?? 'UE: anuncios online por ocupación',
  translations?.europe.subtitle ??
    '2024 · cuatro categorías seleccionadas · miles de anuncios',
  localizeRows(data.europe.rows, translations?.europe.labels),
  [
    {
      type: 'bar',
      barWidth: 30,
      data: data.europe.rows.map((row) => row.advertisementsThousands),
      itemStyle: { color: blue },
      label: {
        show: true,
        position: 'right',
        fontSize: 22,
        color: ink,
        formatter: ({ value }) => number.format(value),
      },
    },
  ],
  { min: 0, max: 400, interval: 100, formatter: (value) => number.format(value) },
  translations?.europe.footer ??
    'Fuente: Eurostat, jvs_a_isco3_r1 · OJA · UE-27\nEstadísticas experimentales. Serie con ruptura en 2024.',
)

await render(
  'us-job-postings-growth-2026.svg',
  translations?.usPostings.title ?? 'EE. UU.: recuperación con límites',
  translations?.usPostings.subtitle ??
    'Anuncios en Indeed al 02/10/2026 · variación porcentual',
  localizeRows(data.usPostings.rows, translations?.usPostings.labels),
  [
    {
      name: postingLegend[0],
      type: 'bar',
      barWidth: 24,
      data: data.usPostings.rows.map((row) => (row.indexTo / row.indexFrom - 1) * 100),
      itemStyle: { color: blue },
      label: {
        show: true,
        position: 'right',
        fontSize: 21,
        color: ink,
        formatter: ({ value }) => percent(value),
      },
    },
    {
      name: postingLegend[1],
      type: 'bar',
      barWidth: 24,
      data: data.usPostings.rows.map((row) => row.indexTo - 100),
      itemStyle: { color: orange },
      label: {
        show: true,
        position: 'insideLeft',
        fontSize: 20,
        color: '#ffffff',
        formatter: ({ value }) => percent(value),
      },
    },
  ],
  { min: -40, max: 40, interval: 20, formatter: (value) => `${value} %` },
  translations?.usPostings.footer ??
    'Fuente: Indeed Hiring Lab · cálculo propio sobre sus índices\nAjuste estacional y media móvil de 7 días. CC BY 4.0.',
  610,
  postingLegend,
)

await render(
  'us-employment-projections-2025-2035.svg',
  translations?.usProjections.title ?? 'EE. UU.: empleo proyectado',
  translations?.usProjections.subtitle ??
    '2025–2035 · variación total en diez años · selección de ocupaciones',
  localizeRows(data.usProjections.rows, translations?.usProjections.labels),
  [
    {
      type: 'bar',
      barWidth: 30,
      data: data.usProjections.rows.map((row) => ({
        value: row.growthPercent,
        itemStyle: { color: row.growthPercent >= 0 ? blue : orange },
      })),
      label: {
        show: true,
        position: 'right',
        fontSize: 22,
        color: ink,
        formatter: ({ value }) => percent(value),
      },
    },
  ],
  { min: -10, max: 40, interval: 10, formatter: (value) => `${value} %` },
  translations?.usProjections.footer ??
    'Fuente: U.S. Bureau of Labor Statistics · tabla 1.2\nSon proyecciones de empleo, no anuncios ni crecimiento observado.',
  650,
)

await render(
  'us-ai-skill-postings-2024-2025.svg',
  translations?.usAiSkills.title ?? 'EE. UU.: demanda de habilidades de IA',
  translations?.usAiSkills.subtitle ??
    '2024 frente a 2025 · anuncios que mencionan cada habilidad',
  localizeRows(data.usAiSkills.rows, translations?.usAiSkills.labels),
  [
    {
      name: '2024',
      type: 'bar',
      barWidth: 24,
      data: data.usAiSkills.rows.map((row) => row.countFrom),
      itemStyle: { color: '#64748b' },
      label: {
        show: true,
        position: 'right',
        fontSize: 21,
        color: ink,
        formatter: ({ value }) => number.format(value),
      },
    },
    {
      name: '2025',
      type: 'bar',
      barWidth: 24,
      data: data.usAiSkills.rows.map((row) => row.countTo),
      itemStyle: { color: blue },
      label: {
        show: true,
        position: 'right',
        fontSize: 21,
        color: ink,
        formatter: ({ value }) => number.format(value),
      },
    },
  ],
  { min: 0, max: 30000, interval: 10000, formatter: (value) => number.format(value) },
  translations?.usAiSkills.footer ??
    'Fuente: Lightcast · Stanford HAI, AI Index 2026\nAnuncios por habilidad. Las categorías pueden solaparse.',
  610,
  ['2024', '2025'],
)
