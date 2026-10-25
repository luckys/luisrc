import{selectRun,checkpoint,batchGroups,residual,resumeSummary}from'./model.mjs'
import{curveChart}from'./charts.mjs'
const $=id=>document.getElementById(id),fmt=v=>v===null?'Aún no calculado':Number(v).toLocaleString('es-ES',{maximumSignificantDigits:8})
function rows(id,values){$(id).replaceChildren(...values.map(cells=>{const tr=document.createElement('tr');for(const[i,value]of cells.entries()){const c=document.createElement(i?'td':'th');if(!i)c.scope='row';c.textContent=String(value);tr.append(c)}return tr}))}
try{
 const response=await fetch('./comparison.json');if(!response.ok)throw Error('Informe no disponible')
 const data=await response.json();if(data.kind!=='pytorch_end_to_end_training_observations'||data.runs?.length!==3)throw Error('Informe incompleto')
 function render(){
  const seed=+$('seed').value,epoch=+$('epoch').value,axis=$('axis').value,variant=$('variant').value,run=selectRun(data,seed),h=checkpoint(run,epoch)
  $('epoch-value').value=epoch;$('previous').disabled=epoch===0;$('next').disabled=epoch===60
  $('training-chart').innerHTML=curveChart(data,{seed,epoch,axis})
  rows('metrics',[['Updates',fmt(h.updates)],['Muestras procesadas',fmt(h.examplesSeen)],['Train loss a pesos fijos',fmt(h.trainLoss)],['Validation loss',fmt(h.validationLoss)],['Loss online del recorrido',fmt(h.onlineLoss)],['Validation accuracy',fmt(h.validationAccuracy)],['Tasa usada',fmt(h.lrUsed)],['Tasa preparada para la siguiente epoch',fmt(h.lrNext)]])
  const trace=run.trace,unchanged=trace.before.every((v,i)=>v===trace.afterBackward[i]),delta=Math.max(...trace.afterStep.map((v,i)=>Math.abs(v-trace.before[i])))
  $('trace').textContent=`Primer batch de esta seed: ${trace.batchSize} muestras. Backward conserva los parámetros: ${unchanged?'sí':'no'}. Máximo desplazamiento tras step: ${fmt(delta)}.`
  const groups=batchGroups(h,data.protocol.batchSize)
  rows('order',groups.map(g=>[g.number,g.size,g.ids.join(', ')]))
  $('coverage').textContent=epoch?`${h.order.length} índices, ${new Set(h.order).size} distintos. ${groups.length} batches; último grupo de ${groups.at(-1).size}.`:'Todavía no se ha recorrido el loader.'
  const shape=residual(data,$('shape').value)
  $('shape-status').textContent=`Shape del residuo: (${shape.shape.join(',')}). Media de cuadrados: ${fmt(shape.mse)}. Son operaciones distintas sobre los mismos valores.`
  const header=document.createElement('tr')
  for(const label of ['Logit / target',...shape.matrix[0].map((_,i)=>'Columna '+i)]){const c=document.createElement('th');c.scope='col';c.textContent=label;header.append(c)}
  $('residual-head').replaceChildren(header)
  rows('residual',shape.matrix.map((r,i)=>['Fila '+i,...r.map(fmt)]))
  const summary=resumeSummary(data,variant,epoch)
  $('resume-chart').innerHTML=curveChart(data,{kind:'resume',variant,axis,epoch})
  rows('resume-values',[['Updates',fmt(summary.original.updates),fmt(summary.resumed.updates)],['Validation loss',fmt(summary.original.validationLoss),fmt(summary.resumed.validationLoss)],['Tasa usada',fmt(summary.original.lrUsed),fmt(summary.resumed.lrUsed)],['Próxima tasa',fmt(summary.original.lrNext),fmt(summary.resumed.lrNext)]])
  $('resume-error').textContent=`Máximo error absoluto de parámetros en esta epoch: ${summary.error===0?'0':summary.error.toExponential(6)}. Mide fidelidad al continuo, no calidad predictiva.`
 }
 for(const id of ['seed','epoch','axis','shape','variant']){$(id).disabled=false;$(id).addEventListener('input',render)}
 for(const[id,delta]of[['previous',-1],['next',1]])$(id).addEventListener('click',()=>{$('epoch').value=+$('epoch').value+delta;render()})
 $('status').textContent=`Captura ${data.generatedAt}, CPU ${data.runtime.torch}. Sin servicio de entrenamiento en el navegador.`
 $('inference').textContent=`Archivo de inferencia guardado y cargado: error máximo de logits ${data.inference.maxLogitError}. El módulo cargado está en eval; contiene ${data.inference.parameterCount} parámetros escalares.`
 $('provenance').textContent=JSON.stringify({runtime:data.runtime,protocol:data.protocol,sources:data.sources,dataHashes:data.dataHashes},null,2)
 render()
}catch(error){$('status').textContent='No se pudieron cargar las observaciones. Recarga la página para reintentarlo.';for(const c of document.querySelectorAll('select,input,button'))c.disabled=true;console.error(error)}
