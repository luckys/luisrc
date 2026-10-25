// Coordinates from observed samples only; this is not an HPA algorithm model.
export function chartSeries(samples) {
  if (!samples.length) throw Error('samples_required')
  const first = samples[0].elapsedMs, last = samples.at(-1).elapsedMs, span = Math.max(last - first, 1)
  const point = (sample, value) => [40 + 310 * (sample.elapsedMs - first) / span, 245 - 180 * value / 3]
  const points = (key) => samples.filter((s) => Number.isFinite(s[key]) && (key !== 'desired' || Number.isFinite(s.cpuPercent))).map((s) => point(s, s[key]).map((v) => v.toFixed(2)).join(',')).join(' ')
  return { desired: points('desired'), ready: points('ready'), first, last, span, point }
}
