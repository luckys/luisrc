export function activation(kind, x) {
  if (!Number.isFinite(x)) throw Error('finite value required')
  if (kind === 'tanh') return Math.tanh(x)
  if (kind === 'relu') return Math.max(0,x)
  if (kind === 'sigmoid') {
    const e=Math.exp(-Math.abs(x))
    return x>=0?1/(1+e):e/(1+e)
  }
  throw Error('unknown activation')
}
export function infer(point, layers) {
  if(point.length!==2||!point.every(Number.isFinite)||![1,2].includes(layers.length))throw Error('invalid point or architecture')
  let values=point,hidden=[]
  for(const [i,layer]of layers.entries()){
    const {weight,bias}=layer
    if(weight.length!==values.length||!bias.length||weight.some(row=>row.length!==bias.length||!row.every(Number.isFinite))||!bias.every(Number.isFinite))throw Error('invalid dense shape')
    values=bias.map((b,j)=>values.reduce((sum,v,k)=>sum+v*weight[k][j],b))
    if(i<layers.length-1){values=values.map(Math.tanh);hidden=values}
  }
  if(values.length!==1)throw Error('one output logit required')
  return {logit:values[0],probability:activation('sigmoid',values[0]),hidden}
}
