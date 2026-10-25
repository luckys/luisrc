import{comparisonVector,methodNames}from'./model.mjs'
const colors=['#38bdf8','#c4b5fd','#4ade80']
const start=(height,label)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 ${height}" role="img" aria-label="${label}"><rect width="380" height="${height}" fill="#0f172a"/><g fill="#e2e8f0" font-family="system-ui" font-size="14">`
const end='</g></svg>'
export function errorChart(data,caseIndex=0,epsilonIndex=2){
 const all=data.cases.flatMap(c=>c.finite.map(f=>Math.log10(Math.max(1e-16,f.maxAbsError))))
 const low=Math.floor(Math.min(...all)),high=Math.ceil(Math.max(...all)),x=i=>330-i*285/6,y=log=>250-(log-low)*190/(high-low)
 let svg=start(425,'Error absoluto máximo observado de diferencias finitas frente a backward manual; ambos ejes logarítmicos. Tres configuraciones y siete epsilons.')+'<text x="18" y="24">Error absoluto máximo en 17 parámetros</text><text x="18" y="43">Diferencias centrales float64; ejes log</text>'
 for(let exp=low;exp<=high;exp+=2)svg+=`<path d="M45 ${y(exp)}H330" stroke="#334155"/><text x="2" y="${y(exp)+4}">1e${exp}</text>`
 for(let i=0;i<7;i++)svg+=`<text x="${x(i)-16}" y="274">1e${Math.round(Math.log10(data.cases[0].finite[i].epsilon))}</text>`
 for(const[i,c]of data.cases.entries()){
  const points=c.finite.map((f,j)=>`${x(j).toFixed(2)},${y(Math.log10(Math.max(1e-16,f.maxAbsError))).toFixed(2)}`).join(' ')
  svg+=`<polyline id="error-${i}" points="${points}" fill="none" stroke="${colors[i]}" stroke-width="2"/><text x="18" y="${327+i*23}" fill="${colors[i]}">${c.id}</text>`
 }
 const point=data.cases[caseIndex].finite[epsilonIndex]
 svg+=`<circle id="error-cursor" cx="${x(epsilonIndex).toFixed(2)}" cy="${y(Math.log10(Math.max(1e-16,point.maxAbsError))).toFixed(2)}" r="4" fill="#fbbf24"/><text x="265" y="298">epsilon</text><text x="18" y="410">Precisión comprobada, no tiempo de ejecución</text>`
 return svg+end
}
export function gradientChart(data,caseIndex=0,method='extra_sigmoid',epsilonIndex=2,selected=-1){
 const values=data.cases.flatMap(c=>[...c.manual,...comparisonVector(c,method,epsilonIndex)]).filter(Number.isFinite)
 const max=Math.max(...values.map(Math.abs),1e-12),c=data.cases[caseIndex],other=comparisonVector(c,method,epsilonIndex),centre=221,span=123
 let svg=start(470,'Gradientes con signo para los diecisiete parámetros. Azul es manual, naranja la comparación elegida. None significa gradiente no acumulado, no cero.')+`<text x="18" y="23">${c.id}: gradientes con signo</text><text x="18" y="43">${methodNames[method]}</text><text x="91" y="65">${(-max).toExponential(1)}</text><text x="217" y="65">0</text><text x="302" y="65">${max.toExponential(1)}</text><path d="M${centre} 74V404" stroke="#64748b"/>`
 for(let i=0;i<c.manual.length;i++){
  const y=82+i*18
  if(i===selected)svg+=`<rect x="4" y="${y-2}" width="370" height="18" fill="#1e293b"/>`
  svg+=`<text x="8" y="${y+10}" font-size="13">${c.names[i]}</text>`
  for(const[j,v]of[c.manual[i],other[i]].entries()){
   if(v===null){svg+=`<text x="${centre+6}" y="${y+12}" font-size="10" fill="#fb923c">None</text>`;continue}
   const length=span*Math.abs(v)/max,left=v<0?centre-length:centre
   svg+=`<rect data-parameter="${i}" data-series="${j}" x="${left.toFixed(2)}" y="${y+j*7}" width="${length.toFixed(2)}" height="4" fill="${j?'#fb923c':'#38bdf8'}"/>`
  }
 }
 return svg+'<text x="18" y="428" fill="#38bdf8">Azul: backward manual</text><text x="18" y="450" fill="#fb923c">Naranja: método o error seleccionado</text>'+end
}
