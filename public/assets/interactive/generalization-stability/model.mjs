export const variants={baseline:'Baseline',dropout:'Dropout',weight_decay:'Weight decay',batch_norm:'BatchNorm',layer_norm:'LayerNorm',early_stopping:'Early stopping'}
export function selectRun(data,seed,variant){const r=data.runs.find(r=>r.seed===+seed&&r.variant===variant);if(!r)throw Error('Run desconocido');return r}
export function checkpoint(run,index){if(!Number.isInteger(+index)||+index<0||+index>=run.history.length)throw Error('Checkpoint desconocido');return run.history[+index]}
export function snapshot(run,phase){if(!['initial','last','best','selected'].includes(phase))throw Error('Snapshot desconocido');return run[phase]}
export function normalization(data,kind,context){if(!['batch','layer'].includes(kind)||!['A','B'].includes(context))throw Error('Matriz desconocida');return{input:data.normalization['inputs'+context],output:data.normalization[kind+context]}}
export const format=v=>v===null?'No aplica':Number(v).toLocaleString('es-ES',{maximumSignificantDigits:7})
