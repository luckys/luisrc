export function trajectory(kind, start, rate, steps = 30) {
  const loss = kind === 'quadratic' ? (x) => x * x : (x) => (x * x - 1) ** 2
  const gradient = kind === 'quadratic' ? (x) => 2 * x : (x) => 4 * x * (x * x - 1)
  const points = [[start, loss(start)]]
  for (let i = 0; i < steps; i++) {
    const next = points.at(-1)[0] - rate * gradient(points.at(-1)[0])
    if (!Number.isFinite(next) || Math.abs(next) > 1e6) break
    points.push([next, loss(next)])
  }
  return points
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('form')
  const output = document.querySelector('output')
  const svg = document.querySelector('svg')
  function draw() {
    const kind = form.elements.namedItem('kind').value
    const start = Number(form.elements.namedItem('start').value)
    const rate = Number(form.elements.namedItem('rate').value)
    const points = trajectory(kind, start, rate)
    const max = Math.max(1, ...points.map(([, y]) => y))
    const path = points
      .map(([, y], i) => `${20 + (i * 560) / 30},${280 - (y / max) * 250}`)
      .join(' ')
    svg.querySelector('polyline').setAttribute('points', path)
    output.textContent = `η=${rate}; x inicial=${start}; pasos=${points.length - 1}; x final=${points.at(-1)[0].toPrecision(5)}; pérdida=${points.at(-1)[1].toPrecision(5)}${points.length < 31 ? '; detenido por límite numérico' : ''}`
  }
  form.addEventListener('input', draw)
  draw()
}
