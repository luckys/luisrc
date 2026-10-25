export const groups={optimizers:['sgd','momentum','adam','adamw'],batch:['sgd-7','sgd-batch16','sgd-full'],rate:['sgd-slow','sgd-7','sgd-large'],schedule:['momentum-7','momentum-cosine']}
export function selectRuns(data,group='optimizers',seed=7){
 if(!(group in groups)||![7,19,31].includes(+seed))throw Error('Selección desconocida')
 const ids=group==='optimizers'?groups[group].map(id=>`${id}-${seed}`):groups[group]
 return ids.map(id=>{const run=data.runs.find(r=>r.id===id);if(!run)throw Error('Informe incompleto');return run})
}
export function summarize(run,epoch){
 const row=run.history.find(h=>h.epoch===+epoch)
 if(!row)throw Error('Checkpoint desconocido')
 return {id:run.id,...row}
}
export function seriesPoints(run,axis='updates',metric='validationLoss'){
 if(!['epoch','updates','examplesSeen'].includes(axis)||!['trainLoss','validationLoss','lrLast'].includes(metric))throw Error('Eje desconocido')
 return run.history.filter(h=>h[metric]!==null).map(h=>({x:h[axis],y:h[metric]}))
}
