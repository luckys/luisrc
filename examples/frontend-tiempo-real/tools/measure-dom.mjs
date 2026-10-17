import { chromium } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'
import { cpus, platform } from 'node:os'

// Microexperimento DOM aislado: no mide INP ni React.
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.setContent('<style>li { height:32px } ul { margin:0 }</style><main></main>')
  const samples = []
  for (let round = -1; round < 7; round++) {
    for (const mounted of round % 2 === 0 ? [5000, 14] : [14, 5000]) {
      const ms = await page.evaluate((count) => {
        const root = document.querySelector('main')
        root.replaceChildren()
        const start = performance.now()
        const list = document.createElement('ul')
        for (let index = 0; index < count; index++) {
          const row = document.createElement('li')
          row.textContent = `Entrega ${index + 1}`
          list.append(row)
        }
        root.append(list)
        // Fuerza layout. No incluye necesariamente rasterización ni presentación.
        root.getBoundingClientRect()
        return performance.now() - start
      }, mounted)
      if (round >= 0) samples.push({ round, mounted, ms })
    }
  }
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const result = {
    measured_at: new Date().toISOString(),
    node: process.version,
    chromium: browser.version(),
    os: platform(),
    cpu: cpus()[0]?.model,
    viewport: { width: 1280, height: 720 },
    logical_rows: 5000,
    warmup_rounds: 1,
    sample_rounds: 7,
    metric: 'DOM creation + synchronous layout, milliseconds; not INP',
    samples,
    medians: [5000, 14].map((mounted) => ({
      mounted,
      ms: median(
        samples.filter((sample) => sample.mounted === mounted).map((sample) => sample.ms),
      ),
    })),
  }
  await mkdir('results', { recursive: true })
  await writeFile('results/dom.json', JSON.stringify(result, null, 2) + '\n')
  console.log(result.medians)
} finally {
  await browser.close()
}
