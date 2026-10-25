import{scalarTrace,scalarStep,comparisonVector,formatNumber as f,methodNames}from'./model.mjs'
import{errorChart,gradientChart}from'./charts.mjs'
const $=id=>document.getElementById(id)
const stages=['Entradas w y x','Forward: q = w × x','Forward: r = q + q','Forward: L = r²','Backward: dr = 2r, con semilla 1','Backward: dq = dr + dr, sumar ambos usos','Backward: dw = dq × x; dx = dq × w']
const names={w:'w',x:'x',q:'q = w × x',r:'r = q + q',loss:'L = r²',dr:'dL/dr',dqLeft:'Contribución de q por uso izquierdo',dqRight:'Contribución de q por uso derecho',dq:'dL/dq, suma de caminos',dw:'dL/dw',dx:'dL/dx'}
function table(id,rows){$(id).replaceChildren(...rows.map(([label,value])=>{const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=label;td.textContent=String(value);tr.append(th,td);return tr}))}
try{
 const response=await fetch('./comparison.json');if(!response.ok)throw Error('No se pudo cargar el informe')
 const data=await response.json();if(data.kind!=='manual_finite_difference_and_pytorch_autograd_observations')throw Error('Formato inesperado')
 for(const c of data.cases){const o=document.createElement('option');o.value=c.id;o.textContent=c.id;$('case').append(o)}
 for(const[i,eps]of data.protocol.epsilons.entries()){const o=document.createElement('option');o.value=i;o.textContent=String(eps);$('epsilon').append(o)}$('epsilon').value='2'
 for(const[i,name]of data.cases[0].names.entries()){const o=document.createElement('option');o.value=i;o.textContent=name;$('parameter').append(o)}
 $('source').textContent=`Captura ${data.generatedAt}. PyTorch ${data.runtime.torch}, NumPy ${data.runtime.numpy}, CPU/float64.`
 document.querySelectorAll('select,input,button').forEach(e=>e.disabled=false)
 function render(){
  const w=+$('w').value,x=+$('x').value,index=+$('stage').value,t=scalarTrace(w,x)
  $('w-value').textContent=w;$('x-value').textContent=x;$('stage-value').textContent=index;$('stage-summary').textContent=stages[index]
  $('previous').disabled=index===0;$('next').disabled=index===6
  table('scalar',Object.entries(scalarStep(t,index)).map(([k,v])=>[names[k],f(v)]))
  const caseIndex=data.cases.findIndex(c=>c.id===$('case').value),c=data.cases[caseIndex],epsilonIndex=+$('epsilon').value,finite=c.finite[epsilonIndex],parameter=+$('parameter').value,method=$('method').value,comparison=comparisonVector(c,method,epsilonIndex)
  $('agreement').textContent=finite.passes?'Diferencias finitas aceptadas con la tolerancia por parámetro declarada. No garantiza otros puntos o funciones.':'Diferencias finitas fuera de la tolerancia: este epsilon no valida el backward en el caso seleccionado.'
  $('error-chart').innerHTML=errorChart(data,caseIndex,epsilonIndex)
  table('summary',[['Loss',f(c.trace.loss)],['Error máximo manual/PyTorch',f(c.maxTorchError)],['Error máximo FD/manual',f(finite.maxAbsError)],['Epsilon',finite.epsilon],['atol',data.protocol.check.atol],['rtol',data.protocol.check.rtol]])
  $('variant-state').textContent=Object.hasOwn(c.mutants,method)?`Control incorrecto: ${c.mutants[method].passes?'aceptado':'rechazado'} frente a FD con ε=1e-5.`:method==='detach'?`${c.checks.detached.filter(v=>v===null).length} parámetros sin trayectoria en el forward con detach.`:`Referencia mostrada: ${methodNames[method]}.`
  $('gradient-chart').innerHTML=gradientChart(data,caseIndex,method,epsilonIndex,parameter)
  table('parameter-values',[['Nombre',c.names[parameter]],['Manual NumPy',f(c.manual[parameter])],['PyTorch autograd',f(c.torch[parameter])],['FD con epsilon seleccionado',f(finite.vector[parameter])],[methodNames[method],f(comparison[parameter])],['Error FD/manual del parámetro',f(Math.abs(finite.vector[parameter]-c.manual[parameter]))]])
  table('checks',[['Gradcheck de PyTorch',c.checks.gradcheck],['VJP coincide: error máximo',f(c.vjpMaxError)],['Pesos sin cambios tras backward',c.checks.weightsUnchanged],['Segundo backward sin valores guardados rechazado',c.checks.reuseRejected],['Backward de loss no_grad rechazado',c.checks.noGradRejected],['Hidden sin retain_grad después de backward',c.checks.nonLeafGradWithoutRetain===null?'None':'Retenido'],['Hojas con gradiente en ese mismo paso',c.checks.leafGradsPresentWithoutRetain],['Shape de hidden.grad con retain_grad',c.checks.hiddenGradShape.join(' × ')]])
  $('facts').textContent=JSON.stringify({id:c.id,parameters:c.parameters,trace:c.trace,manual:c.manual,torch:c.torch,finite,comparison:{method,values:comparison},checks:c.checks},null,2)
 }
 for(const e of document.querySelectorAll('select,input'))e.addEventListener('input',render)
 $('previous').onclick=()=>{$('stage').value=Math.max(0,+$('stage').value-1);render()};$('next').onclick=()=>{$('stage').value=Math.min(6,+$('stage').value+1);render()};render()
}catch(error){$('error').hidden=false;$('error').textContent='No se ha podido cargar: '+error.message;document.querySelectorAll('select,input,button').forEach(e=>e.disabled=true)}
