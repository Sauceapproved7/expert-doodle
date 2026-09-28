import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
import {DAY_MS,evaluateMonitorContract} from "./contracts.mjs";

const U=Deno.env.get("SUPABASE_URL")!;
const S=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const J=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||S;
const db=createClient(U,S,{auth:{persistSession:false}});
const H={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,"0")).join("");
const sha=async(s:string)=>hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
const ROTATION_KEY="ops-monitor-rotation";
const SLICE_SIZE=6;

async function authorized(req:Request){
  const key=req.headers.get("x-hercules-internal-key")||"";
  if(!key)return false;
  const digest=await sha(key);
  const {data}=await db.from("hercules_internal_service_keys")
    .select("enabled,key_sha256").eq("purpose","ops-monitor").maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===digest);
}

function requestHeaders(expected:string,internalKey:string){
  if(expected==="public-launch-contract"||expected==="launch-page-contract"||expected==="devbrain-freshness"){
    return {};
  }
  if(expected==="auth-or-json-health"){
    return {};
  }
  const headers:Record<string,string>={authorization:"Bearer "+J,apikey:S};
  if(expected==="internal-json-health")headers["x-hercules-internal-key"]=internalKey;
  return headers;
}

async function checkService(svc:any,internalKey:string){
  const started=performance.now();
  let status:number|null=null;
  let error:string|null=null;
  let body:any=null;
  let text="";
  let contentType="";
  const expected=String(svc?.metadata?.expected||"json-ok");
  const maxAgeSeconds=Math.max(60,Number(svc?.metadata?.max_age_seconds||86400)||86400);
  try{
    const r=await fetch(U+svc.health_path,{
      headers:requestHeaders(expected,internalKey),
      signal:AbortSignal.timeout(10000)
    });
    status=r.status;
    contentType=r.headers.get("content-type")||"";
    if(contentType.toLowerCase().includes("application/json")){
      body=await r.json().catch(()=>null);
    }else{
      text=await r.text();
    }
  }catch(e){
    error=e instanceof Error?e.message:"request_failed";
  }

  const evaluation=error
    ? {ok:false,reachability_ok:false,functional_ok:false,freshness_ok:null,verification_level:"failed",reason:error}
    : evaluateMonitorContract({
        expected,status,contentType,body,text,serviceSlug:String(svc.service_slug||""),
        nowMs:Date.now(),maxAgeMs:maxAgeSeconds*1000
      });

  const latency=Math.max(0,Math.round(performance.now()-started));
  const responseDetails=body&&typeof body==="object"?body:{
    content_type:contentType,
    bytes:new TextEncoder().encode(text).length
  };
  const details={
    critical:Boolean(svc.critical),
    expected,
    verification_level:evaluation.verification_level,
    reachability_ok:evaluation.reachability_ok,
    functional_ok:evaluation.functional_ok,
    freshness_ok:evaluation.freshness_ok,
    reason:evaluation.reason,
    ...responseDetails
  };
  const ok=Boolean(evaluation.ok);
  if(!ok&&!error)error=String(evaluation.reason||("http_"+status));

  await db.from("hercules_service_health_checks").insert({
    service_slug:svc.service_slug,ok,status_code:status,latency_ms:latency,error,details
  });

  if(ok){
    await db.from("hercules_service_incidents")
      .update({status:"resolved",resolved_at:new Date().toISOString(),last_seen_at:new Date().toISOString()})
      .eq("service_slug",svc.service_slug).eq("status","open");
  }else{
    const {data:open}=await db.from("hercules_service_incidents")
      .select("id,failure_count").eq("service_slug",svc.service_slug).eq("status","open").maybeSingle();
    if(open){
      await db.from("hercules_service_incidents").update({
        last_seen_at:new Date().toISOString(),
        failure_count:Number(open.failure_count||0)+1,
        last_error:error,
        metadata:{
          status_code:status,latency_ms:latency,critical:svc.critical,
          verification_level:evaluation.verification_level,
          reachability_ok:evaluation.reachability_ok,
          functional_ok:evaluation.functional_ok,
          freshness_ok:evaluation.freshness_ok
        }
      }).eq("id",open.id);
    }else{
      await db.from("hercules_service_incidents").insert({
        service_slug:svc.service_slug,last_error:error,
        metadata:{
          status_code:status,latency_ms:latency,critical:svc.critical,
          verification_level:evaluation.verification_level,
          reachability_ok:evaluation.reachability_ok,
          functional_ok:evaluation.functional_ok,
          freshness_ok:evaluation.freshness_ok
        }
      });
    }
  }
  return {
    service:svc.service_slug,ok,statusCode:status,latencyMs:latency,error,
    verificationLevel:evaluation.verification_level,
    reachabilityOk:evaluation.reachability_ok,
    functionalOk:evaluation.functional_ok,
    freshnessOk:evaluation.freshness_ok
  };
}

