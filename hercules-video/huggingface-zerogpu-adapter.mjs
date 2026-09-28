import {HerculesVideoAdapter} from "./adapter.mjs";

function normalizeBaseUrl(value) {
  const raw=String(value||"").trim().replace(/\/+$/,"");
  if (!/^https:\/\/[-a-z0-9.]+\.hf\.space$/i.test(raw)) throw new Error("zerogpu_space_url_invalid");
  return raw;
}

function authHeaders(token) {
  return token ? {"authorization":"Bearer "+token} : {};
}

function requestFingerprint(request) {
  if (!request?.requestFingerprint) throw new Error("render_request_fingerprint_required");
  if (request?.schema!=="sauceapproved.hercules.video-render-request") throw new Error("render_request_schema_invalid");
  return String(request.requestFingerprint);
}

function parseSse(text) {
  const events=[];
  let event="message",data=[];
  for (const line of String(text||"").split(/\r?\n/)) {
    if (!line) {
      if (data.length) events.push({event,data:data.join("\n")});
      event="message";data=[];
      continue;
    }
    if (line.startsWith("event:")) event=line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (data.length) events.push({event,data:data.join("\n")});
  return events;
}

function parseComplete(events) {
  const failed=[...events].reverse().find(x=>x.event==="error");
  if (failed) return {status:"failed",error:{code:"zerogpu_render_failed",message:failed.data,retryable:true}};
  const complete=[...events].reverse().find(x=>x.event==="complete");
  if (!complete) return {status:"running"};
  let data;
  try { data=JSON.parse(complete.data); } catch { throw new Error("zerogpu_complete_payload_invalid"); }
  const outputs=Array.isArray(data)?data:[data];
  const file=outputs[0];
  let meta=outputs[1]||{};
  if (typeof meta==="string") {
    try { meta=JSON.parse(meta); } catch { meta={raw:meta}; }
  }
  const uri=typeof file==="string"?file:String(file?.url||file?.path||"");
  if (!uri) throw new Error("zerogpu_video_artifact_missing");
  return {
    status:"completed",
    artifact:{
      uri,
      mimeType:"video/mp4",
      sizeBytes:Number(meta?.sizeBytes||0)||null,
      sha256:meta?.sha256?String(meta.sha256):null,
      width:Number(meta?.width||0)||null,
      height:Number(meta?.height||0)||null,
      durationSeconds:Number(meta?.durationSeconds||0)||null,
      fps:Number(meta?.fps||0)||null,
      providerEvidence:{
        backend:"huggingface-zerogpu",
        modelRef:meta?.modelRef?String(meta.modelRef):null,
        seed:Number.isSafeInteger(Number(meta?.seed))?Number(meta.seed):null,
        requestFingerprint:meta?.requestFingerprint?String(meta.requestFingerprint):null
      }
    }
  };
}

export class HerculesHuggingFaceZeroGpuAdapter extends HerculesVideoAdapter {
  #token;
  #fetch;
  constructor({
    id="huggingface-zerogpu-wan22",
    label="Hugging Face ZeroGPU · Wan2.2",
    spaceUrl,
    apiName="generate",
    token=null,
    fetchImpl=globalThis.fetch
  }={}) {
    super({id,label,kind:"external-renderer",provider:"huggingface",runtime:"zerogpu",protocol:"gradio-v1"});
    this.spaceUrl=normalizeBaseUrl(spaceUrl);
    this.apiName=String(apiName||"generate").replace(/^\//,"");
    this.#token=token?String(token):null;
    if (typeof fetchImpl!=="function") throw new Error("zerogpu_fetch_required");
    this.#fetch=fetchImpl;
  }

  async health() {
    const r=await this.#fetch(this.spaceUrl+"/gradio_api/openapi.json",{
      method:"GET",headers:{accept:"application/json",...authHeaders(this.#token)}
    });
    if (!r.ok) return {ok:false,status:r.status,backend:"huggingface-zerogpu"};
    const spec=await r.json().catch(()=>null);
    const path="/gradio_api/call/"+this.apiName;
    const endpointPresent=Boolean(spec?.paths?.[path]);
    return {ok:endpointPresent,status:r.status,backend:"huggingface-zerogpu",endpointPresent};
  }

  async estimate(request) {
    requestFingerprint(request);
    return {supported:true,estimatedSeconds:null,quotaBound:true,backend:"huggingface-zerogpu"};
  }

  async generate(request) {
    const fingerprint=requestFingerprint(request);
    const r=await this.#fetch(this.spaceUrl+"/gradio_api/call/"+this.apiName,{
      method:"POST",
      headers:{"content-type":"application/json",accept:"application/json",...authHeaders(this.#token)},
      body:JSON.stringify({data:[JSON.stringify(request)]})
    });
    const body=await r.json().catch(()=>({}));
    if (!r.ok||!String(body?.event_id||"").trim()) {
      const error=new Error("zerogpu_submit_failed:"+r.status);
      error.status=r.status;
      throw error;
    }
    return {
      status:"queued",
      remoteJobId:String(body.event_id),
      requestFingerprint:fingerprint,
      backend:"huggingface-zerogpu"
    };
  }

  async status(remoteJobId,{signal}={}) {
    const id=String(remoteJobId||"").trim();
    if (!id) throw new Error("remote_job_id_required");
    const r=await this.#fetch(this.spaceUrl+"/gradio_api/call/"+this.apiName+"/"+encodeURIComponent(id),{
      method:"GET",headers:{accept:"text/event-stream",...authHeaders(this.#token)},signal
    });
    if (!r.ok) return {status:"failed",error:{code:"zerogpu_status_failed",message:"HTTP "+r.status,retryable:r.status>=500}};
    return parseComplete(parseSse(await r.text()));
  }

  async inspect(asset) {
    const uri=String(asset?.uri||"").trim();
    if (!/^https:\/\//i.test(uri)) throw new Error("zerogpu_asset_url_required");
    const r=await this.#fetch(uri,{method:"HEAD",headers:{...authHeaders(this.#token)}});
    return {
      ok:r.ok,
      status:r.status,
      contentType:r.headers?.get?.("content-type")||null,
      contentLength:Number(r.headers?.get?.("content-length")||0)||null
    };
  }
}

export const __test={parseSse,parseComplete,normalizeBaseUrl};
