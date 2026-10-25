import{selectRun,checkpoint,snapshot,normalization,format as f}from'./model.mjs'
import{curvesChart,fitChart,biasChart,initializationChart,clippingChart}from'./charts.mjs'
const $=id=>document.getElementById(id)
const normFormat=v=>Number(v).toLocaleString('es-ES',{maximumSignificantDigits:5})
function rows(id,values){$(id).replaceChildren(...values.map(values=>{const tr=document.createElement('tr');for(const[i,v]of values.entries()){const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=String(v);tr.append(cell)}return tr}))}
try{
 const response=await fetch('./comparison.json');if(!response.ok)throw Error('Informe no disponible')
 const data=await response.json();if(data.kind!=='generalization_and_stability_observations'||data.runs?.length!==18)throw Error('Informe incompleto')
 function render(){
  const run=selectRun(data,+$('seed').value,$('variant').value),index=+$('checkpoint').value,h=checkpoint(run,index)
  $('epoch-value').value=h.epoch;$('previous').disabled=index===0;$('next').disabled=index===run.history.length-1
  $('curves').innerHTML=curvesChart(run,index);$('fit').innerHTML=fitChart(data,run,$('phase').value)
  rows('metrics',[['Epoch / updates',f(h.epoch)],['Train MSE',f(h.trainMse)],['Validation MSE',f(h.validationMse)],['Loss online del último update',f(h.onlineMseLast)],['Norma del gradiente de ese update',f(h.gradientNormLast)],['Norma total de parámetros',f(h.parameterNorm)],['Parámetros escalares',run.parameterCount]])
  rows('snapshots',[['Último',f(run.last.epoch),f(run.last.trainMse),f(run.last.validationMse)],['Mejor observado',f(run.best.epoch),f(run.best.trainMse),f(run.best.validationMse)],['Elegido',f(run.selected.epoch),f(run.selected.trainMse),f(run.selected.validationMse)]])
  const baseline=selectRun(data,run.seed,'baseline'),diff=run.selected.validationMse-baseline.last.validationMse
  $('outcome').textContent=`Último update: ${run.last.epoch}. Modelo elegido: epoch ${run.selected.epoch}. Validation del elegido ${diff<0?'menor':diff>0?'mayor':'igual'} que el final de la baseline de esta seed. No expresa un ranking universal.`
  const bv=data.biasVariance.models.find(r=>r.degree===+$('degree').value)
  $('bias-chart').innerHTML=biasChart(data,bv.degree)
  rows('bias-values',[['Bias² del conjunto finito',f(bv.biasSquared)],['Variance del conjunto finito',f(bv.variance)],['Error contra la señal',f(bv.cleanRisk)],['Ruido esperado del generador',f(bv.knownNoiseVariance)]])
  const scheme=data.initialization.find(r=>r.id===$('scheme').value),layer=+$('layer').value,l=scheme.layers[layer]
  $('layer-value').value=layer+1;$('initialization-chart').innerHTML=initializationChart(data,$('init-metric').value,scheme.id,layer)
  rows('initialization-values',[['Capa',layer+1],['Varianza',f(l.variance)],['Segundo momento',f(l.secondMoment)],['Norma de gradientes de weights',f(l.gradientNorm)],['Fracción de ceros',f(l.zeroFraction)],['Fracción de tanh saturada',f(l.saturationFraction)],['Norma de gradiente respecto a inputs',f(scheme.inputGradientNorm)]])
  const activation=data.activations.functions.find(r=>r.id===$('activation').value)
  rows('activation-values',activation.input.map((x,i)=>[f(x),f(activation.output[i]),f(activation.gradient[i])]))
  $('activation-summary').textContent=`Control con preactivation −1 y target 1: gradiente del bias ReLU ${f(data.activations.deadReluBiasGradient)}, LeakyReLU ${f(data.activations.leakyBiasGradient)}. No mide la pérdida de los 18 entrenamientos.`
  const norm=normalization(data,$('normalization').value,$('context').value)
  rows('norm-input',norm.input.map((r,i)=>[i,...r.map(normFormat)]));rows('norm-output',norm.output.map((r,i)=>[i,...r.map(normFormat)]))
  for(const id of ['norm-input','norm-output'])$(id).firstElementChild.classList.add('highlight')
  $('norm-summary').textContent=`BatchNorm: train con una fila rechazado ${data.normalization.singletonRejected?'sí':'no'}; eval sin running stats usa el batch ${data.normalization.untrackedEvalUsesBatch?'sí':'no'}. LayerNorm calcula estadísticas por muestra en este probe.`
  $('dropout-summary').textContent=`${data.dropout.elements} elementos: media ${f(data.dropout.mean)}, fracción de ceros ${f(data.dropout.zeroFraction)}, valores posibles ${data.dropout.possibleValues.map(f).join(' / ')}. Eval conserva la entrada: ${data.dropout.evalIdentity?'sí':'no'}.`
  const clip=data.clipping.curves.find(r=>r.id===$('clip-kind').value),step=+$('clip-step').value,c=clip.history[step]
  $('step-value').value=c.step;$('clipping-chart').innerHTML=clippingChart(data,clip.id,step)
  rows('clip-values',[['Step',c.step],['Theta antes del update',f(c.theta)],['MSE antes del update',f(c.loss)],['Norma de gradiente previa',f(c.gradientBefore)],['Norma posterior al recorte',f(c.gradientAfter)],['Norma del desplazamiento',f(c.stepNorm)]])
  $('clip-summary').textContent=`Fin del control: ${clip.reason==='budget'?'presupuesto de 40 updates':'guard de loss excedida'}. Adam, con gradiente recortado a 1e-4: desplazamiento ${f(data.clipping.adam.stepNorm)}, frente a ητ ${f(data.clipping.adam.lrTimesClip)}. La cota de SGD simple no se aplica automáticamente.`
 }
 function resetRun(){const r=selectRun(data,+$('seed').value,$('variant').value);$('checkpoint').max=r.history.length-1;$('checkpoint').value=r.history.length-1;render()}
 for(const id of ['seed','variant']){$(id).disabled=false;$(id).addEventListener('input',resetRun)}
 for(const id of ['checkpoint','phase','degree','scheme','init-metric','layer','activation','normalization','context','clip-step']){$(id).disabled=false;$(id).addEventListener('input',render)}
 $('clip-kind').disabled=false;$('clip-kind').addEventListener('input',()=>{const r=data.clipping.curves.find(r=>r.id===$('clip-kind').value);$('clip-step').max=r.history.length-1;$('clip-step').value=0;render()})
 for(const[id,delta]of[['previous',-1],['next',1]])$(id).addEventListener('click',()=>{$('checkpoint').value=+$('checkpoint').value+delta;render()})
 $('status').textContent=`Captura ${data.generatedAt}. ${data.runtime.torch}, CPU y float64.`
 $('provenance').textContent=JSON.stringify({runtime:data.runtime,protocol:data.protocol,sources:data.sources,dataHashes:data.dataHashes},null,2)
 resetRun()
}catch(error){$('status').textContent='No se pudieron cargar las observaciones. Recarga la página para reintentarlo.';for(const c of document.querySelectorAll('select,input,button'))c.disabled=true;console.error(error)}
