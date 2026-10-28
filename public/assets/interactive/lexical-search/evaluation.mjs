export function metrics(ranking, relevantIds, k = 3) {
  if (!Number.isInteger(k) || k < 1) throw Error('k inválido');
  if (new Set(ranking.map(r => r.id)).size !== ranking.length) throw Error('Ranking duplicado');
  if (!relevantIds.length) return null;
  const relevant = new Set(relevantIds);
  const top = ranking.slice(0,k);
  const hits = top.filter(r => relevant.has(r.id)).length;
  const first = top.findIndex(r => relevant.has(r.id));
  return {precision:hits/k, recall:hits/relevant.size, rr:first < 0 ? 0 : 1/(first+1), hits};
}

export function summarize(rows) {
  const values = rows.flatMap(r => r.metrics ? [r.metrics] : []);
  const mean = key => values.length ? values.reduce((s,m) => s + m[key],0) / values.length : null;
  return {answerable:values.length, precision:mean('precision'), recall:mean('recall'), mrr:mean('rr')};
}
