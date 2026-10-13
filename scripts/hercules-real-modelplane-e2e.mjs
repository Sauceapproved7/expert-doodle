// Original Hercules lab-only end-to-end probe against a real local llama.cpp process.
// Noncustomer fixed prompt. Does not promote chat quality or activate a public service.
import {createLocalChatAdapter} from "../hercules-models/local-chat.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

export function validateIsolatedChatResult(reply){
  const payload=reply?.body;
  const valid=reply?.status===200 && payload?.origin==="local-loopback" &&
    payload.inferenceVerified===true && payload.publicReleaseApproved===false &&
    typeof payload.outputText==="string" && payload.outputText.trim().length>0 &&
    payload.outputText.length<=10000;
  return Object.freeze({valid:Boolean(valid),publicReleaseApproved:false});
}

export async function runIsolatedProbe(){
  const token="lab-only-authenticated-probe-not-a-secret";
  const chatAdapter=createLocalChatAdapter({
    enabled:true,protocol:"llama-cpp",endpoint:"http://127.0.0.1:18773",
    model:"hercules-trial"
  });
  const server=createModelPlaneService({models:[],token,chatAdapter});
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const origin="http://127.0.0.1:"+server.address().port;
  try{
    const request={
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({prompt:"What is 2 plus 2? Answer with the number only.",maxOutputTokens:32})
    };
    const rejected=await fetch(origin+"/v1/chat",request);
    if(rejected.status!==401){
      throw new Error("model_plane_unauthenticated_request_was_not_rejected");
    }
    const state=await fetch(origin+"/v1/chat/readiness",{
      headers:{authorization:"Bearer "+token}
    });
    const readiness=await state.json();
    if(state.status!==200||readiness.enabled!==true||
       readiness.protocol!=="llama-cpp"||
       readiness.inferenceVerified!==false||
       readiness.publicReleaseApproved!==false){
      throw new Error("local_model_readiness_policy_broken");
    }
    const response=await fetch(origin+"/v1/chat",{
      ...request,headers:{...request.headers,authorization:"Bearer "+token},
      signal:AbortSignal.timeout(30000)
    });
    const body=await response.json();
    const verdict=validateIsolatedChatResult({status:response.status,body});
    if(!verdict.valid)throw new Error("local_modelplane_inference_unverified");
    const output=body.outputText.replace(/[\r\n\t]+/g," ").slice(0,160);
    return Object.freeze({
      authenticatedRealInferenceVerified:true,
      unauthenticatedRequestRejected:true,
      backend:"loopback-llama-cpp",
      generatedText:output,
      productionQualityVerified:false,
      publicReleaseApproved:false,
      productionConnected:false,
    });
  }finally{
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
}

if(process.argv[1]&&import.meta.url.endsWith("/"+process.argv[1].split("/").at(-1)) &&
  process.argv.includes("--lab")){
  runIsolatedProbe().then(
    result=>process.stdout.write(JSON.stringify(result)+"\n"),
    ()=>{process.stdout.write(JSON.stringify({authenticatedRealInferenceVerified:false,
      publicReleaseApproved:false,error:"isolated_modelplane_evidence_failed"})+"\n");process.exitCode=1;}
  );
}
