import{attentionAt,rowAt,contributionsAt,modelAt,positionAt,format,stages}from'./model.mjs'
import{matrixChart,lineChart}from'./charts.mjs'
const $=id=>document.getElementById(id)
const table=(headers,rows)=>`<div class="scroll" tabindex="0" role="region" aria-label="Tabla de observaciones"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${typeof v==='number'||v===null?format(v):v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
const options=(id,items)=>{$(id).innerHTML=items.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}
const clamp=(id,max)=>{$(id).max=max;$(id).value=Math.max(0,Math.min(max,Math.trunc(Number($(id).value)||0)));return Number($(id).value)}
try{
 const response=await fetch('./comparison.json');if(!response.ok)throw Error('HTTP '+response.status)
 const data=await response.json()
 options('seed',data.protocol.seeds.map(s=>[s,s]));options('stage',stages.map(s=>[s,s]));options('depth',data.probes.scale.map((p,i)=>[i,p.depth]));options('position',data.probes.positions.map((_,i)=>[i,i]));options('gradient-step',Array.from({length:5},(_,i)=>[i,i]))
 function attention(){
  const c=attentionAt(data,$('seed').value,$('stage').value),b=Number($('batch').value),h=Number($('head').value)
  const weights=c.trace.weights[b][h],q=clamp('query',weights.length-1),k=clamp('key',weights[0].length-1),dim=Number($('component').value)
  $('weights-chart').innerHTML=matrixChart(weights,{allowed:c.trace.allowed[b][h],row:q,col:k,title:c.id+' · head '+h})
  $('attention-summary').textContent=`${c.id}; matriz ${weights.length} × ${weights[0].length}; muestra ${b}; query ${q}: ${q<c.queryLengths[b]?'válida':'padding, no se interpreta como paso válido'}. Error SDPA ${format(c.sdpaError)}; MHA ${format(c.mhaError)}.`
  const rows=rowAt(c,b,h,q)
  $('row-values').innerHTML=table(['Key','Score raw','Escalado','Permitida','Peso'],rows.map(r=>[r.key,r.raw,r.scaled,r.allowed?'Sí':'No',r.weight]))
  $('vectors').innerHTML=table(['Dim.','Q(query)','K(key)','V(key)'],c.trace.query[b][h][q].map((v,i)=>[i,v,c.trace.key[b][h][k][i],c.trace.value[b][h][k][i]]))
  const products=contributionsAt(c,b,h,q,dim)
  $('products').innerHTML=table(['Key','Peso','V componente','Producto'],products.map(p=>[p.key,p.weight,p.value,p.product]))
  $('weighted-sum').textContent=`Suma para componente ${dim}: ${format(c.trace.attended[b][h][q][dim])}. Este es el contexto de una head, antes de concat y de la proyección final.`
 }
 function scale(){
  const p=data.probes.scale[Number($('depth').value)]
  $('scale-values').innerHTML=table(['Modo','Std. scores','Entropía','Máx. peso medio'],[['Sin escala',p.raw.scoreStd,p.raw.meanEntropy,p.raw.meanMaximumWeight],['Con escala',p.scaled.scoreStd,p.scaled.meanEntropy,p.scaled.meanMaximumWeight]])
 }
 function position(){const row=positionAt(data,$('position').value);$('position-values').innerHTML=table(['Dimensión','Posición'],row.map((v,i)=>[i,v]))}
 function causal(){
  const m=modelAt(data,$('seed').value),g=m.inputGradient[0],max=Math.max(...g.flat().map(Math.abs),1e-12),time=Number($('gradient-step').value)
  $('causal-summary').textContent=`Seed ${m.seed}; decoder-only ${m.lmParameters} parámetros; encoder-decoder ${m.seqParameters}. Modelos sin entrenamiento.`
  $('causal-values').innerHTML=table(['Control','Máximo cambio'],[['Prefijo decoder-only con máscara',m.prefixError],['Prefijo sin máscara (control)',m.unmaskedPrefixChange],['Prefijo encoder-decoder / futuro target',m.seqTargetPrefixError],['Padding del source',m.seqPaddingPrefixError],['Cambio válido en source',m.seqSourceChange]])
  $('gradient-chart').innerHTML=matrixChart(g,{symmetric:max,title:'Gradiente del prefijo · seed '+m.seed})
  $('gradient-values').innerHTML=table(['Paso','Dimensión','Derivada'],g[time].map((v,i)=>[time,i,v]))
 }
 $('scale-chart').innerHTML=lineChart(['raw','scaled'].map((key,i)=>({name:i?'Con escala':'Sin escala',points:data.probes.scale.map((p,j)=>({x:j,y:p[key].meanEntropy}))})),'Entropía media · ocho keys',{xMax:3,yMax:Math.log(8),ticks:[0,1,2,3],tickLabels:data.probes.scale.map(p=>p.depth),xLabel:'Dimensión (categorías)',yLabel:'Entropía (nats)'})
 $('position-chart').innerHTML=lineChart([0,1,6,7].map(dim=>({name:'Dimensión '+dim,points:data.probes.positions.map((row,i)=>({x:i,y:row[dim]}))})),'Señales de posición sinusoidales',{xMax:15,yMin:-1,yMax:1,ticks:[0,5,10,15],xLabel:'Posición absoluta',yLabel:'Valor'})
 const soft=data.probes.softmax
 $('softmax-values').innerHTML=table(['Logit','Softmax estable'],soft.logits[0].map((v,i)=>[v,soft.stable[0][i]]))
 const full=data.probes.fullyMaskedSDPA
 $('mask-policy').textContent=`Exp ingenua no finita: ${soft.naiveNonfinite?'Sí':'No'}. SDPA con todas las keys excluidas en este runtime: ${full.finite&&full.zero?'salida finita cero':'otro resultado'}. Nuestra política: rechazar esa fila.`
 const p=data.probes.permutation
 $('permutation-values').innerHTML=table(['Prueba','Máximo error/cambio'],[['Sin posiciones: equivarianza',p.noPositionError],['Posiciones fijas: cambio',p.fixedPositionChange],['Permutar pares completos',p.jointPermutationError]])
 $('cost-values').innerHTML=table(['Longitud','Scores','Bytes tensor'],data.probes.costs.map(p=>[p.length,p.scoreElements,p.scoreBytes]))
 for(const id of ['stage','batch','head','query','key','component'])$(id).addEventListener('input',attention)
 $('seed').addEventListener('input',()=>{attention();causal()});$('depth').addEventListener('input',scale);$('position').addEventListener('input',position);$('gradient-step').addEventListener('input',causal)
 attention();scale();position();causal();$('app').hidden=false;$('status').textContent='Observaciones cargadas. Índices desde cero; capas y máscaras identificadas en cada tabla.'
}catch(error){$('status').className='error';$('status').textContent='No se pudieron cargar las observaciones: '+error.message}
