const requireValue=(value,message)=>{if(!value)throw RangeError(message);return value}
export const memoryRun=(data,seed,kind)=>requireValue(data.runs.find(r=>r.task==='memory'&&r.seed===Number(seed)&&r.kind===kind),'memory run')
export const continuationRun=(data,seed)=>requireValue(data.runs.find(r=>r.task==='continuation'&&r.seed===Number(seed)),'continuation run')
export const traceAt=(run,length)=>requireValue(run.traces.find(t=>t.length===Number(length)),'trace length')
export const checkpointAt=(run,index)=>requireValue(run.history[Number(index)],'checkpoint index')
export function gateRow(trace,time,unit){
 const row=trace.cells[time]
 if(!row||!Number.isInteger(unit)||unit<0||unit>=row.hidden.length)throw RangeError('state coordinate')
 return Object.fromEntries(Object.entries(row).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,key==='hidden'?trace.hidden[time][unit]:value[unit]]))
}
export const comparisonRows=e=>e.expected.map((expected,i)=>({step:i,expected,teacher:e.teacher[i]??null,generated:e.generated[i]??null,perturbed:e.perturbed[i]??null}))
export const format=v=>{
 if(v===null)return 'Ausente'
 const n=Number(v),scientific=n!==0&&(Math.abs(n)<1e-4||Math.abs(n)>=1e6)
 return n.toLocaleString('es',{maximumSignificantDigits:6,notation:scientific?'scientific':'standard'})
}
export const logGradient=v=>Math.log10(Math.max(v,1e-30))
