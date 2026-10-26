import{memoryRun,continuationRun,traceAt,checkpointAt,gateRow,comparisonRows,format,logGradient}from'./model.mjs'
import{lineChart}from'./charts.mjs'
const $=id=>document.getElementById(id)
const table=(headers,rows)=>`<div class="scroll" tabindex="0" role="region" aria-label="Tabla de observaciones"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${typeof v==='number'||v===null?format(v):v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
const options=(id,items)=>{$(id).innerHTML=items.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}
try{
 const response=await fetch('./comparison.json');if(!response.ok)throw Error('HTTP '+response.status)
 const data=await response.json()
 for(const id of ['seed','generation-seed'])options(id,data.protocol.seeds.map(s=>[s,s]))
 for(const id of ['kind','cell-kind'])options(id,data.protocol.memory.kinds.map(s=>[s,s]))
 options('token',Array.from({length:10},(_,i)=>[i,i]));options('unit',Array.from({length:16},(_,i)=>[i,i]));options('example',Array.from({length:8},(_,i)=>[i,i]))
 function memory(){
  const r=memoryRun(data,$('seed').value,$('kind').value),p=checkpointAt(r,$('checkpoint').value)
  $('memory-summary').textContent=`${r.id}: epoch ${p.epoch}; ${r.parameters} parámetros; ${r.updates} updates totales. Modelo unidireccional, estado reiniciado por secuencia.`
  $('memory-chart').innerHTML=lineChart(['trainAccuracy','validationAccuracy'].map(name=>({name,points:r.history.map(h=>({x:h.epoch,y:h[name]}))})),r.id+' · accuracy')
  $('memory-point').innerHTML=table(['Epoch','Train loss','Val. loss','Train acc.','Val. acc.'],[[p.epoch,p.trainLoss,p.validationLoss,p.trainAccuracy,p.validationAccuracy]])
  $('length-table').innerHTML=table(['Longitud','Distractores','Loss','Accuracy'],r.lengthProbes.map(p=>[p.length,p.length-2,p.loss,p.accuracy]))
  $('embedding-values').innerHTML=table(['Dimensión','Valor'],r.embedding[Number($('token').value)].map((v,i)=>[i,v]))
  trace()
 }
 function cell(){
  const kind=$('cell-kind').value,p=data.probes.cells[kind],time=Number($('cell-time').value),unit=Number($('cell-unit').value)
  const t={cells:p.steps,hidden:p.steps.map(s=>s.hidden)},row=gateRow(t,time,unit)
  $('cell-summary').textContent=`${kind}, paso ${time}, unidad ${unit}; error máximo vs celda PyTorch: ${format(p.maxError)}.`
  $('cell-values').innerHTML=table(['Campo','Valor'],Object.entries(row))
 }
 function trace(){
  const r=memoryRun(data,$('seed').value,$('kind').value),t=traceAt(r,$('length').value)
  $('time').max=t.length-1;if(Number($('time').value)>=t.length)$('time').value=t.length-1
  const time=Number($('time').value),unit=Number($('unit').value),row=gateRow(t,time,unit)
  $('trace-summary').textContent=`Modelo final ${r.id}; longitud ${t.length}; paso ${time} desde cero; token ${t.tokens[time]}; unidad ${unit}; etiqueta ${t.label}.`
  $('trace-values').innerHTML=table(['Campo','Valor'],Object.entries(row))
  $('input-vector').innerHTML=table(['Dimensión embedding','Valor'],t.embedded[time].map((v,i)=>[i,v]))
  const ys=t.gradientNorm.map(logGradient),min=Math.min(-1,Math.floor(Math.min(...ys))),max=Math.max(0,Math.ceil(Math.max(...ys)))
  const ticks=[0,Math.floor((t.length-1)/2),t.length-1]
  $('gradient-chart').innerHTML=lineChart([{name:'Norma del gradiente',points:ys.map((y,i)=>({x:i,y}))}],r.id+' · gradiente por paso',{xMax:t.length-1,yMin:min,yMax:max,xLabel:'Índice del paso',yLabel:'log10(max(norma, 10⁻³⁰))',ticks})
  $('gradient-point').innerHTML=table(['Paso','Token','Norma sin log'],[[time,t.tokens[time],t.gradientNorm[time]]])
 }
 function generation(){
  const r=continuationRun(data,$('generation-seed').value),p=checkpointAt(r,$('generation-checkpoint').value),e=r.examples[Number($('example').value)]
  $('generation-summary').textContent=`GRU ${r.seed}: epoch ${p.epoch}; ${r.parameters} parámetros; ${r.updates} updates totales.`
  const fields=['teacherContinuationAccuracy','rolloutContinuationAccuracy','rolloutExactMatch'],names=['Teacher tokens','Rollout tokens','Rollout exacto']
  $('generation-chart').innerHTML=lineChart(fields.map((f,i)=>({name:names[i],points:r.history.map(h=>({x:h.epoch,y:h[f]}))})),'Continuación · seed '+r.seed,{xMax:60,ticks:[0,15,30,45,60]})
  $('generation-point').innerHTML=table(['Epoch','Val. loss','Teacher acc.','Rollout acc.','Exacto'],[[p.epoch,p.validationLoss,p.teacherContinuationAccuracy,p.rolloutContinuationAccuracy,p.rolloutExactMatch]])
  $('prefix').textContent=`Prefijo proporcionado: ${e.prefix.join(', ')}. Perturbación forzada en paso 0: token ${e.injectedToken}. EOS=9. Ejemplo del modelo final.`
  $('generation-values').innerHTML=table(['Paso','Real','Teacher','Generado','Perturbado'],comparisonRows(e).map(p=>[p.step,p.expected,p.teacher,p.generated,p.perturbed]))
 }
 $('padding-values').innerHTML=table(['Pasos de padding','Estado'],data.probes.paddingStates.map((v,i)=>[i,v]))
 $('gradient-controls').innerHTML=table(['Longitud','RNN a=.5','RNN a=1.2','Camino f=.99'],data.probes.gradientControls.map(p=>[p.length,p.rnnHalf,p.rnnLarge,p.fixedForget]))
 const summary=data.continuationDatasetSummary
 $('overlap').textContent=`Patrones únicos: train ${summary.trainUnique}, validation ${summary.validationUnique}, compartidos ${summary.overlap}.`
 for(const id of ['seed','kind','checkpoint','token'])$(id).addEventListener('input',memory)
 for(const id of ['cell-kind','cell-time','cell-unit'])$(id).addEventListener('input',cell)
 for(const id of ['length','time','unit'])$(id).addEventListener('input',trace)
 for(const id of ['generation-seed','generation-checkpoint','example'])$(id).addEventListener('input',generation)
 memory();cell();generation();$('app').hidden=false;$('status').textContent='Observaciones cargadas. Valores consultables en tablas; índices desde cero.'
}catch(error){$('status').className='error';$('status').textContent='No se pudieron cargar las observaciones: '+error.message}
