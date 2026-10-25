import{selectRun}from'./model.mjs'
export function curveChart(data,{kind='training',seed=7,variant='full',axis='updates',epoch=60}={}){
 if(!['epoch','updates','examplesSeen'].includes(axis))throw Error('Eje desconocido')
 const run=selectRun(data,seed),resumed=data.resumed.find(r=>r.variant===variant)
 if(!resumed||!['training','resume'].includes(kind))throw Error('Comparación desconocida')
 const all=kind==='training'?[{id:'train',label:'Train a pesos fijos',color:'#c4b5fd',rows:run.history,key:'trainLoss'},{id:'validation',label:'Validation',color:'#38bdf8',rows:run.history,key:'validationLoss'},{id:'online',label:'Train durante la epoch',color:'#fbbf24',rows:run.history,key:'onlineLoss'}]:[{id:'continuous',label:'Continuo, seed 7',color:'#38bdf8',rows:selectRun(data,7).history,key:'validationLoss'},{id:'resumed',label:'Continuación desde archivo',color:'#5eead4',rows:resumed.history,key:'validationLoss'}]
 const maxX=Math.max(...all.flatMap(s=>s.rows.map(r=>r[axis]))),maxY=Math.max(...all.flatMap(s=>s.rows.map(r=>r[s.key]).filter(v=>v!==null)))*1.06
 const x=v=>58+v/maxX*300,y=v=>255-v/maxY*220
 const label={epoch:'Epochs',updates:'Actualizaciones',examplesSeen:'Muestras procesadas'}[axis]
 let svg=`<text x="14" y="22">${kind==='training'?'BCE (nats), seed '+seed:'Validation BCE, seed 7'}</text>`
 for(let i=0;i<=4;i++){const yy=maxY*i/4,xx=maxX*i/4;svg+=`<line x1="58" x2="358" y1="${y(yy)}" y2="${y(yy)}" stroke="#334155"/><text x="52" y="${y(yy)+4}" text-anchor="end">${yy.toFixed(2)}</text><text x="${x(xx)}" y="278" text-anchor="middle">${Math.round(xx)}</text>`}
 if(kind==='resume'){const h=selectRun(data,7).history[data.protocol.checkpointEpoch];svg+=`<line data-boundary="30" x1="${x(h[axis])}" x2="${x(h[axis])}" y1="35" y2="255" stroke="#fbbf24" stroke-dasharray="4 4"/><text x="${x(h[axis])+5}" y="48" fill="#fbbf24">Guardado</text>`}
 for(const[i,s]of all.entries()){
  const points=s.rows.filter(r=>r[s.key]!==null).map(r=>`${x(r[axis]).toFixed(3)},${y(r[s.key]).toFixed(3)}`).join(' '),h=s.rows.find(r=>r.epoch===+epoch)
  svg+=`<polyline data-series="${s.id}" points="${points}" fill="none" stroke="${s.color}" stroke-width="2"${s.id==='online'?' stroke-dasharray="5 3"':''}/>`
  if(h[s.key]!==null)svg+=`<circle data-checkpoint="${s.id}" cx="${x(h[axis])}" cy="${y(h[s.key])}" r="4" fill="${s.color}"/>`
  svg+=`<circle cx="18" cy="${324+i*25}" r="4" fill="${s.color}"/><text x="30" y="${329+i*25}">${s.label}</text>`
 }
 svg+=`<text x="208" y="303" text-anchor="middle">${label}</text>`
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 425" role="img" aria-label="${kind==='training'?'Train, validation y loss online':'Continuo y reanudación'}: observaciones sobre ${label}. Valores en las tablas del visor."><rect width="380" height="425" fill="#0f172a" rx="8"/><g font-family="system-ui" font-size="14" fill="#e2e8f0">${svg}</g></svg>`
}
export function resumeErrors(data){
 const labels={full:'Completa',optimizer_reset:'Reiniciar momentum',order_reset:'Reiniciar orden',weights_only:'Solo modelo'},max=Math.max(...data.resumed.map(r=>r.maxParameterError))
 let svg='<text x="14" y="24" font-size="15">Desviación final respecto al continuo</text><text x="14" y="45">Máximo error absoluto de parámetros</text>'
 data.resumed.forEach((r,i)=>{const yy=78+i*70;svg+=`<text x="14" y="${yy}">${labels[r.variant]}</text><text x="365" y="${yy+20}" text-anchor="end">${r.maxParameterError===0?'0':r.maxParameterError.toFixed(6)}</text><rect data-variant="${r.variant}" x="14" y="${yy+27}" width="${(330*r.maxParameterError/max).toFixed(3)}" height="12" fill="${i?'#fbbf24':'#5eead4'}"/>`})
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 350" role="img" aria-label="Error de parámetros final: completa cero, reiniciar momentum0,014657, orden0,003181 y solo modelo0,340889. No mide calidad de predicción."><rect width="380" height="350" fill="#0f172a" rx="8"/><g font-family="system-ui" font-size="14" fill="#e2e8f0">${svg}</g></svg>`
}
