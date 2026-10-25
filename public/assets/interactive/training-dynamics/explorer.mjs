import {selectRuns,summarize} from './model.mjs'
import {curveChart} from './charts.mjs'
const $=id=>document.getElementById(id),fmt=v=>v===null?'Sin actualización':Number(v).toLocaleString('es-ES',{maximumSignificantDigits:7})
try{
 const response=await fetch('./comparison.json')
 if(!response.ok)throw Error('No se pudo cargar el informe')
 const data=await response.json()
 if(data.kind!=='optimizer_training_observations'||data.runs?.length!==17)throw Error('Informe incompleto')
 const controls=['group','seed','axis','metric','epoch']
 function render(){
  if($('group').value!=='optimizers')$('seed').value='7'
  const group=$('group').value,seed=+$('seed').value,epoch=+$('epoch').value
  const runs=selectRuns(data,group,seed)
  $('seed').disabled=group!=='optimizers'
  $('epoch-value').value=epoch
  $('previous').disabled=epoch===0;$('next').disabled=epoch===80
  $('chart').innerHTML=curveChart(data,{group,seed,epoch,axis:$('axis').value,metric:$('metric').value})
  $('rows').replaceChildren(...runs.map(run=>{
   const row=summarize(run,epoch),tr=document.createElement('tr')
   for(const [i,key]of ['id','updates','examplesSeen','trainLoss','validationLoss','validationAccuracy','lrLast'].entries()){
    const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row'
    cell.textContent=i?fmt(row[key]):row[key];tr.append(cell)
   }return tr
  }))
  $('context').textContent=group==='optimizers'?'Mismos pesos iniciales por seed, orden y 640 updates. SGD/momentum: lr 0,1; Adam/AdamW: lr 0,01; AdamW: decay 0,01 en todos los parámetros. No se ha igualado la intensidad de regularización.':`Ablation con seed 7. ${group==='batch'?'80 epochs dan 1280, 640 u 80 updates; no son presupuestos de optimización iguales.':'Se cambia solo la intervención declarada respecto al run de referencia.'}`
 }
 for(const id of controls){$(id).disabled=false;$(id).addEventListener('input',render)}
 for(const [id,delta]of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{$('epoch').value=+$('epoch').value+delta;render()})
 $('status').textContent=`Captura ${data.generatedAt}. Sin llamadas a un servicio de entrenamiento.`
 $('accumulation').textContent=`Error máximo del gradiente ponderado: ${data.accumulation.maxWeightedError.toExponential(3)}. Promedio incorrecto: ${data.accumulation.maxNaiveError.toFixed(6)}. En cinco epochs con los cuatro optimizadores: 40 updates en ambos recorridos; máximo error de parámetros ${Math.max(...data.accumulation.training.map(v=>v.maxParameterError)).toExponential(3)}.`
 $('provenance').textContent=JSON.stringify({runtime:data.runtime,protocol:data.protocol,sources:data.sources,dataHashes:data.dataHashes},null,2)
 render()
}catch(error){$('status').textContent='No se pudieron cargar las observaciones. Recarga la página para reintentarlo.';for(const el of document.querySelectorAll('select,input,button'))el.disabled=true;console.error(error)}
