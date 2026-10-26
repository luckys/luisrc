export const stages=['self_full','self_causal','cross','lm','encoder','decoder_self','decoder_cross']
export function modelAt(data,seed){const m=data.models.find(m=>m.seed===Number(seed));if(!m)throw RangeError('unknown seed');return m}
export function attentionAt(data,seed,stage){
 if(!stages.includes(stage))throw RangeError('unknown stage')
 if(['self_full','self_causal','cross'].includes(stage)){
  const c=data.cases.find(c=>c.seed===Number(seed)&&c.name===stage)
  if(!c)throw RangeError('unknown case')
  return{...c,queryLengths:stage==='self_full'?data.protocol.sourceValidLengths:data.protocol.targetValidLengths}
 }
 const m=modelAt(data,seed),trace={lm:m.lm.attention,encoder:m.sequence.encoder.attention,decoder_self:m.sequence.self,decoder_cross:m.sequence.cross}[stage]
 return{id:stage+'-'+seed,trace,queryLengths:stage==='encoder'?data.protocol.sourceValidLengths:data.protocol.targetValidLengths,sdpaError:null,mhaError:null}
}
export function rowAt(c,b,h,q){
 const weights=c.trace.weights[b]?.[h]?.[q]
 if(!weights)throw RangeError('unknown matrix coordinate')
 return weights.map((weight,k)=>({key:k,raw:c.trace.rawScores[b][h][q][k],scaled:c.trace.scores[b][h][q][k],allowed:c.trace.allowed[b][h][q][k],weight}))
}
export function contributionsAt(c,b,h,q,dimension){
 if(!Number.isInteger(dimension)||dimension<0||dimension>=c.trace.value[b][h][0].length)throw RangeError('value dimension')
 return rowAt(c,b,h,q).map(row=>({...row,value:c.trace.value[b][h][row.key][dimension],product:row.weight*c.trace.value[b][h][row.key][dimension]}))
}
export function positionAt(data,index){const value=data.probes.positions[Number(index)];if(!value)throw RangeError('unknown position');return value}
export function format(v){if(v===null)return'No aplica';const n=Number(v);return n.toLocaleString('es',{maximumSignificantDigits:6,notation:n!==0&&(Math.abs(n)<1e-4||Math.abs(n)>=1e6)?'scientific':'standard'})}
