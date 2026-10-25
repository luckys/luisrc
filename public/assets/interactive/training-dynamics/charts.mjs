import {selectRuns,seriesPoints} from './model.mjs'
const colors=['#38bdf8','#fbbf24','#c4b5fd','#5eead4']
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
export function curveChart(data,{group='optimizers',seed=7,axis='updates',metric='validationLoss',epoch=80}={}){
 const runs=selectRuns(data,group,seed),series=runs.map(r=>seriesPoints(r,axis,metric))
 const maxX=Math.max(...series.flat().map(p=>p.x)),maxY=Math.max(...series.flat().map(p=>p.y))*1.06||1
 const x=v=>58+v/maxX*300,y=v=>255-v/maxY*220
 const label={updates:'Actualizaciones',epoch:'Epochs',examplesSeen:'Muestras procesadas'}[axis]
 const measure={trainLoss:'Train BCE (nats)',validationLoss:'Validation BCE (nats)',lrLast:'Última tasa usada por epoch'}[metric]
 let body=`<text x="14" y="22" font-size="14">${measure}</text>`
 for(let i=0;i<=4;i++){
  const yy=i*maxY/4,xx=i*maxX/4
  body+=`<line x1="58" x2="358" y1="${y(yy)}" y2="${y(yy)}" stroke="#334155"/><text x="52" y="${y(yy)+4}" text-anchor="end">${yy.toFixed(metric==='lrLast'?3:2)}</text><text x="${x(xx)}" y="278" text-anchor="middle">${Math.round(xx)}</text>`
 }
 series.forEach((points,i)=>{
  body+=`<polyline data-run="${runs[i].id}" points="${points.map(p=>`${x(p.x).toFixed(3)},${y(p.y).toFixed(3)}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="2"/>`
  const h=runs[i].history.find(h=>h.epoch===+epoch)
  if(h?.[metric]!==null&&h?.[metric]!==undefined)body+=`<circle data-checkpoint="${runs[i].id}" cx="${x(h[axis])}" cy="${y(h[metric])}" r="4" fill="${colors[i]}"/>`
  body+=`<circle cx="18" cy="${323+i*23}" r="4" fill="${colors[i]}"/><text x="30" y="${327+i*23}">${escape(runs[i].id)}</text>`
 })
 body+=`<text x="208" y="303" text-anchor="middle">${label}</text>`
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 425" role="img" aria-label="${escape(measure)} según ${label}. Curvas observadas; tabla numérica disponible en el visor."><rect width="380" height="425" rx="8" fill="#0f172a"/><g font-family="system-ui" font-size="14" fill="#e2e8f0">${body}</g></svg>`
}
