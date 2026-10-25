import {infer,activation} from './inference.mjs'
export const colors=['#cbd5e1','#fb923c','#38bdf8','#c4b5fd','#4ade80']
const start=(h,label)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 ${h}" role="img" aria-label="${label}"><rect width="380" height="${h}" fill="#0f172a"/><g fill="#e2e8f0" font-family="system-ui" font-size="12">`
const end='</g></svg>'
export function lossChart(cases, selected=null, index=0){
 const all=selected?[selected]:cases
 const max=Math.ceil(Math.max(...cases.flatMap(c=>c.history.flatMap(h=>[h.trainLoss,h.validationLoss])))*5)/5
 const x=e=>42+e/3000*305,y=v=>250-v/max*200
 const points=(c,key)=>c.history.map(h=>`${x(h.epoch).toFixed(2)},${y(h[key]).toFixed(2)}`).join(' ')
 let out=start(435,'Curvas de binary cross entropy observadas durante entrenamiento NumPy. Ejes epoch y loss, sin tiempo de rendimiento.')+`<text x="18" y="23">${selected?'Train y validation del recorrido':'Loss de train: cinco recorridos'}</text><text x="18" y="42">Mismos datos; 3000 epochs full-batch</text>`
 for(let i=0;i<=4;i++){const v=max*i/4;out+=`<path d="M42 ${y(v)}H347" stroke="#334155"/><text x="3" y="${y(v)+4}">${v.toFixed(2)}</text>`}
 for(const e of [0,1500,3000])out+=`<text x="${x(e)-12}" y="274">${e}</text>`
 out+='<text x="282" y="295">epoch</text>'
 if(selected){
  for(const [i,key]of ['trainLoss','validationLoss'].entries())out+=`<polyline id="${key}" points="${points(selected,key)}" stroke="${i?'#fb923c':'#38bdf8'}" stroke-width="2" fill="none"/>`
  out+=`<circle id="loss-cursor" cx="${x(selected.history[index].epoch).toFixed(2)}" cy="${y(selected.history[index].trainLoss).toFixed(2)}" r="4" fill="#fbbf24"/><text x="18" y="323" fill="#38bdf8">Azul: train</text><text x="18" y="347" fill="#fb923c">Naranja: validation</text><text x="18" y="380">Puntos archivados cada 150 epochs</text>`
 }else for(const [i,c]of cases.entries())out+=`<polyline points="${points(c,'trainLoss')}" stroke="${colors[i]}" stroke-dasharray="${i===1?'5 4':'none'}" stroke-width="2" fill="none"/><text x="18" y="${320+i*21}" fill="${colors[i]}">${c.id}</text>`
 return out+end
}
export function heatmap(data,c,snapshot,mode='probability',unit=0){
 const grid=data.results.grid,{min,max,size}=grid,scale=310/(max-min),step=(max-min)/size
 const x=v=>35+(v-min)*scale,y=v=>50+(max-v)*scale
 const color=v=>{const t=Math.max(0,Math.min(1,v));return `rgb(${Math.round(30+164*t)},${Math.round(58+7*t)},${Math.round(138-126*t)})`}
 let out=start(460,'Mapa de inferencia sobre un grid de 25 por 25. Las cajas delimitan el soporte de datos; los huecos del grid no tienen evaluación de generalización.')+`<text x="18" y="23">${c.id}, epoch ${snapshot.epoch}</text>`
 for(const [i,p]of grid.points.entries()){
  const result=infer(p,snapshot.layers),v=mode==='probability'?result.probability:(result.hidden[unit]+1)/2
  out+=`<rect data-cell="${i}" x="${(x(p[0])-step*scale/2).toFixed(2)}" y="${(y(p[1])-step*scale/2).toFixed(2)}" width="${(step*scale+.1).toFixed(2)}" height="${(step*scale+.1).toFixed(2)}" fill="${color(v)}"/>`
 }
 for(const a of [-1,1])for(const b of [-1,1]){
  const h=data.protocol.dataset.halfWidth
  out+=`<rect x="${x(a-h)}" y="${y(b+h)}" width="${2*h*scale}" height="${2*h*scale}" fill="none" stroke="#f8fafc" stroke-dasharray="4 3"/>`
 }
 const validation=data.results.splits.validation
 for(let i=0;i<validation.x.length;i+=4){const p=validation.x[i],cx=x(p[0]),cy=y(p[1]);out+=validation.y[i]===0?`<circle cx="${cx}" cy="${cy}" r="2.5" stroke="#fff" fill="none"/>`:`<path d="M${cx-2.5} ${cy-2.5}l5 5m0 -5l-5 5" stroke="#fff"/>`}
 for(const v of [-1,0,1])out+=`<text x="${x(v)-5}" y="380">${v}</text><text x="6" y="${y(v)+4}">${v}</text>`
 out+=`<text x="331" y="399">x1</text><text x="6" y="40">x2</text><text x="18" y="420">${mode==='probability'?'Color: p(y=1), sin calibración verificada':'Color: activación h'+(unit+1)+' de -1 a 1'}</text><text x="18" y="440">32 puntos validation: círculo 0; cruz 1</text><text x="18" y="456">Cajas: soporte; grid incluye zonas sin datos</text>`
 return out+end
}
export function activationChart(kind='tanh',value=0,all=false){
 const x=v=>42+(v+5)*30.5,y=v=>300-(v+1)*40
 let out=start(385,'Funciones de activación calculadas. Mismo eje x de menos cinco a cinco y eje y de menos uno a cinco.')+'<text x="18" y="23">Funciones de activación</text>'
 for(const v of [-1,0,1,3,5])out+=`<path d="M42 ${y(v)}H347" stroke="#334155"/><text x="8" y="${y(v)+4}">${v}</text>`
 for(const v of [-5,0,5])out+=`<text x="${x(v)-5}" y="324">${v}</text>`
 for(const k of all?['tanh','sigmoid','relu']:[kind]){
  const points=Array.from({length:101},(_,i)=>{const v=-5+i/10;return `${x(v).toFixed(2)},${y(activation(k,v)).toFixed(2)}`}).join(' ')
  const color={tanh:'#38bdf8',sigmoid:'#c4b5fd',relu:'#4ade80'}[k]
  out+=`<polyline id="activation-${k}" points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`
 }
 if(!all)out+=`<circle id="activation-cursor" cx="${x(value).toFixed(2)}" cy="${y(activation(kind,value)).toFixed(2)}" r="4" fill="#fbbf24"/>`
 out+='<text x="18" y="353" fill="#38bdf8">tanh</text><text x="112" y="353" fill="#c4b5fd">sigmoid</text><text x="230" y="353" fill="#4ade80">ReLU</text><text x="18" y="376">Mismo rango de ejes en todas las vistas</text>'
 return out+end
}
