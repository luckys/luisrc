export const labels={linear:'Linear',scratch:'Scratch',head:'Head',gradual:'Gradual',full:'Full',lora:'LoRA',adapter:'Adapter'};
export function selectRun(data,mode,seed) {
 const run=data.adaptations.find(v=>v.mode===mode&&v.seed===Number(seed));
 if(!run)throw Error('Unknown archived run');return run;
}
export function loraBudget(input,output,rank,head=18) {
 if(![input,output,rank].every(v=>Number.isInteger(v)&&v>0))throw Error('Positive integer dimensions required');
 return {base:input*output,factors:rank*(input+output),trainable:rank*(input+output)+head};
}
export function predictionCounts(run) {
 const matrix=[[0,0],[0,0]];
 run.test.labels.forEach((label,i)=>matrix[label][run.test.predictions[i]]++);
 return matrix;
}
