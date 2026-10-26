const colors=['#38bdf8','#fb923c','#a78bfa','#4ade80']
export function lineChart(series,title,{xMax=80,yMin=0,yMax=1,xLabel='Epoch completada',yLabel='Accuracy',ticks=[0,20,40,60,80],tickLabels=null}={}){
 const x=v=>58+v/xMax*300,y=v=>232-(v-yMin)/(yMax-yMin)*184
 return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="336" viewBox="0 0 380 336" role="img" aria-label="${title}"><rect width="100%" height="100%" fill="#0f172a"/><g fill="#e2e8f0" font-family="sans-serif" font-size="14"><text x="10" y="20">${title}</text><text x="58" y="40">${yLabel}</text>${[0,.25,.5,.75,1].map(f=>{const v=yMin+f*(yMax-yMin);return `<text x="52" y="${y(v)+4}" text-anchor="end">${Math.abs(v)<10?v.toFixed(2):v.toFixed(0)}</text><path d="M58,${y(v)}H358" stroke="#334155"/>`}).join('')}${ticks.map((v,i)=>`<text x="${x(v)}" y="254" text-anchor="middle">${tickLabels?.[i]??v}</text>`).join('')}<text x="58" y="278">${xLabel}</text>${series.map((s,i)=>`<polyline data-series="${s.name}" points="${s.points.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2" ${i?'stroke-dasharray="'+(i===1?'6 3':'2 3')+'"':''}/><text x="${12+i%2*186}" y="${304+Math.floor(i/2)*18}" fill="${colors[i]}">${s.name}</text>`).join('')}</g></svg>`
}
export function matrixChart(matrix,{allowed=null,row=-1,col=-1,symmetric=null,title='Pesos de atención'}={}){
 const rows=matrix.length,cols=matrix[0].length,left=44,top=46,w=292,h=Math.round(Math.min(292,rows/cols*292))
 function color(v){
  if(symmetric){const t=Math.min(1,Math.abs(v)/symmetric),target=v<0?[37,99,235]:[249,115,22];return`rgb(${target.map(c=>Math.round(241+(c-241)*t)).join(',')})`}
  return`rgb(${[15,23,42].map((a,i)=>Math.round(a+([56,189,248][i]-a)*Math.max(0,Math.min(1,v)))).join(',')})`
 }
 const cells=matrix.flatMap((values,q)=>values.map((v,k)=>{
  const x=left+k*w/cols,y=top+q*h/rows,ww=w/cols,hh=h/rows,blocked=allowed&&!allowed[q][k]
  return `<rect data-row="${q}" data-col="${k}" data-value="${v}" data-allowed="${!blocked}" x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${blocked?'#020617':color(v)}" stroke="${q===row&&k===col?'#f43f5e':'#334155'}" stroke-width="${q===row&&k===col?3:1}"/><title>Query ${q}, key ${k}: ${v}, ${blocked?'excluida':'permitida'}</title>${blocked?`<path d="M${x+3},${y+3}l${ww-6},${hh-6}m0,${6-hh}l${6-ww},${hh-6}" stroke="#64748b" stroke-width="1"/>`:''}`
 })).join('')
 return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="${h+104}" viewBox="0 0 380 ${h+104}" role="img" aria-label="${title}"><rect width="100%" height="100%" fill="#0f172a"/><g font-family="sans-serif" font-size="14" fill="#e2e8f0"><text x="10" y="20">${title}</text><text x="44" y="39">${symmetric?'Dimensión del embedding':'Key (columna)'}</text>${cells}${matrix.map((_,i)=>`<text x="32" y="${top+(i+.5)*h/rows+5}" text-anchor="end">${i}</text>`).join('')}${matrix[0].map((_,i)=>`<text x="${left+(i+.5)*w/cols}" y="${top+h+20}" text-anchor="middle">${i}</text>`).join('')}<text x="10" y="${h+94}">${symmetric?'Paso (fila); escala simétrica local':'Query (fila); pesos de 0 a 1'}</text></g></svg>`
}
