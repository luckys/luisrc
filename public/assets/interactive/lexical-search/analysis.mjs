const accentMap = {á:'a', é:'e', í:'i', ó:'o', ú:'u', ü:'u'};

export function normalize(text, {fold = false} = {}) {
  const canonical = text.normalize('NFC').toLocaleLowerCase('es');
  return fold ? canonical.replace(/[áéíóúü]/gu, c => accentMap[c]) : canonical;
}

export function tokenize(text, options = {}) {
  return normalize(text, options).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

// Deliberately incomplete: expose the effect of conflating suffixes, not Snowball.
export function pluralStem(token) {
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function lemmaLookup(token, lexicon) {
  return Object.hasOwn(lexicon, token) ? lexicon[token] : token;
}

export function charNgrams(word, n) {
  if (!Number.isInteger(n) || n < 1) throw Error('n debe ser entero positivo');
  const chars = [...word];
  return Array.from({length: Math.max(0, chars.length - n + 1)},
    (_, i) => chars.slice(i, i + n).join(''));
}

export function wordNgrams(tokens, n) {
  if (!Number.isInteger(n) || n < 1) throw Error('n debe ser entero positivo');
  return Array.from({length: Math.max(0, tokens.length - n + 1)},
    (_, i) => tokens.slice(i, i + n).join(' '));
}

export function analyzer(mode = 'literal', lexicon = {}) {
  if (!['literal','fold','plural','lookup','char3'].includes(mode)) throw Error('Analyzer desconocido');
  const foldedLexicon = Object.fromEntries(Object.entries(lexicon)
    .map(([key,value]) => [normalize(key,{fold:true}),normalize(value,{fold:true})]));
  return text => {
    const tokens = tokenize(text, {fold: mode !== 'literal'});
    if (mode === 'plural') return tokens.map(pluralStem);
    if (mode === 'lookup') return tokens.map(t => lemmaLookup(t, foldedLexicon));
    if (mode === 'char3') return tokens.flatMap(t => charNgrams(t,3));
    return tokens;
  };
}
