export function createExperiment({hypothesis,control,variable,successMetric,minSampleSize=100}={}){
 if(!hypothesis||!control||!variable||!successMetric) throw new Error("incomplete_experiment");
 if(!Number.isFinite(Number(minSampleSize))||Number(minSampleSize)<1) throw new Error("invalid_sample_size");
 return {status:"draft",hypothesis,control,variable,successMetric,minSampleSize:Number(minSampleSize),winner:null,lesson:null};
}
export function concludeExperiment(exp,{sampleSize,result,lesson}={}){
 if(!exp||exp.status!=="draft") throw new Error("invalid_experiment_state");
 if(Number(sampleSize)<exp.minSampleSize) return {...exp,status:"collecting",sampleSize:Number(sampleSize)||0};
 if(!["control","variable","inconclusive"].includes(result)) throw new Error("invalid_result");
 return {...exp,status:"complete",sampleSize:Number(sampleSize),winner:result,lesson:lesson||null};
}
