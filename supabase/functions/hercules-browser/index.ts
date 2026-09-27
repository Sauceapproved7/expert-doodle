import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const U = Deno.env.get("SUPABASE_URL")!;
const S = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(U, S, { auth: { persistSession: false } });

const ACTIONS = new Set(["navigate","scrape","screenshot","interact","close_session"]);
const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)$/i;

function out(body: unknown, status=200, extra: Record<string,string>={}) {
  return new Response(JSON.stringify(body), {status, headers:{
    "content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff","referrer-policy":"no-referrer",...extra
  }});
}
function safeUrl(raw: unknown) {
  if (typeof raw !== "string" || !raw || raw.length > 2048) throw new Error("invalid_target_url");
  const u = new URL(raw);
  if (!["http:","https:"].includes(u.protocol)) throw new Error("unsupported_protocol");
  const h=u.hostname.toLowerCase();
  if(!h || h.endsWith(".local") || h.endsWith(".internal") || PRIVATE_HOST.test(h)) throw new Error("private_target_blocked");
  return u.toString();
}
function clamp(v: unknown,min:number,max:number,fallback:number){
  const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;
}
function normalizeSteps(input: unknown,maxSteps:number){
  if(!Array.isArray(input)) return [];
  return input.slice(0,maxSteps).map((s:any)=>{
    const type=String(s?.type||"");
    if(!["click","type","wait","extract"].includes(type)) throw new Error("unsupported_step");
    const selector=typeof s?.selector==="string"?s.selector.slice(0,500):"";
    if(["click","type","extract"].includes(type)&&!selector) throw new Error("selector_required");
    if(type==="type") return {type,selector,text:String(s?.text||"").slice(0,4000)};
    if(type==="wait") return {type,ms:clamp(s?.ms,0,5000,500)};
    return {type,selector};
  });
}
function normalizeSelectors(input: unknown){
  if(!Array.isArray(input)) return [];
  return input.slice(0,25).map(x=>String(x||"").slice(0,500)).filter(Boolean);
}
async function actor(req: Request){
  const h=req.headers.get("authorization")||"";
  const token=h.startsWith("Bearer ")?h.slice(7):"";
  if(!token) return null;
  const {data,error}=await admin.auth.getUser(token);
  return error||!data.user?null:data.user;
}
async function sha256(value:string){
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function internalAuthorized(req:Request){
  const key=req.headers.get("x-hercules-internal-key")||"";
  if(!key) return false;
  const digest=await sha256(key);
  const {data,error}=await admin.from("hercules_internal_service_keys")
    .select("key_sha256,enabled").eq("purpose","browser-gateway").eq("enabled",true).maybeSingle();
  return !error && Boolean(data?.key_sha256) && data.key_sha256===digest;
}
async function worker(){
  const {data,error}=await admin.from("hercules_browser_workers").select("*")
    .eq("name","primary").eq("enabled",true).maybeSingle();
  if(error||!data) throw new Error("browser_worker_unavailable");
  const {data:secret,error:se}=await admin.rpc("hercules_get_secret",{p_id:data.token_secret_ref});
  if(se||!secret) throw new Error("browser_worker_credential_unavailable");
  return {...data,token:String(secret)};
}
function decodeBase64(value:string){
  const raw=atob(value); const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  return bytes;
}

function transientClosedSession(error:unknown){
  const message=error instanceof Error?error.message:String(error||"");
  return /target page, context or browser has been closed/i.test(message)
    || /browser has been closed/i.test(message)
    || /target closed/i.test(message);
}

function transientNavigationContextFailure(error:unknown){
  const message=error instanceof Error?error.message:String(error||"");
  return /execution context was destroyed/i.test(message)
    && /navigation/i.test(message);
}

function transientWorkerFailure(error:unknown){
  const message=error instanceof Error?error.message:String(error||"");
  return /failed to connect to backend/i.test(message)
    || /service unavailable/i.test(message)
    || /bad gateway/i.test(message)
    || /too many requests/i.test(message)
    || /websocket was closed before the connection was established/i.test(message)
    || /connectOverCDP[\s\S]*(?:429|502|503|504)/i.test(message)
    || /ws unexpected response[^\n]*(?:429|502|503|504)/i.test(message);
}
function delay(ms:number){
  return new Promise<void>(resolve=>setTimeout(resolve,ms));
}
function withWorkerTelemetry(error:unknown,attempts:number,warm:any){
  const wrapped=error instanceof Error?error:new Error(String(error||"browser_worker_failed"));
  (wrapped as any).workerAttempts=Math.max(1,attempts);
  (wrapped as any).warmup=warm;
  return wrapped;
}
function workerErrorAttempts(error:unknown){
  const n=Number((error as any)?.workerAttempts||1);
  return Number.isFinite(n)?Math.max(1,Math.trunc(n)):1;
}

async function acquireWorkerLease(workerName:string,traceId:string,waitBudgetMs=45000){
  const started=Date.now();
  while(Date.now()-started<waitBudgetMs){
    const {data,error}=await admin.rpc("hercules_browser_worker_lease_acquire",{
      p_worker_name:workerName,
      p_trace_id:traceId,
      p_ttl_seconds:75
    });
    if(error) throw new Error("browser_capacity_lease_failed");
    if(data) return String(data);
    await delay(350);
  }
  throw new Error("browser_capacity_busy");
}
async function releaseWorkerLease(leaseId:string|null,traceId:string){
  if(!leaseId)return;
  try{
    await admin.rpc("hercules_browser_worker_lease_release",{
      p_lease_id:leaseId,
      p_trace_id:traceId
    });
  }catch{}
}

function detectSecurityChallenge(page:any){
  const title=String(page?.title||"").trim().toLowerCase();
  const text=String(page?.text||"").toLowerCase();
  const url=String(page?.url||"").toLowerCase();
  const cloudflare=
    title==="just a moment..." ||
    /performing security verification/.test(text) ||
    /verify you are not a bot/.test(text) ||
    /performance and security by cloudflare/.test(text) ||
    /__cf_chl_|\/cdn-cgi\/challenge-platform/.test(url);
  if(!cloudflare)return null;
  return {
    detected:true,
    provider:"cloudflare",
    kind:"security_verification",
    humanVerificationRequired:true,
    bypassAttempted:false
  };
}

function warmupUrls(w:any){
  const raw=Array.isArray(w?.metadata?.warmup_urls)?w.metadata.warmup_urls:[];
  const urls:string[]=[];
  for(const value of raw.slice(0,4)){
    try{
      const safe=safeUrl(String(value||""));
      if(!urls.includes(safe))urls.push(safe);
    }catch{}
  }
  return urls;
}
async function warmWorkers(urls:string[]){
  if(!urls.length)return {attempted:0,responded:0};
  const settled=await Promise.allSettled(urls.map(async url=>{
    const r=await fetch(url,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(45000)});
    await r.body?.cancel().catch(()=>{});
    return r.status;
  }));
  return {
    attempted:urls.length,
    responded:settled.filter(x=>x.status==="fulfilled").length
  };
}
async function callWorker(endpoint:URL,w:any,payload:any,timeoutMs:number){
  const run=async()=>{
    const r=await fetch(endpoint,{
      method:"POST",
      headers:{"content-type":"application/json","authorization":"Bearer "+w.token},
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(timeoutMs+15000)
    });
    const text=await r.text();
    let result:any;
    try{result=JSON.parse(text)}catch{result={raw:text.slice(0,2000)}}
    if(!r.ok)throw new Error("worker_http_"+r.status+":"+String(result?.error||text).slice(0,1200));
    return result;
  };

  const maxAttempts=5;
  const retryBudgetMs=45000;
  const started=Date.now();
  const urls=warmupUrls(w);
  let warm=await warmWorkers(urls);
  let lastError:unknown=null;

  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      return {result:await run(),attempts:attempt,warm};
    }catch(error){
      lastError=error;
      if(!transientWorkerFailure(error)||attempt>=maxAttempts){
        throw withWorkerTelemetry(error,attempt,warm);
      }

      const backoffMs=Math.min(10000,2000*(2**(attempt-1)));
      if(Date.now()-started+backoffMs>retryBudgetMs){
        throw withWorkerTelemetry(error,attempt,warm);
      }

      await delay(backoffMs);
      if(urls.length){
        const warmRetry=await warmWorkers(urls);
        warm={
          attempted:warm.attempted+warmRetry.attempted,
          responded:warm.responded+warmRetry.responded
        };
      }
    }
  }

  throw withWorkerTelemetry(lastError,maxAttempts,warm);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="GET") return out({
    ok:true,service:"hercules-browser",version:"1.5.4",
    actions:Array.from(ACTIONS),rawCodeExecution:false,
    sessionReuse:true,securityChallengeDetection:true,antiBotBypass:false,controlPlane:"Hercules"
  });
  if(req.method!=="POST") return out({error:"method_not_allowed"},405);

  const user=await actor(req);
  const internalOk=user?false:await internalAuthorized(req);
  if(!user&&!internalOk) return out({error:"unauthorized"},401);

  const body=await req.json().catch(()=>({}));
  const action=String(body?.action||"navigate");
  if(!ACTIONS.has(action)) return out({error:"unsupported_action"},400);

  let targetUrl:string|null=null;
  if(action!=="close_session"){
    if(body?.url){
      try{targetUrl=safeUrl(body.url)}catch(e){return out({error:e instanceof Error?e.message:"invalid_target_url"},400)}
    } else if(!body?.sessionId) {
      return out({error:"target_url_or_session_id_required"},400);
    }
  } else if(!body?.sessionId) return out({error:"session_id_required"},400);

  const w=await worker().catch(()=>null);
  if(!w) return out({error:"browser_worker_unavailable"},503);
  const maxSteps=clamp(w.max_steps,1,50,25);
  const timeoutMs=clamp(body?.timeoutMs,1000,Math.min(Number(w.max_duration_ms||60000),60000),30000);
  const maxTextChars=clamp(body?.maxTextChars,1000,100000,30000);
  let steps:any[]=[]; let selectors:string[]=[];
  try{steps=normalizeSteps(body?.steps,maxSteps);selectors=normalizeSelectors(body?.selectors)}
  catch(e){return out({error:e instanceof Error?e.message:"invalid_request"},400)}

  const traceId=crypto.randomUUID();
  const allowedDomains=targetUrl?[new URL(targetUrl).hostname.toLowerCase()]:[];
  const {data:run}=await admin.from("hercules_browser_runs").insert({
    trace_id:traceId,requested_by:user?.id||null,mode:"safe",status:"running",
    target_url:targetUrl,allowed_domains:allowedDomains,
    request:{action,stepCount:steps.length,selectorCount:selectors.length,timeoutMs,maxTextChars,
      source:typeof body?.source==="string"?body.source.slice(0,120):null,
      sessionId:body?.sessionId||null,persistSession:body?.persistSession===true},
    attempt_count:1,started_at:new Date().toISOString()
  }).select("id").maybeSingle();

  let workerAttemptsObserved=0;
  let workerLeaseId:string|null=null;

  try{
    workerLeaseId=await acquireWorkerLease(String(w.name||"primary"),traceId);
    const endpoint=new URL(w.base_url);
    endpoint.pathname="/v1/run";
    const payload:any={
      action,url:targetUrl||undefined,timeoutMs,maxTextChars,steps,selectors,
      fullPage:body?.fullPage!==false,
      persistSession:body?.persistSession===true,
      sessionId:body?.sessionId||undefined
    };
    let sessionRecoveryAttempts=0;
    let sessionRecovered=false;
    let navigationRecoveryAttempts=0;
    let navigationRecovered=false;
    let workerCall:any;
    try{
      workerCall=await callWorker(endpoint,w,payload,timeoutMs);
      workerAttemptsObserved+=workerCall.attempts;
    }catch(first){
      workerAttemptsObserved+=workerErrorAttempts(first);

      if(action==="navigate"&&targetUrl&&!body?.sessionId&&transientNavigationContextFailure(first)){
        navigationRecoveryAttempts=1;
        const screenshotPayload={
          ...payload,
          action:"screenshot",
          fullPage:false,
          persistSession:true
        };
        delete screenshotPayload.sessionId;

        let screenshotCall:any;
        try{
          screenshotCall=await callWorker(endpoint,w,screenshotPayload,timeoutMs);
          workerAttemptsObserved+=screenshotCall.attempts;
        }catch(second){
          workerAttemptsObserved+=workerErrorAttempts(second);
          throw second;
        }

        const recoveredSessionId=String(screenshotCall?.result?.sessionId||"");
        if(!recoveredSessionId)throw new Error("navigation_recovery_session_unavailable");

        const observePayload={
          action:"scrape",
          sessionId:recoveredSessionId,
          selectors:[],
          timeoutMs,
          maxTextChars,
          persistSession:true
        };
        try{
          workerCall=await callWorker(endpoint,w,observePayload,timeoutMs);
          workerAttemptsObserved+=workerCall.attempts;
        }catch(second){
          workerAttemptsObserved+=workerErrorAttempts(second);
          throw second;
        }
        workerCall.result={
          ...workerCall.result,
          action:"navigate",
          sessionId:recoveredSessionId
        };
        navigationRecovered=true;
      }else{
        if(!body?.sessionId||!targetUrl||!transientClosedSession(first))throw first;
        sessionRecoveryAttempts=1;
        const freshPayload={...payload};
        delete freshPayload.sessionId;
        freshPayload.persistSession=true;
        try{
          workerCall=await callWorker(endpoint,w,freshPayload,timeoutMs);
          workerAttemptsObserved+=workerCall.attempts;
        }catch(second){
          workerAttemptsObserved+=workerErrorAttempts(second);
          throw second;
        }
        sessionRecovered=true;
      }
    }
    const result=workerCall.result;
    const securityChallenge=detectSecurityChallenge(result?.page);
    const totalAttempts=Math.max(1,workerAttemptsObserved);
    if(run?.id && totalAttempts!==1) await admin.from("hercules_browser_runs").update({
      attempt_count:totalAttempts,
      updated_at:new Date().toISOString()
    }).eq("id",run.id);

    const summary={
      attempts:totalAttempts,
      workerAttempts:totalAttempts,
      sessionRecoveryAttempts,
      sessionRecovered,
      navigationRecoveryAttempts,
      navigationRecovered,
      warmup:workerCall.warm,
      engine:w.metadata?.engine||"unknown",
      action,
      title:result?.page?.title||null,
      url:result?.page?.url||targetUrl,
      textChars:String(result?.page?.text||"").length,
      linkCount:Array.isArray(result?.page?.links)?result.page.links.length:0,
      stepCount:Array.isArray(result?.steps)?result.steps.length:0,
      sessionId:result?.sessionId||null,
      bytes:result?.bytes||null,
      securityChallenge
    };
    if(run?.id) await admin.from("hercules_browser_runs").update({
      status:securityChallenge?"blocked":"succeeded",
      result:{summary},
      error:securityChallenge?"human_verification_required":null,
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq("id",run.id);

    if(action==="screenshot"&&typeof result?.base64==="string"){
      const bytes=decodeBase64(result.base64);
      return new Response(bytes,{status:200,headers:{
        "content-type":"image/png","cache-control":"no-store","x-hercules-trace-id":traceId
      }});
    }
    return out({
      ok:true,
      traceId,
      action,
      status:securityChallenge?"blocked":"succeeded",
      securityChallenge,
      result
    });
  }catch(e){
    const message=e instanceof Error?e.message.slice(0,2000):"browser_run_failed";
    if(run?.id) await admin.from("hercules_browser_runs").update({
      status:"failed",
      error:message,
      attempt_count:Math.max(1,workerAttemptsObserved),
      completed_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq("id",run.id);
    return out({
      ok:false,
      traceId,
      error:message==="browser_capacity_busy"?"browser_capacity_busy":"browser_run_failed",
      detail:message
    },message==="browser_capacity_busy"?503:502);
  }finally{
    await releaseWorkerLease(workerLeaseId,traceId);
  }
});