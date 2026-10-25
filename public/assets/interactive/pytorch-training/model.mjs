export function selectRun(data,seed=7){const run=data.runs.find(r=>r.seed===+seed);if(!run)throw Error('Seed desconocida');return run}
export function checkpoint(run,epoch){const row=run.history.find(r=>r.epoch===+epoch);if(!row)throw Error('Checkpoint desconocido');return row}
export function batchGroups(row,size=30){if(!Number.isInteger(size)||size<1)throw Error('Tamaño de batch inválido');return Array.from({length:Math.ceil(row.order.length/size)},(_,i)=>{const ids=row.order.slice(i*size,(i+1)*size);return{number:i+1,size:ids.length,ids}})}
export function residual(data,mode='bad'){
 if(!['bad','good'].includes(mode))throw Error('Operación desconocida')
 const p=data.probes.tensors;return{shape:p[mode+'Shape'],matrix:p[mode+'Residual'],mse:p[mode+'Mse']}
}
export const vector=row=>['hidden.weight','hidden.bias','output.weight','output.bias'].flatMap(key=>row.state[key].flat(Infinity))
export function resumeSummary(data,variant='full',epoch=60){
 const run=data.resumed.find(r=>r.variant===variant);if(!run)throw Error('Variante desconocida')
 const original=checkpoint(selectRun(data,7),epoch),resumed=checkpoint(run,epoch),a=vector(original),b=vector(resumed)
 return{original,resumed,error:Math.max(...a.map((v,i)=>Math.abs(v-b[i])))}
}
