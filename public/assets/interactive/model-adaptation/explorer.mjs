import{lineChart}from'./charts.mjs';
import{labels,selectRun,loraBudget,predictionCounts}from'./model.mjs';
const data=await(await fetch('./comparison.json')).json(),byId=id=>document.getElementById(id);
for(const mode of data.protocol.modes)byId('mode').add(new Option(labels[mode],mode));
function update(){
 const run=selectRun(data,byId('mode').value,byId('seed').value),p=run.finalParameters;
 byId('summary').textContent=`${labels[run.mode]}, seed ${run.seed}: test accuracy ${(100*run.test.accuracy).toFixed(2)}%; ${p.trainable}/${p.total} parámetros entrenables al final. Baseline mayoría: ${(100*data.majority.accuracy).toFixed(2)}%.`;
 byId('curve').innerHTML=lineChart([{name:labels[run.mode],points:run.curve.map(v=>({step:v.step,value:v.validation.accuracy}))}],'Accuracy de validation');
 byId('steps').innerHTML=run.curve.map(v=>`<tr data-step="${v.step}"><td>${v.step}</td><td>${v.validation.loss.toFixed(5)}</td><td>${v.validation.accuracy.toFixed(5)}</td><td>${v.trainable}</td></tr>`).join('');
 byId('retention').textContent=run.sourceMSE===null?'Reconstrucción previa: no aplicable a este baseline.':`Reconstrucción source test: antes ${run.sourceBeforeMSE.toFixed(6)}, después ${run.sourceMSE.toFixed(6)} MSE. Decoder original y representación adaptada activa; no son capacidades generales.`;
 const index=Number(byId('sample').value);
 byId('prediction').textContent=`Ejemplo ${index}: etiqueta ${run.test.labels[index]}, predicción ${run.test.predictions[index]}.`;
 byId('confusion').innerHTML=predictionCounts(run).map((row,i)=>`<tr><th>${i}</th>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');
}
function budget(){
 const fields=['input','output','rank'];
 if(fields.some(id=>!byId(id).checkValidity())){byId('budget').textContent='Introduce dimensiones enteras entre 1 y 4096.';return;}
 const value=loraBudget(...fields.map(id=>Number(byId(id).value)));
 byId('budget').textContent=`Matriz base: ${value.base} pesos (sin bias). Factores A/B: ${value.factors}. Factores + head: ${value.trainable} entrenables. No incluye el resto del encoder ni mide VRAM.`;
}
function contrast(){const c=data.contrastive,selected=c.temperatures[Number(byId('temperature').value)];byId('contrast').textContent=`T=${selected.temperature}: loss ${selected.loss.toFixed(6)}. A T=0.2 con dos positivos intercambiados: ${c.swappedLoss.toFixed(6)}; con todos los embeddings iguales: ${c.collapsedLoss.toFixed(6)}.`;}
byId('logits').innerHTML=data.contrastive.logits.map((r,i)=>`<tr><th>Par ${i}</th>${r.map(v=>`<td>${v.toFixed(4)}</td>`).join('')}</tr>`).join('');
for(const id of ['mode','seed','sample'])byId(id).addEventListener('input',update);
for(const id of ['input','output','rank'])byId(id).addEventListener('input',budget);
byId('temperature').addEventListener('input',contrast);
update();budget();contrast();
