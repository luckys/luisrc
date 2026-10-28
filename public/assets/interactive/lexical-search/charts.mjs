const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bars(title,rows,{maximum=1,unit='',digits=3}={}) {
 const w=380,h=70+rows.length*48;
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(title)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#0f172a"/><g font-family="system-ui" fill="#e2e8f0"><text x="12" y="24" font-size="14">${escape(title)}</text>${rows.map((r,i)=>{const y=49+i*48;return `<text x="12" y="${y}" font-size="12">${escape(r.label)}</text><rect x="12" y="${y+6}" width="${300*r.value/maximum}" height="12" fill="#38bdf8"/><text x="320" y="${y+17}" font-size="11">${r.value.toFixed(digits).replace('.',',')}${escape(unit)}</text>`}).join('')}<text x="12" y="${h-8}" font-size="11">Escala desde 0 hasta ${maximum.toFixed(digits).replace('.',',')}${escape(unit)}</text></g></svg>`;
}
