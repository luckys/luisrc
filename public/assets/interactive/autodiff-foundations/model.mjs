export function scalarTrace(w,x){
 if(!Number.isFinite(w)||!Number.isFinite(x)||Math.abs(w)>3||Math.abs(x)>3)throw Error('bounded inputs required')
 const q=w*x,r=q+q,loss=r*r,dr=2*r,dqLeft=dr,dqRight=dr,dq=dqLeft+dqRight
 return{w,x,q,r,loss,dr,dqLeft,dqRight,dq,dw:dq*x,dx:dq*w}
}
export function scalarStep(t,index){
 if(!Number.isInteger(index)||index<0||index>6)throw Error('invalid stage')
 const fields=['w','x',...(index>=1?['q']:[]),...(index>=2?['r']:[]),...(index>=3?['loss']:[]),...(index>=4?['dr']:[]),...(index>=5?['dqLeft','dqRight','dq']:[]),...(index>=6?['dw','dx']:[])]
 return Object.fromEntries(fields.map(k=>[k,t[k]]))
}
export function comparisonVector(c,method,epsilonIndex){
 if(method==='torch')return c.torch
 if(method==='finite')return c.finite[epsilonIndex].vector
 if(method==='detach')return c.checks.detached
 if(Object.hasOwn(c.mutants,method))return c.mutants[method].vector
 throw Error('unknown method')
}
export function formatNumber(value){
 if(value===null)return 'Sin trayectoria (grad = None)'
 if(Number.isInteger(value))return String(value)
 return (Math.abs(value)<.001?value.toExponential(4):value.toFixed(7)).replace('.',',')
}
export const methodNames={finite:'Diferencias finitas',torch:'PyTorch autograd',missing_mean:'Sin promedio del batch',missing_tanh:'Sin derivada de tanh',bias_mean:'Promedio del bias otra vez',extra_sigmoid:'Derivada sigmoid añadida',detach:'Hidden con detach()'}
