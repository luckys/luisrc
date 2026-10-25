import{snapshot}from'./model.mjs'
const palette=['#38bdf8','#fbbf24','#c4b5fd','#5eead4'],esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
function plot(series,{title,xLabel,minX=0,maxX,minY=0,maxY,marks=[],scatter=[],xTicks=null}){
 const x=v=>58+(v-minX)/(maxX-minX)*300,y=v=>255-(v-minY)/(maxY-minY)*215
 let body=`<text x="14" y="22">${esc(title)}</text>`
 for(let i=0;i<=4;i++){const xx=xTicks?xTicks[i]:minX+i*(maxX-minX)/4,yy=minY+i*(maxY-minY)/4;body+=`<line x1="58" x2="358" y1="${y(yy)}" y2="${y(yy)}" stroke="#334155"/><text x="52" y="${y(yy)+4}" text-anchor="end">${yy.toFixed(2)}</text><text x="${x(xx)}" y="278" text-anchor="middle">${Number(xx.toPrecision(3))}</text>`}
 series.forEach((s,i)=>{
  body+=`<polyline data-series="${s.id}" points="${s.points.map(p=>`${x(p.x).toFixed(3)},${y(p.y).toFixed(3)}`).join(' ')}" fill="none" stroke="${palette[i]}" stroke-width="2"/>`
  body+=`<circle cx="18" cy="${326+i*24}" r="4" fill="${palette[i]}"/><text x="30" y="${331+i*24}">${esc(s.label)}</text>`
 })
 for(const p of marks)body+=`<circle data-mark="${p.id}" cx="${x(p.x)}" cy="${y(p.y)}" r="4" fill="${p.color??'#f8fafc'}"/>`
 for(const[p,i]of scatter.map((p,i)=>[p,i]))body+=`<circle data-sample="${i}" cx="${x(p.x)}" cy="${y(p.y)}" r="3" fill="${p.special?'#fb7185':'#cbd5e1'}"/>`
 body+=`<text x="208" y="304" text-anchor="middle">${esc(xLabel)}</text>`
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" role="img" aria-label="${esc(title)} según ${esc(xLabel)}. Valores archivados, disponibles en tablas del visor."><rect width="380" height="440" rx="8" fill="#0f172a"/><g font-family="system-ui" font-size="14" fill="#e2e8f0">${body}</g></svg>`
}
export function curvesChart(run,index=run.history.length-1){
 const row=run.history[index],maxY=Math.max(...run.history.flatMap(h=>[h.trainMse,h.validationMse]))*1.05
 return plot([{id:'train',label:'Train en eval',points:run.history.map(h=>({x:h.epoch,y:h.trainMse}))},{id:'validation',label:'Validation en eval',points:run.history.map(h=>({x:h.epoch,y:h.validationMse}))}],{title:'MSE: '+run.id,xLabel:'Epochs / updates full-batch',maxX:run.last.epoch,maxY,marks:[{id:'train',x:row.epoch,y:row.trainMse},{id:'validation',x:row.epoch,y:row.validationMse}]})
}
export function fitChart(data,run,phase='last'){
 const h=snapshot(run,phase),bound=Math.ceil(Math.max(...data.data.y.map(Math.abs),...['initial','last','best','selected'].flatMap(k=>run[k].prediction.map(Math.abs)),1)*1.1)
 return plot([{id:'signal',label:'Señal conocida',points:data.data.grid.map((x,i)=>({x,y:data.data.truth[i]}))},{id:'prediction',label:'Predicción del snapshot',points:data.data.grid.map((x,i)=>({x,y:h.prediction[i]}))}],{title:`Función: ${phase}, epoch ${h.epoch}`,xLabel:'x; train gris, alterado rojo',minX:-1,maxX:1,minY:-bound,maxY:bound,scatter:data.data.x.map((x,i)=>({x,y:data.data.y[i],special:i===data.protocol.data.outlierIndex}))})
}
export function initializationChart(data,metric='secondMoment',scheme='xavier_tanh',layer=0){
 if(!['secondMoment','gradientNorm','saturationFraction'].includes(metric))throw Error('Métrica desconocida')
 const series=data.initialization.map(r=>({id:r.id,label:r.id+(r.layers.every(l=>l[metric]===null)?' (no aplica)':''),points:r.layers.flatMap((l,i)=>l[metric]===null?[]:[{x:i+1,y:l[metric]}])})),selected=data.initialization.find(r=>r.id===scheme),value=selected.layers[layer][metric]
 return plot(series,{title:{secondMoment:'Segundo momento de activaciones',gradientNorm:'Norma de gradientes de weights',saturationFraction:'Fracción |tanh| > 0,99'}[metric],xLabel:'Capa oculta',minX:1,maxX:8,xTicks:[1,2,4,6,8],maxY:Math.max(...series.flatMap(s=>s.points.map(p=>p.y)),.001)*1.05,marks:value===null?[]:[{id:'layer',x:layer+1,y:value}]})
}
export function clippingChart(data,kind='clipped',index=0){
 const selected=data.clipping.curves.find(r=>r.id===kind),row=selected.history[index]
 const series=data.clipping.curves.map(r=>({id:r.id,label:r.id,points:r.history.map(h=>({x:h.step,y:Math.log10(1+h.loss)}))}))
 return plot(series,{title:'Control: log10(1 + MSE)',xLabel:'Updates en la parábola',maxX:40,maxY:Math.max(...series.flatMap(s=>s.points.map(p=>p.y)))*1.05,marks:[{id:'clip',x:row.step,y:Math.log10(1+row.loss)}]})
}
export function biasChart(data,degree=5){
 const models=data.biasVariance.models,max=Math.max(...models.map(r=>r.cleanRisk));let body='<text x="14" y="24">Error contra la señal, sin ruido nuevo</text><text x="14" y="47">Escala lineal común; 32 ajustes por grado</text>'
 models.forEach((r,i)=>{const yy=85+i*90;body+=`<text x="14" y="${yy}">Grado ${r.degree}: riesgo ${r.cleanRisk.toFixed(4)}</text><rect data-degree="${r.degree}" data-part="bias" x="14" y="${yy+16}" width="${(330*r.biasSquared/max).toFixed(3)}" height="20" fill="#38bdf8"/><rect data-degree="${r.degree}" data-part="variance" x="${14+330*r.biasSquared/max}" y="${yy+16}" width="${(330*r.variance/max).toFixed(3)}" height="20" fill="#fbbf24"/>${r.degree===+degree?`<rect x="8" y="${yy-20}" width="350" height="62" rx="4" fill="none" stroke="#f8fafc"/>`:''}`})
 body+='<text x="14" y="375" fill="#38bdf8">Azul: bias² del conjunto finito</text><text x="14" y="400" fill="#fbbf24">Amarillo: variance, divisor 32</text>'
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" role="img" aria-label="Descomposición del error del conjunto finito de regresores. Bias cuadrado más variance coincide con riesgo contra señal. No es un experimento de redes neuronales."><rect width="380" height="440" rx="8" fill="#0f172a"/><g font-family="system-ui" font-size="14" fill="#e2e8f0">${body}</g></svg>`
}
