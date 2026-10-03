export async function processJob(job,{commerceEnabled=false,executeMutation,verifyConfig}={}){
  if(!job||typeof job.type!=="string")return {ok:false,status:"rejected",reason:"invalid_job"};
  if(job.type==="shopify_graphql_mutation"){
    if(!commerceEnabled)return {ok:false,status:"blocked",reason:"commerce_disabled"};
    if(typeof executeMutation!=="function")return {ok:false,status:"blocked",reason:"mutation_adapter_unavailable"};
    return {ok:true,status:"complete",result:await executeMutation(job.payload)};
  }
  if(job.type==="verify_config"){
    if(typeof verifyConfig!=="function")return {ok:false,status:"blocked",reason:"verification_adapter_unavailable"};
    return {ok:true,status:"complete",result:await verifyConfig(job.payload)};
  }
  return {ok:false,status:"rejected",reason:"unsupported_job"};
}

export async function runWorker(){
  if(process.env.COMMERCE_ENABLED==="true")throw new Error("worker_adapter_required_before_commerce_enable");
  process.stdout.write("[hercules-shopify-worker] idle; commerce disabled\n");
}

if(import.meta.url===new URL("file://"+process.argv[1]).href)runWorker().catch((error)=>{console.error(error.message);process.exitCode=1;});
