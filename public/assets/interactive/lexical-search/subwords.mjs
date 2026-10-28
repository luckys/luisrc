const mergePair = (parts,left,right) => {
  const result = [];
  for (let i=0;i<parts.length;i++) {
    if (parts[i] === left && parts[i+1] === right) { result.push(left+right); i++; }
    else result.push(parts[i]);
  }
  return result;
};

export function trainBpe(wordCounts, steps) {
  const words = Object.entries(wordCounts).map(([word,count]) => ({parts:[...word],count}));
  const merges = [], trace = [];
  for (let step=0;step<steps;step++) {
    const pairs = new Map();
    for (const {parts,count} of words) for (let i=0;i<parts.length-1;i++) {
      const key = JSON.stringify([parts[i],parts[i+1]]);
      pairs.set(key,(pairs.get(key) ?? 0) + count);
    }
    const ordered = [...pairs].sort((a,b) => b[1]-a[1] || (a[0]<b[0]?-1:1));
    if (!ordered.length) break;
    const [key,frequency] = ordered[0], [left,right] = JSON.parse(key);
    merges.push([left,right]);
    for (const word of words) word.parts = mergePair(word.parts,left,right);
    trace.push({step:step+1,pair:[left,right],frequency,words:words.map(w=>({...w,parts:[...w.parts]}))});
  }
  return {merges,trace};
}

export function applyBpe(word, merges) {
  return merges.reduce((parts,[left,right]) => mergePair(parts,left,right), [...word]);
}

export function wordPiece(word, vocabulary) {
  const vocab = new Set(vocabulary), chars = [...word], result = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length, piece;
    for (; end > start; end--) {
      const candidate = (start ? '##' : '') + chars.slice(start,end).join('');
      if (vocab.has(candidate)) { piece = candidate; break; }
    }
    if (!piece) return ['[UNK]'];
    result.push(piece);
    start = end;
  }
  return result;
}
