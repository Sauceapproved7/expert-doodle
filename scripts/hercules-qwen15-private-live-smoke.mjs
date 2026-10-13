// Evidence-only live integration smoke of the existing, authenticated Hercules
// owner-host sidecar. Runs against loopback on a temporary ARM64 CI runner.
const ORIGIN="http://127.0.0.1:38900";
const TEST_PROMPT="What is 2 + 2? Answer with only the number.";
function matched(row,status){return row?.status===status&&row?.body&&typeof row.body==="object";}
export function assessQwen15PrivateSmoke(evidence){
  const e=evidence??{};
  const goodOrigin=e.endpoint===ORIGIN;
  const checks=Object.freeze({
    loopbackEndpoint:goodOrigin,
    noPublicHealthApproval:matched(e.health,200)&&e.health.body.ok===true&&
      e.health.body.service==="hercules-model-plane"&&e.health.body.nativeOnly===true,
    missingBearerRejected:matched(e.noToken,401)&&e.noToken.body.error==="unauthorized",
    wrongBearerRejected:matched(e.wrongToken,401)&&e.wrongToken.body.error==="unauthorized",
    invalidPromptRejected:matched(e.emptyPrompt,400)&&
      e.emptyPrompt.body.error==="local_chat_prompt_invalid",
    protectedReadiness:matched(e.readiness,200)&&
      e.readiness.body.enabled===true&&
      e.readiness.body.backend==="loopback-only"&&
      e.readiness.body.protocol==="llama-cpp"&&
      e.readiness.body.modelConfigured===true&&
      e.readiness.body.inferenceVerified===false&&
      e.readiness.body.publicReleaseApproved===false,
    substantiveChat:matched(e.chat,200)&&
      e.chat.body.origin==="local-loopback"&&
      e.chat.body.outputText==="4"&&
      e.chat.body.inferenceVerified===true&&
      e.chat.body.publicReleaseApproved===false,
    boundedLatency:Number.isSafeInteger(e.elapsedMs)&&e.elapsedMs>0&&e.elapsedMs<=30000
  });
  const qualifies=Object.values(checks).every(Boolean);
  return Object.freeze({
    schema:"hercules.qwen15.owner-host-live-smoke.v1",
    privateLoopbackAuthenticatedAndGenerated:qualifies,
    checks,
    observedElapsedMs:checks.boundedLatency?e.elapsedMs:null,
    ownerHostBillingVerified:false,hostOwnershipVerified:false,
    productionInferenceVerified:false,publicReleaseApproved:false,
    aiDevbrainHealthy:false,paidCommerceEnabled:false
  });
}
export async function executeQwen15PrivateSmoke({token,fetchImpl=globalThis.fetch}={}){
  if(typeof token!=="string"||token.length<32||typeof fetchImpl!=="function")
    throw new TypeError("private owner token and HTTP transport required");
  async function request(path,{method="GET",body,authorization}={}){
    const headers={accept:"application/json"};
    if(method==="POST")headers["content-type"]="application/json";
    if(authorization)headers.authorization=authorization;
    const resp=await fetchImpl(ORIGIN+path,{
      method,headers,
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
      signal:AbortSignal.timeout(20000),redirect:"error",cache:"no-store"
    });
    const result=await resp.json();
    return Object.freeze({status:resp.status,body:result});
  }
  const started=Date.now();
  const data={
    endpoint:ORIGIN,
    health:await request("/health"),
    noToken:await request("/v1/chat",{
      method:"POST",body:{prompt:TEST_PROMPT,maxOutputTokens:32}
    }),
    wrongToken:await request("/v1/chat",{
      method:"POST",authorization:"Bearer wrong",
      body:{prompt:TEST_PROMPT,maxOutputTokens:32}
    }),
    emptyPrompt:await request("/v1/chat",{
      method:"POST",authorization:"Bearer "+token,body:{prompt:"",maxOutputTokens:32}
    }),
    readiness:await request("/v1/chat/readiness",{authorization:"Bearer "+token}),
    chat:await request("/v1/chat",{
      method:"POST",authorization:"Bearer "+token,
      body:{prompt:TEST_PROMPT,maxOutputTokens:32}
    }),
    elapsedMs:Math.max(1,Date.now()-started)
  };
  return assessQwen15PrivateSmoke(data);
}

if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
  let verdict;
  try{
    verdict=await executeQwen15PrivateSmoke({
      token:process.env.HERCULES_MODEL_TOKEN
    });
  }catch{
    verdict=assessQwen15PrivateSmoke({});
  }
  // Do not print token, HTTP response bodies or any user content.
  process.stdout.write(JSON.stringify(verdict)+"\n");
  if(!verdict.privateLoopbackAuthenticatedAndGenerated)process.exitCode=1;
}