Deno.serve(async(req)=>{
  if(req.method==="GET")return out({ok:true,service:"hercules-ops-monitor",version:"2.0.0",contract:"reachability-functional-freshness-v1"});
  if(req.method!=="POST")return out({error:"method_not_allowed"},405);
  if(!await authorized(req))return out({error:"internal_authorization_required"},403);
  const internalKey=req.headers.get("x-hercules-internal-key")||"";
  const requestBody=await req.json().catch(()=>({}));
  const requestedAction=String(requestBody.action||"check_all");

  if(requestedAction==="check_one"){
    const slug=String(requestBody.service_slug||"");
    if(!slug)return out({error:"service_slug_required"},400);
    const {data:svc,error}=await db.from("hercules_service_registry")
      .select("service_slug,display_name,health_path,enabled,critical,metadata")
      .eq("service_slug",slug).eq("enabled",true).maybeSingle();
    if(error||!svc)return out({error:"service_not_found"},404);
    const result=await checkService(svc,internalKey);
    return out({ok:result.ok,checked:1,failed:result.ok?0:1,result},result.ok?200:503);
  }

  if(requestedAction!=="check_all")return out({error:"unsupported_action"},400);
  const {data:services,error}=await db.from("hercules_service_registry")
    .select("service_slug,display_name,health_path,enabled,critical,metadata")
    .eq("enabled",true).order("service_slug");
  if(error)return out({error:"service_registry_read_failed"},500);

  const all=services||[];
  const {data:state}=await db.from("hercules_continuity_ledger")
    .select("value").eq("key",ROTATION_KEY).maybeSingle();
  const offset=Math.max(0,Number(state?.value?.offset||0))%Math.max(1,all.length);
  const slice:any[]=[];
  for(let i=0;i<Math.min(SLICE_SIZE,all.length);i++)slice.push(all[(offset+i)%all.length]);
  const results=await Promise.all(slice.map((svc:any)=>checkService(svc,internalKey)));
  const nextOffset=all.length?((offset+slice.length)%all.length):0;

  await db.from("hercules_continuity_ledger").upsert({
    key:ROTATION_KEY,
    category:"operations",
    status:"active",
    value:{offset:nextOffset,sliceSize:SLICE_SIZE,totalServices:all.length,lastServices:slice.map((x:any)=>x.service_slug)},
    provenance:"Hercules rotating service monitor with explicit reachability, functional, and freshness evidence.",
    verified_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  },{onConflict:"key"});

  const failed=results.filter(x=>!x.ok);
  await db.from("hercules_audit_log").insert({
    organization_id:"ea5fb196-67f9-42fa-b592-49eeb3b84346",
    action:"ops.monitor.check_all",
    resource_type:"hercules_runtime",
    resource_id:"supabase-ops-monitor",
    changes:{checked:results.length,failed:failed.length,totalRegistered:all.length,rotationOffset:offset,nextOffset},
    metadata:{failures:failed,repository_write_performed:false,authorization_bypassed:false,monitor_contract:"v2"}
  });

  return out({ok:failed.length===0,checked:results.length,failed:failed.length,totalRegistered:all.length,rotationOffset:offset,nextOffset,results});
});
