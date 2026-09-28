import {createHash} from "node:crypto";

const SHA256=/^[a-f0-9]{64}$/i;
const TERMINAL=new Set(["completed","failed"]);

function stable(value){
  if(value===null||typeof value!=="object")return value;
  if(Array.isArray(value))return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
}

function fingerprint(value){
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function assertAdapter(adapter){
  for(const method of ["health","generate","status","inspect"]){
    if(typeof adapter?.[method]!=="function")throw new Error("renderer_certification_adapter_invalid:"+method);
  }
  if(!String(adapter?.descriptor?.id||"").trim())throw new Error("renderer_certification_adapter_id_required");
  return adapter;
}

function assertRequest(request){
  if(request?.schema!=="sauceapproved.hercules.video-render-request")throw new Error("renderer_request_schema_invalid");
  if(!SHA256.test(String(request?.requestFingerprint||"")))throw new Error("renderer_request_fingerprint_invalid");
  return request;
}

function assertArtifact(artifact,request){
  if(!artifact||typeof artifact!=="object")throw new Error("renderer_artifact_required");
  if(!String(artifact.uri||"").trim())throw new Error("renderer_artifact_uri_required");
  if(!/^video\//i.test(String(artifact.mimeType||"")))throw new Error("renderer_artifact_mime_invalid");
  if(!Number.isInteger(Number(artifact.sizeBytes))||Number(artifact.sizeBytes)<=0)throw new Error("renderer_artifact_size_invalid");
  if(!SHA256.test(String(artifact.sha256||"")))throw new Error("renderer_artifact_sha256_invalid");
  const evidence=artifact.providerEvidence;
  if(!evidence||typeof evidence!=="object")throw new Error("renderer_provider_evidence_required");
  if(String(evidence.requestFingerprint||"")!==String(request.requestFingerprint)){
    throw new Error("renderer_request_fingerprint_mismatch");
  }
  return artifact;
}

function publicDescriptor(descriptor){
  return {
    id:String(descriptor.id),
    label:descriptor.label?String(descriptor.label):null,
    kind:descriptor.kind?String(descriptor.kind):null,
    provider:descriptor.provider?String(descriptor.provider):null,
    runtime:descriptor.runtime?String(descriptor.runtime):null,
    protocol:descriptor.protocol?String(descriptor.protocol):null,
  };
}

function publicHealth(health){
  return {
    ok:health?.ok===true,
    status:Number.isFinite(Number(health?.status))?Number(health.status):null,
    backend:health?.backend?String(health.backend):null,
    endpointPresent:health?.endpointPresent===true,
  };
}

function publicInspect(inspect){
  return {
    ok:inspect?.ok===true,
    status:Number.isFinite(Number(inspect?.status))?Number(inspect.status):null,
    contentType:inspect?.contentType?String(inspect.contentType):null,
    contentLength:Number.isFinite(Number(inspect?.contentLength))?Number(inspect.contentLength):null,
  };
}

async function delay(ms,sleep){
  if(ms<=0)return;
  await sleep(ms);
}

export async function certifyHerculesVideoRenderer({
  adapter,
  request,
  maxPolls=20,
  pollIntervalMs=1000,
  now=()=>new Date(),
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}){
  assertAdapter(adapter);
  assertRequest(request);
  if(!Number.isInteger(Number(maxPolls))||Number(maxPolls)<=0)throw new Error("renderer_certification_max_polls_invalid");
  if(!Number.isFinite(Number(pollIntervalMs))||Number(pollIntervalMs)<0)throw new Error("renderer_certification_poll_interval_invalid");

  const startedAt=now().toISOString();
  const health=await adapter.health();
  if(health?.ok!==true)throw new Error("renderer_health_check_failed");

  const submitted=await adapter.generate(request);
  let state=submitted;
  let remoteJobId=String(submitted?.remoteJobId||"").trim()||null;

  if(state?.status!=="completed"){
    if(!remoteJobId)throw new Error("renderer_remote_job_id_required");
    for(let poll=0;poll<Number(maxPolls);poll++){
      await delay(Number(pollIntervalMs),sleep);
      state=await adapter.status(remoteJobId);
      if(TERMINAL.has(String(state?.status||"")))break;
    }
  }

  if(state?.status==="failed"){
    const detail=String(state?.error?.code||state?.error?.message||"render_failed");
    throw new Error("renderer_certification_render_failed:"+detail);
  }
  if(state?.status!=="completed")throw new Error("renderer_certification_timeout");

  const artifact=assertArtifact(state.artifact,request);
  const inspected=await adapter.inspect(artifact);
  if(inspected?.ok!==true)throw new Error("renderer_artifact_inspection_failed");
  if(!/^video\//i.test(String(inspected?.contentType||"")))throw new Error("renderer_artifact_not_video");
  if(Number.isFinite(Number(inspected?.contentLength))&&Number(inspected.contentLength)<=0){
    throw new Error("renderer_artifact_empty");
  }

  const completedAt=now().toISOString();
  const record={
    schema:"sauceapproved.hercules.video-renderer-certification",
    version:1,
    certified:true,
    adapter:publicDescriptor(adapter.descriptor),
    requestFingerprint:String(request.requestFingerprint),
    remoteJobId,
    health:publicHealth(health),
    artifact:{
      uri:String(artifact.uri),
      mimeType:String(artifact.mimeType),
      sizeBytes:Number(artifact.sizeBytes),
      sha256:String(artifact.sha256).toLowerCase(),
      width:artifact.width==null?null:Number(artifact.width),
      height:artifact.height==null?null:Number(artifact.height),
      durationSeconds:artifact.durationSeconds==null?null:Number(artifact.durationSeconds),
      fps:artifact.fps==null?null:Number(artifact.fps),
      providerEvidence:{
        requestFingerprint:String(artifact.providerEvidence.requestFingerprint),
        modelRef:artifact.providerEvidence.modelRef?String(artifact.providerEvidence.modelRef):null,
        seed:artifact.providerEvidence.seed==null?null:Number(artifact.providerEvidence.seed),
      }
    },
    inspect:publicInspect(inspected),
    startedAt,
    completedAt,
    authorizationBypassed:false,
    fabricatedOutput:false,
  };
  return {...record,certificationFingerprint:fingerprint(record)};
}
