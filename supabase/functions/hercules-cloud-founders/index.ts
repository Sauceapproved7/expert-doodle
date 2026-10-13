import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {withSupabase} from 'npm:@supabase/server@1';
import {
  normalizeFoundingInterest,allowedFoundingOrigin,foundingCapacityReached
} from './core.mjs';

const POLICY='https://checkout.shopify.com/100002726208/policies/53002207552.html?locale=en';
const VERSION='founding-interest-2026-10-13';
const responseHeaders=(origin:string)=>({
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':origin,
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'apikey,content-type',
  'vary':'origin',
  'x-content-type-options':'nosniff',
});
const respond=(status:number,body:Record<string,unknown>,origin:string)=>
  new Response(JSON.stringify(body),{status,headers:responseHeaders(origin)});

async function readSmallJson(req:Request){
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new TypeError('json_required');
  const reader=req.body?.getReader();
  if(!reader)throw new TypeError('body_required');
  let size=0;
  const chunks:Uint8Array[]=[];
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>2048)throw new TypeError('body_too_large');
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

const submit=withSupabase({auth:'publishable'},async(req:Request,ctx:any)=>{
  const origin=req.headers.get('origin')??'';
  if(!allowedFoundingOrigin(origin))return respond(403,{ok:false,error:'origin_not_allowed'},origin);
  if(req.method!=='POST')return respond(405,{ok:false,error:'method_not_allowed'},origin);
  let entry;
  try{entry=normalizeFoundingInterest(await readSmallJson(req))}
  catch{return respond(400,{ok:false,error:'invalid_interest_or_consent'},origin)}
  if(entry.honeypot){
    return respond(200,{ok:true,status:'interest_recorded_unverified'},origin);
  }
  // Public interest is never authenticated account creation and never billing.
  // Bound daily writes independently of client-reported metadata, then fail closed.
  const admin=ctx?.supabaseAdmin;
  if(!admin)return respond(503,{ok:false,error:'intake_unavailable'},origin);
  try{
    const dayAgo=new Date(Date.now()-24*60*60*1000).toISOString();
    const {count,error:countError}=await admin
      .from('hercules_cloud_founders')
      .select('id',{head:true,count:'exact'})
      .gte('created_at',dayAgo);
    if(countError)return respond(503,{ok:false,error:'intake_unavailable'},origin);
    if(foundingCapacityReached(count))return respond(429,{ok:false,error:'intake_temporarily_full'},origin);
    const {error}=await admin.from('hercules_cloud_founders').upsert({
      email:entry.email,
      interest:entry.interest,
      notice_version:VERSION,
      privacy_policy_url:POLICY,
      status:'unverified',
      source:'hercules-cloud-origin-preview'
    },{onConflict:'email',ignoreDuplicates:true});
    if(error)return respond(503,{ok:false,error:'intake_unavailable'},origin);
    return respond(200,{ok:true,status:'interest_recorded_unverified'},origin);
  }catch{
    return respond(503,{ok:false,error:'intake_unavailable'},origin);
  }
});
Deno.serve(async req=>{
  const origin=req.headers.get('origin')??'';
  if(!allowedFoundingOrigin(origin))
    return respond(403,{ok:false,error:'origin_not_allowed'},origin);
  if(req.method==='OPTIONS')
    return new Response(null,{status:204,headers:responseHeaders(origin)});
  return submit(req);
});
