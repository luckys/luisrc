import {infer,activation} from './inference.mjs'
import {lossChart,heatmap,activationChart} from './charts.mjs'
const $=id=>document.getElementById(id),f=v=>Number(v).toFixed(6)
function table(id,rows){$(id).replaceChildren(...rows.map(([name,value])=>{const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=name;td.textContent=String(value);tr.append(th,td);return tr}))}
try{
 const response=await fetch('./training.json');if(!response.ok)throw Error('No se pudo cargar el entrenamiento')
 const data=await response.json();if(data.kind!=='numpy_training_observations_on_synthetic_xor')throw Error('Formato inesperado')
 for(const c of data.results.cases){const o=document.createElement('option');o.value=c.id;o.textContent=c.id==='linear'?'Regresión logística':c.id==='zero'?'MLP: inicialización a cero':'MLP: seed '+c.seed;$('case').append(o)}
 $('case').value='mlp-7'
 for(const [i,p]of data.protocol.probePoints.entries()){const o=document.createElement('option');o.value=i;o.textContent='('+p.join(', ')+')';$('probe').append(o)}
 $('source').textContent=`Captura ${data.generatedAt}. Python ${data.runtime.python}; NumPy ${data.runtime.numpy}. Train 256 / validation 128 / test 256.`
 document.querySelectorAll('select,input,button').forEach(e=>e.disabled=false)
 function render(){
  const c=data.results.cases.find(c=>c.id===$('case').value),index=+$('epoch').value,h=c.history[index]
  $('epoch-value').textContent=h.epoch;$('previous').disabled=index===0;$('next').disabled=index===c.history.length-1
  const rows=[['Parámetros',c.parameterCount],['Loss train',f(h.trainLoss)],['Loss validation',f(h.validationLoss)],['Accuracy train',f(h.trainAccuracy)],['Accuracy validation',f(h.validationAccuracy)],['Test al final',index===c.history.length-1?f(c.test.accuracy):'No se evalúa en este checkpoint']]
  table('metrics',rows);$('loss-chart').innerHTML=lossChart(data.results.cases,c,index)
  if(!c.width)$('view').value='probability'
  $('view').disabled=!c.width;$('unit').disabled=!c.width||$('view').value!=='hidden'
  $('map').innerHTML=heatmap(data,c,h,$('view').value,+$('unit').value)
  const point=data.protocol.probePoints[+$('probe').value],p=infer(point,h.layers)
  table('prediction',[['x1',point[0]],['x2',point[1]],...p.hidden.map((v,i)=>['h'+(i+1),f(v)]),['Logit',f(p.logit)],['p(y=1)',f(p.probability)],['Clase a umbral 0,5',p.probability>=.5?1:0]])
  const kind=$('activation').value,value=+$('input').value
  $('input-value').textContent=value;$('activation-value').textContent=`${kind}(${value}) = ${f(activation(kind,value))}`
  $('activation-chart').innerHTML=activationChart(kind,value)
  $('facts').textContent=JSON.stringify({case:c.id,checkpoint:h,testFinal:index===c.history.length-1?c.test:null},null,2)
 }
 for(const e of document.querySelectorAll('select,input'))e.addEventListener('input',render)
 $('previous').onclick=()=>{$('epoch').value=Math.max(0,+$('epoch').value-1);render()}
 $('next').onclick=()=>{$('epoch').value=Math.min(20,+$('epoch').value+1);render()}
 render()
}catch(error){$('error').hidden=false;$('error').textContent='No se ha podido cargar: '+error.message;document.querySelectorAll('select,input,button').forEach(e=>e.disabled=true)}
