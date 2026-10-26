export function terms(probes,config,row,col){
 const output=config.output
 if(!Number.isInteger(row)||!Number.isInteger(col)||!output[row]||col<0||col>=output[row].length)throw RangeError('output coordinate')
 return probes.kernel.flatMap((line,kr)=>line.map((weight,kc)=>{
  const r=row*config.stride-config.padding+kr*config.dilation,c=col*config.stride-config.padding+kc*config.dilation
  const padded=r<0||c<0||r>=probes.input.length||c>=probes.input[0].length,value=padded?0:probes.input[r][c]
  return {row:r,col:c,padded,value,weight,product:value*weight}
 }))
}
export function selectFeature(data,sample,stage,channel){
 const matrix=data.features[sample]?.maps[stage]?.[channel]
 if(!matrix)throw RangeError('feature selection')
 return matrix
}
export function pixel(matrix,row,col){
 if(!Number.isInteger(row)||!Number.isInteger(col)||!matrix[row]||col<0||col>=matrix[row].length)throw RangeError('pixel coordinate')
 return matrix[row][col]
}
export function scaleBounds(data,sample,stage,channel,local=false){
 const values=local?selectFeature(data,sample,stage,channel).flat():data.features.flatMap(f=>f.maps[stage].flat(2))
 const max=Math.max(...values.map(Math.abs),1e-12)
 return stage.endsWith('_pre')?[-max,max]:[0,max]
}
export function selectRun(data,seed,mode){
 const run=data.runs.find(r=>r.seed===Number(seed)&&r.mode===mode)
 if(!run)throw RangeError('run selection')
 return run
}
export function checkpoint(run,epoch){
 const point=run.history.find(p=>p.epoch===Number(epoch))
 if(!point)throw RangeError('unobserved epoch')
 return point
}
export const format=value=>Number(value).toLocaleString('es',{maximumSignificantDigits:6})
