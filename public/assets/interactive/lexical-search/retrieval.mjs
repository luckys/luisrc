import {analyzer} from './analysis.mjs';

const countsOf = tokens => {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
};

export function buildIndex(corpus, analyze = analyzer()) {
  if (!corpus.length) throw Error('Corpus vacío');
  const postings = new Map(), df = new Map(), ids = new Set();
  const documents = corpus.map(doc => {
    if (!doc.id || ids.has(doc.id)) throw Error('ID duplicado o vacío');
    ids.add(doc.id);
    const tokens = analyze((doc.title ?? '') + ' ' + doc.body);
    const counts = countsOf(tokens);
    for (const [term,tf] of counts) {
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(doc.id,tf);
      df.set(term,(df.get(term) ?? 0) + 1);
    }
    return {...doc, tokens, counts, length:tokens.length};
  });
  const avgLength = documents.reduce((s,d) => s + d.length,0) / documents.length;
  if (!avgLength) throw Error('No hay tokens indexables');
  return {documents, postings, df, avgLength, analyze};
}

export function bm25Contribution(tf, df, N, length, avgLength, k1, b) {
  if (!tf) return 0;
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const lengthFactor = 1 - b + b * length / avgLength;
  return idf * tf * (k1 + 1) / (tf + k1 * lengthFactor);
}

export function cosineScore(index, id, queryTokens) {
  const doc = index.documents.find(d => d.id === id);
  if (!doc) throw Error('Documento desconocido');
  const query = countsOf(queryTokens.filter(t => index.df.has(t)));
  const idf = t => Math.log((1 + index.documents.length) / (1 + index.df.get(t))) + 1;
  let dot = 0, docSquared = 0, querySquared = 0;
  for (const [t,tf] of doc.counts) docSquared += (tf * idf(t)) ** 2;
  for (const [t,tf] of query) {
    const weight = tf * idf(t);
    querySquared += weight ** 2;
    dot += weight * (doc.counts.get(t) ?? 0) * idf(t);
  }
  return docSquared && querySquared ? dot / Math.sqrt(docSquared * querySquared) : 0;
}

export function search(index, query, {method = 'bm25', k1 = 1.2, b = 0.75} = {}) {
  if (!['bm25','tfidf'].includes(method) || !Number.isFinite(k1) || k1 < 0 || !Number.isFinite(b) || b < 0 || b > 1)
    throw Error('Parámetros de búsqueda inválidos');
  const queryTokens = index.analyze(query);
  const terms = [...new Set(queryTokens)];
  const candidates = new Set(terms.flatMap(t => [...(index.postings.get(t)?.keys() ?? [])]));
  const rows = index.documents.filter(d => candidates.has(d.id)).map(doc => {
    const contributions = terms.filter(t => doc.counts.has(t)).map(term => ({
      term, tf:doc.counts.get(term), df:index.df.get(term), length:doc.length,
      idf:Math.log(1 + (index.documents.length - index.df.get(term) + .5) / (index.df.get(term) + .5)),
      contribution:bm25Contribution(doc.counts.get(term),index.df.get(term),index.documents.length,doc.length,index.avgLength,k1,b),
    }));
    const score = method === 'tfidf' ? cosineScore(index,doc.id,queryTokens)
      : contributions.reduce((s,t) => s + t.contribution,0);
    return {id:doc.id, score, terms:method === 'bm25' ? contributions : []};
  });
  return rows.filter(r => r.score > 0).sort((a,b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
