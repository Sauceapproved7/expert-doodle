// Hercules-owned proof harness for the opt-in native chat path.
// No customer prompts, provider keys, production inference or release approval.
import {randomBytes} from "node:crypto";
import {performance} from "node:perf_hooks";
import {fileURLToPath} from "node:url";
import {createModelPlaneService} from "../hercules-models/service.mjs";
import {createLocalChatAdapter} from "../hercules-models/local-chat.mjs";

export async function proveAuthenticatedLocalChat({
  backendEndpoint,
  modelId,
  prompt,
  maxOutputTokens=32,
  fetchImpl=globalThis.fetch,
}={}){
  // Local adapter validation happens before any listening or remote fetch.
  const adapter=createLocalChatAdapter({
    enabled:true,
    protocol:"llama-cpp",
    endpoint:backendEndpoint,
    model:modelId,
    fetchImpl,
  });
  const token=randomBytes(32).toString("hex");
  const server=createModelPlaneService({models:[],token,chatAdapter:adapter});
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const origin="http://127.0.0.1:"+server.address().port;
  try{
    const unauthorized=await fetchImpl(origin+"/v1/chat",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({prompt,maxOutputTokens}),
      redirect:"error",
      signal:AbortSignal.timeout(15000),
    });
    if(unauthorized.status!==401){
      throw new Error("model_plane_unauthorized_request_was_not_rejected");
    }
    const readiness=await fetchImpl(origin+"/v1/chat/readiness",{
      headers:{authorization:"Bearer "+token},
      redirect:"error",
      signal:AbortSignal.timeout(15000),
    });
    if(!readiness.ok)throw new Error("model_plane_readiness_unavailable");
    const state=await readiness.json();
    if(state.enabled!==true || state.inferenceVerified!==false ||
       state.publicReleaseApproved!==false || state.protocol!=="llama-cpp"){
      throw new Error("model_plane_readiness_policy_mismatch");
    }
    const start=performance.now();
    const response=await fetchImpl(origin+"/v1/chat",{
      method:"POST",
      headers:{authorization:"Bearer "+token,"content-type":"application/json"},
      body:JSON.stringify({prompt,maxOutputTokens}),
      redirect:"error",
      signal:AbortSignal.timeout(150000),
    });
    const elapsedMs=Math.round((performance.now()-start)*100)/100;
    let body;
    try{body=await response.json();}catch{throw new Error("model_plane_response_invalid")}
    if(response.status!==200){
      throw new Error(typeof body?.error==="string"?body.error:"model_plane_chat_failed");
    }
    if(typeof body?.outputText!=="string" || !body.outputText.trim() ||
       body.inferenceVerified!==true || body.publicReleaseApproved!==false ||
       body.origin!=="local-loopback"){
      throw new Error("model_plane_inference_not_proven");
    }
    return Object.freeze({
      backend:"llama-cpp-loopback",
      authenticatedReplyReceived:true,
      unauthenticatedRequestRejected:true,
      generatedTextPresent:true,
      sampleText:body.outputText.trim().slice(0,180),
      elapsedMs,
      productionChatQualified:false,
      publicReleaseApproved:false,
      paidCommerceEnabled:false,
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
}

if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  if(process.argv[2]!=="--prove")throw new Error("only fixed local proof mode is supported");
  try{
    const proof=await proveAuthenticatedLocalChat({
      backendEndpoint:"http://127.0.0.1:18773",
      modelId:"hercules-trial",
      prompt:"What is the capital of France?",
      maxOutputTokens:32
    });
    process.stdout.write(JSON.stringify(proof)+"\n");
  }catch(err){
    process.stdout.write(JSON.stringify({
      authenticatedReplyReceived:false,
      productionChatQualified:false,
      publicReleaseApproved:false,
      error:typeof err?.message==="string"?err.message.slice(0,120):"proof_failed"
    })+"\n");
    process.exitCode=1;
  }
}
