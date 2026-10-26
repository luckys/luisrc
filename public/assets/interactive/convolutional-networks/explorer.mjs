import{terms,selectFeature,selectRun,checkpoint,scaleBounds,pixel,format}from'./model.mjs'
import{heatmap,curve}from'./charts.mjs'
const $=id=>document.getElementById(id)
const table=(headers,rows)=>`<div class="scroll" tabindex="0" role="region" aria-label="Tabla de observaciones"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${typeof v==='number'?format(v):v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
const options=(id,items)=>{$(id).innerHTML=items.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}
const clamp=(id,max)=>{$(id).max=max;$(id).value=Math.min(max,Math.max(0,Math.trunc(Number($(id).value)||0)));return Number($(id).value)}
try{
 const response=await fetch('./comparison.json');if(!response.ok)throw Error('HTTP '+response.status)
 const data=await response.json()
 options('geometry',data.probes.cases.map((c,i)=>[i,`s=${c.stride}, p=${c.padding}, d=${c.dilation}`]))
 options('sample',data.features.map((f,i)=>[i,`${data.protocol.classes[f.label]} · índice ${f.index}`]))
 options('stage',Object.keys(data.features[0].maps).map(s=>[s,s]));options('grad-channel',Array.from({length:8},(_,i)=>[i,i]))
 options('seed',data.protocol.seeds.map(s=>[s,s]));options('mode',['source',...data.protocol.targetModes].map(s=>[s,s]))
 $('kernel-table').innerHTML=table(['Fila','K0','K1'],data.probes.kernel.map((row,i)=>[i,...row]))
 function geometry(){
  const config=data.probes.cases[Number($('geometry').value)],row=clamp('out-row',config.output.length-1),col=clamp('out-col',config.output[0].length-1),t=terms(data.probes,config,row,col)
  $('patch').innerHTML=heatmap(data.probes.input,{lo:0,hi:25,highlight:t.filter(p=>!p.padded)})
  $('sum').textContent=`Salida ${config.output.length} × ${config.output[0].length}. Celda (${row}, ${col}) = ${format(config.output[row][col])}. Error frente a PyTorch: ${config.maxError}.`
  $('terms').innerHTML=table(['Fila','Col.','Padding','Entrada','Peso','Producto'],t.map(p=>[p.row,p.col,p.padded?'Sí':'No',p.value,p.weight,p.product]))
 }
 function pooling(){const key=$('pool').value,p=data.probes.pool;$('pool-values').innerHTML=table(['Fila','Col. 0','Col. 1'],p[key].map((r,i)=>[i,...r]));$('pool-gradient').innerHTML=table(['Fila','C0','C1','C2','C3'],p[key+'Gradient'].map((r,i)=>[i,...r]))}
 function feature(reset=false){
  const sample=Number($('sample').value),stage=$('stage').value,maps=data.features[sample].maps[stage]
  if(reset){options('channel',maps.map((_,i)=>[i,i]));$('pixel-row').value=0;$('pixel-col').value=0}
  const channel=Number($('channel').value),m=selectFeature(data,sample,stage,channel),[lo,hi]=scaleBounds(data,sample,stage,channel,$('scale').value==='local')
  const row=clamp('pixel-row',m.length-1),col=clamp('pixel-col',m[0].length-1),f=data.features[sample]
  $('input-map').innerHTML=heatmap(f.input);$('feature-map').innerHTML=heatmap(m,{lo,hi,highlight:[{row,col}]})
  $('feature-summary').textContent=`${stage}, canal ${channel}, ${m.length} × ${m[0].length}. Etiqueta: ${data.protocol.classes[f.label]}; predicción: ${data.protocol.classes[f.prediction]}.`
  $('scale-summary').textContent=`Escala ${$('scale').value==='local'?'local':'compartida'}: ${format(lo)} a ${format(hi)}.`
  $('pixel-value').textContent=`Fila ${row}, columna ${col}: ${format(pixel(m,row,col))}.`
  gradient()
 }
 function gradient(){
  const f=data.features[Number($('sample').value)],g=f.gradients[Number($('grad-channel').value)],max=Math.max(...g.flat().map(Math.abs),1e-12)
  $('rf-input').innerHTML=heatmap(f.input,{region:{row:9,col:9,width:8,height:8}});$('gradient-map').innerHTML=heatmap(g,{lo:-max,hi:max})
  $('gradient-summary').textContent=`Gradiente en coordenada (6, 6), canal ${$('grad-channel').value}: ${g.flat().filter(x=>x!==0).length} píxeles no nulos; escala local simétrica ±${format(max)}.`
 }
 function training(){
  const seed=Number($('seed').value),mode=$('mode').value,run=selectRun(data,seed,mode),point=checkpoint(run,$('epoch').value)
  $('run-summary').textContent=`${run.id}; tarea ${run.domain}; epoch ${point.epoch}; ${run.updates} updates totales; ${run.trainableParameters} parámetros entrenables.`
  $('curve').innerHTML=curve(['trainLoss','validationLoss'].map(name=>({name,points:run.history.map(h=>({x:h.epoch,y:h[name]}))})),`${run.id}: train / validation`)
  $('checkpoint').innerHTML=table(['Epoch','Train loss','Val. loss','Train acc.','Val. acc.'],[[point.epoch,point.trainLoss,point.validationLoss,point.trainAccuracy,point.validationAccuracy]])
  $('comparison').innerHTML=table(['Target','Val. loss','Val. acc.','Δ backbone'],data.protocol.targetModes.map(mode=>{const r=selectRun(data,seed,mode),p=r.history.at(-1);return[mode,p.validationLoss,p.validationAccuracy,r.backboneMaxChange]}))
 }
 for(const id of ['geometry','out-row','out-col'])$(id).addEventListener('input',geometry)
 $('pool').addEventListener('change',pooling)
 for(const id of ['sample','stage'])$(id).addEventListener('change',()=>feature(true))
 for(const id of ['channel','scale','pixel-row','pixel-col'])$(id).addEventListener('input',()=>feature())
 $('grad-channel').addEventListener('change',gradient)
 for(const id of ['seed','mode','epoch'])$(id).addEventListener('input',training)
 geometry();pooling();feature(true);training();$('app').hidden=false;$('status').textContent='Observaciones cargadas. Índices desde cero; valores numéricos disponibles en tablas y selectores.'
}catch(error){$('status').className='error';$('status').textContent='No se pudieron cargar las observaciones: '+error.message}
