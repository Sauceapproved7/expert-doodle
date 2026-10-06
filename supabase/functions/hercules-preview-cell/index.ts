import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const ENV='preview',PURPOSE='environment-preview',BUCKET='hercules-preview-artifacts',SITE_BUCKET='hercules-sites';
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const enc=new TextEncoder();
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
function stable(v:any):any{
 if(v===null||typeof v!=='object')return v;
 if(Array.isArray(v))return v.map(stable);
 return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
}
const fingerprint=async(v:any)=>sha(JSON.stringify(stable(v)));

async function operator(req:Request){
 const h=req.headers.get('authorization')||'';
 const token=h.startsWith('Bearer ')?h.slice(7):'';
 if(!token)return null;
 const {data,error}=await db.auth.getUser(token);
 if(error||!data.user)return null;
 const {data:m}=await db.from('hercules_memberships')
  .select('organization_id,role,status')
  .eq('organization_id',ORG).eq('user_id',data.user.id).eq('status','active')
  .in('role',['owner','admin']).maybeSingle();
 return m?{user:data.user,m}:null;
}

function videoCapable(c:any){
 if(!c||typeof c!=='object')return false;
 if(c.video===true||c.video_render===true||c.render_video===true)return true;
 if(Array.isArray(c.workloads)&&c.workloads.includes('video.render'))return true;
 if(Array.isArray(c.capabilities)&&c.capabilities.includes('video.render'))return true;
 return String(c.runtime||'').toLowerCase().includes('video')||String(c.model_family||'').toLowerCase().includes('video');
}

async function videoCapacity(){
 const cutoff=new Date(Date.now()-120000).toISOString();
 const [{data:workers},{data:adapters}]=await Promise.all([
  db.from('hercules_execution_workers')
   .select('id,worker_key,display_name,status,capabilities,last_heartbeat_at,metadata')
   .eq('organization_id',ORG).eq('status','online').gte('last_heartbeat_at',cutoff),
  db.from('hercules_execution_provider_adapters')
   .select('id,provider_key,display_name,adapter_kind,status,endpoint_ref,capabilities,metadata,last_health_at')
   .eq('organization_id',ORG).eq('status','ready')
 ]);
 const vw=(workers||[]).filter((x:any)=>videoCapable(x.capabilities));
 const va=(adapters||[]).filter((x:any)=>videoCapable(x.capabilities));
 const productionAdapters=va.filter((x:any)=>
   Boolean(x.endpoint_ref)&&
   x.metadata?.protocol==='hercules-video-v1'&&
   x.metadata?.production_capacity_certified===true
 );
 const benchmarkAdapters=va.filter((x:any)=>
   Boolean(x.endpoint_ref)&&
   x.metadata?.benchmark_only===true&&
   x.metadata?.production_capacity_certified!==true&&
   Boolean(x.metadata?.certification_fingerprint)
 );
 return {
  rendererAvailable:vw.length>0||productionAdapters.length>0,
  benchmarkRendererAvailable:benchmarkAdapters.length>0,
  workerCount:vw.length,
  adapterCount:productionAdapters.length,
  benchmarkAdapterCount:benchmarkAdapters.length,
  workers:vw.map((x:any)=>({id:x.id,key:x.worker_key,name:x.display_name,lastHeartbeatAt:x.last_heartbeat_at})),
  adapters:productionAdapters.map((x:any)=>({id:x.id,key:x.provider_key,name:x.display_name,kind:x.adapter_kind,lastHealthAt:x.last_health_at})),
  benchmarkAdapters:benchmarkAdapters.map((x:any)=>({
    id:x.id,key:x.provider_key,name:x.display_name,kind:x.adapter_kind,lastHealthAt:x.last_health_at,
    certificationFingerprint:x.metadata?.certification_fingerprint||null,
    modelRef:x.metadata?.model_ref||null
  }))
 };
}

async function createVideoRenderRequest(b:any){
 const projectId=String(b?.projectId||'').trim();
 const shot=b?.shot&&typeof b.shot==='object'?b.shot:{};
 const id=String(shot.id||'').trim();
 const prompt=String(shot.prompt||'').trim();
 const durationSeconds=Number(shot.durationSeconds);
 const aspectRatio=String(shot.aspectRatio||'').trim();
 const requiresAudio=shot.requiresAudio===true;
 const audioStrategy=String(shot.audioStrategy||(requiresAudio?'native':'none'));
 if(!projectId)throw new Error('project_id_required');
 if(!id)throw new Error('shot_id_required');
 if(!prompt)throw new Error('shot_prompt_required');
 if(!Number.isFinite(durationSeconds)||durationSeconds<=0||durationSeconds>60)throw new Error('shot_duration_invalid');
 if(!aspectRatio)throw new Error('shot_aspect_ratio_required');
 if(!['none','native','post'].includes(audioStrategy))throw new Error('shot_audio_strategy_invalid');
 if(!requiresAudio&&audioStrategy!=='none')throw new Error('shot_audio_strategy_without_audio');
 const fps=Number(b?.fps??24);
 if(!Number.isInteger(fps)||fps<=0||fps>120)throw new Error('render_fps_invalid');
 const seed=b?.seed==null?null:Number(b.seed);
 if(seed!=null&&!Number.isSafeInteger(seed))throw new Error('render_seed_invalid');
 const normalized={
  schema:'sauceapproved.hercules.video-render-request',version:1,projectId,
  shot:{id,prompt,durationSeconds,aspectRatio,requiresAudio,audioStrategy,continuityGroup:shot.continuityGroup?String(shot.continuityGroup):null},
  output:{resolution:String(b?.resolution||'720p'),fps,container:String(b?.container||'mp4')},
  references:Array.isArray(b?.references)?b.references:[],
  modelRef:b?.modelRef==null?null:String(b.modelRef),
  seed
 };
 return {...normalized,requestFingerprint:await fingerprint(normalized)};
}

async function consumeCertificationNonce(req:Request){
 const raw=req.headers.get('x-hercules-e2e-nonce')||'';
 if(!raw)return false;
 const digest=await sha(raw);
 const now=new Date().toISOString();
 const {data:row}=await db.from('hercules_forge_e2e_nonces')
  .select('id').eq('token_sha256',digest).is('used_at',null).gt('expires_at',now).maybeSingle();
 if(!row)return false;
 const {data:used,error}=await db.from('hercules_forge_e2e_nonces')
  .update({used_at:now}).eq('id',row.id).is('used_at',null).select('id').maybeSingle();
 return !error&&Boolean(used);
}

function allowedCertificationArtifact(raw:string){
 let u:URL;try{u=new URL(raw)}catch{throw new Error('certification_artifact_url_invalid')}
 if(u.protocol!=='https:')throw new Error('certification_artifact_https_required');
 if(u.hostname!=='zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space')throw new Error('certification_artifact_host_denied');
 if(!u.pathname.startsWith('/gradio_api/file='))throw new Error('certification_artifact_path_denied');
 return u.toString();
}

async function certifyPublicVideoArtifact(b:any){
 const artifactUrl=allowedCertificationArtifact(String(b?.artifactUrl||''));
 const request=await createVideoRenderRequest(b?.request||{});
 const response=await fetch(artifactUrl,{headers:{accept:'video/mp4'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('certification_artifact_fetch_failed:'+response.status);
 const ab=await response.arrayBuffer();
 const bytes=new Uint8Array(ab);
 if(bytes.byteLength<=0)throw new Error('certification_artifact_empty');
 if(bytes.byteLength>25*1024*1024)throw new Error('certification_artifact_too_large');
 const signature=String.fromCharCode(...bytes.slice(4,8));
 if(signature!=='ftyp')throw new Error('certification_artifact_not_mp4');
 const contentType=String(response.headers.get('content-type')||'video/mp4').split(';')[0].trim().toLowerCase();
 if(contentType&&!contentType.startsWith('video/')&&contentType!=='application/octet-stream')throw new Error('certification_artifact_not_video');
 const digest=hex(await crypto.subtle.digest('SHA-256',ab));
 const storagePath='video-certifications/'+request.requestFingerprint+'/'+digest+'.mp4';
 const {error:uploadError}=await db.storage.from(BUCKET).upload(storagePath,bytes,{contentType:'video/mp4',upsert:true});
 if(uploadError)throw new Error('certification_artifact_persist_failed:'+uploadError.message);
 const checkedAt=new Date().toISOString();
 const base={
  schema:'sauceapproved.hercules.video-renderer-certification',
  version:1,
  certified:true,
  adapter:{
   id:'hf-public-zerogpu-fast-wan22-i2v',
   label:'Public ZeroGPU Fast Wan2.2 I2V',
   kind:'external-renderer',
   provider:'huggingface',
   runtime:'zerogpu-public',
   protocol:'gradio-call-v1'
  },
  requestFingerprint:request.requestFingerprint,
  request,
  artifact:{
   sourceUrl:artifactUrl,
   storageBucket:BUCKET,
   storagePath,
   mimeType:'video/mp4',
   sizeBytes:bytes.byteLength,
   sha256:digest,
   providerEvidence:{
    requestFingerprint:request.requestFingerprint,
    modelRef:request.modelRef,
    seed:request.seed,
    eventId:String(b?.eventId||'')||null
   }
  },
  inspect:{ok:true,status:response.status,contentType,sizeBytes:bytes.byteLength,mp4Signature:true},
  benchmarkOnly:true,
  productionCapacityCertified:false,
  authorizationBypassed:false,
  fabricatedOutput:false,
  checkedAt
 };
 const certificationFingerprint=await fingerprint(base);
 const proof={...base,certificationFingerprint};
 const {error:ledgerError}=await db.from('hercules_continuity_ledger').upsert({
   key:'hercules_video_public_zerogpu_fast_certification',
   category:'benchmark',
   status:'verified',
   value:proof,
   provenance:'One-time nonce verified public ZeroGPU synthetic MP4 certification; artifact persisted to Hercules Storage',
   verified_at:checkedAt,
   updated_at:checkedAt
 },{onConflict:'key'});
 if(ledgerError)throw new Error('certification_ledger_write_failed:'+ledgerError.message);
 return proof;
}


function benchmarkImageReference(request:any){
 const refs=Array.isArray(request?.references)?request.references:[];
 const ref=refs.find((x:any)=>x&&x.kind==='image'&&String(x.uri||'').startsWith('https://'));
 if(!ref)throw new Error('benchmark_image_reference_required');
 let u:URL;try{u=new URL(String(ref.uri))}catch{throw new Error('benchmark_image_reference_invalid')}
 const allowed=u.hostname==='raw.githubusercontent.com'||u.hostname==='xbwuablxhhwsaoomsoco.supabase.co';
 if(!allowed)throw new Error('benchmark_image_reference_host_denied');
 const name=(u.pathname.split('/').filter(Boolean).pop()||'input.png').slice(0,120);
 return {uri:u.toString(),name};
}

function parseGradioComplete(text:string){
 const lines=String(text||'').split(/\r?\n/);
 let event='message';
 for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(line.startsWith('event:')){event=line.slice(6).trim();continue}
   if(line.startsWith('data:')){
     const data=line.slice(5).trim();
     if(event==='error')throw new Error('benchmark_provider_error:'+data.slice(0,500));
     if(event==='complete'){
       let parsed:any;try{parsed=JSON.parse(data)}catch{throw new Error('benchmark_provider_complete_invalid')}
       return parsed;
     }
   }
 }
 throw new Error('benchmark_provider_no_complete_event');
}

async function persistBenchmarkArtifact(artifactUrl:string,request:any,jobId:string,eventId:string,providerSeed:any){
 const url=allowedCertificationArtifact(artifactUrl);
 const response=await fetch(url,{headers:{accept:'video/mp4'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('benchmark_artifact_fetch_failed:'+response.status);
 const ab=await response.arrayBuffer();
 const bytes=new Uint8Array(ab);
 if(bytes.byteLength<=0)throw new Error('benchmark_artifact_empty');
 if(bytes.byteLength>25*1024*1024)throw new Error('benchmark_artifact_too_large');
 if(String.fromCharCode(...bytes.slice(4,8))!=='ftyp')throw new Error('benchmark_artifact_not_mp4');
 const digest=hex(await crypto.subtle.digest('SHA-256',ab));
 const storagePath='video-renders/benchmark/'+jobId+'/'+digest+'.mp4';
 const {error:uploadError}=await db.storage.from(BUCKET).upload(storagePath,bytes,{contentType:'video/mp4',upsert:true});
 if(uploadError)throw new Error('benchmark_artifact_persist_failed:'+uploadError.message);
 return {
   uri:'hercules-storage://'+BUCKET+'/'+storagePath,
   sourceUrl:url,
   storageBucket:BUCKET,
   storagePath,
   mimeType:'video/mp4',
   sizeBytes:bytes.byteLength,
   sha256:digest,
   providerEvidence:{
     requestFingerprint:request.requestFingerprint,
     modelRef:request.modelRef,
     seed:Number(providerSeed),
     eventId
   }
 };
}

async function runBenchmarkRender(actor:any,request:any){
 if(request.shot.durationSeconds>0.5)throw new Error('benchmark_duration_limit');
 if(request.output.fps!==16)throw new Error('benchmark_fps_must_be_16');
 if(request.output.resolution!=='480p')throw new Error('benchmark_resolution_must_be_480p');
 if(request.seed==null)throw new Error('benchmark_seed_required');
 const image=benchmarkImageReference(request);
 const {data:adapter,error:adapterError}=await db.from('hercules_execution_provider_adapters')
   .select('id,provider_key,display_name,status,endpoint_ref,capabilities,metadata')
   .eq('organization_id',ORG)
   .eq('provider_key','hf-public-zerogpu-fast-wan22-i2v')
   .eq('status','ready')
   .maybeSingle();
 if(adapterError||!adapter)throw new Error('benchmark_adapter_unavailable');
 if(adapter.metadata?.benchmark_only!==true||!adapter.metadata?.certification_fingerprint)throw new Error('benchmark_adapter_not_certified');
 if(adapter.metadata?.production_capacity_certified===true)throw new Error('benchmark_adapter_classification_invalid');

 const idem='video-benchmark:'+request.requestFingerprint;
 const {data:existing}=await db.from('hercules_execution_jobs')
   .select('id,status,output,error,trace_id,created_at,completed_at')
   .eq('organization_id',ORG).eq('idempotency_key',idem).maybeSingle();
 if(existing?.status==='succeeded')return {reused:true,job:existing};

 const traceId='video-benchmark-'+crypto.randomUUID();
 let jobId=existing?.id||null;
 if(!jobId){
   const {data:job,error:jobError}=await db.from('hercules_execution_jobs').insert({
     organization_id:ORG,
     created_by:actor.user.id,
     workload_type:'video.render',
     status:'running',
     sandbox_provider:'huggingface-zerogpu',
     attempt:1,
     max_attempts:1,
     started_at:new Date().toISOString(),
     input:{request,mode:'benchmark',adapter_key:adapter.provider_key},
     policy:{network:'explicit_allowlist',filesystem:'ephemeral',secrets:'none',timeout_seconds:120},
     idempotency_key:idem,
     capability_envelope:{video:true,benchmark_only:true,production_capacity_certified:false},
     execution_class:'benchmark',
     provider_adapter_id:adapter.id,
     trace_id:traceId
   }).select('id').single();
   if(jobError||!job)throw new Error('benchmark_job_create_failed:'+(jobError?.message||'unknown'));
   jobId=job.id;
 }else{
   await db.from('hercules_execution_jobs').update({
     status:'running',attempt:1,started_at:new Date().toISOString(),completed_at:null,error:null,
     input:{request,mode:'benchmark',adapter_key:adapter.provider_key},
     provider_adapter_id:adapter.id,trace_id:traceId,updated_at:new Date().toISOString()
   }).eq('id',jobId);
 }

 try{
   const submit=await fetch(String(adapter.endpoint_ref),{
     method:'POST',
     headers:{'content-type':'application/json','accept':'application/json'},
     body:JSON.stringify({data:[
       {path:image.uri,url:image.uri,orig_name:image.name,meta:{_type:'gradio.FileData'}},
       request.shot.prompt,
       1,
       '',
       0.5,
       1.0,
       1.0,
       request.seed,
       false
     ]}),
     signal:AbortSignal.timeout(15000)
   });
   const submitted=await submit.json().catch(()=>({}));
   const eventId=String(submitted?.event_id||'');
   if(!submit.ok||!eventId)throw new Error('benchmark_submit_failed:'+submit.status);

   const resultResponse=await fetch(String(adapter.endpoint_ref)+'/'+encodeURIComponent(eventId),{
     headers:{accept:'text/event-stream'},
     signal:AbortSignal.timeout(100000)
   });
   const sse=await resultResponse.text();
   if(!resultResponse.ok)throw new Error('benchmark_result_failed:'+resultResponse.status);
   const outputs=parseGradioComplete(sse);
   const file=Array.isArray(outputs)?outputs[0]:null;
   const providerSeed=Array.isArray(outputs)?outputs[1]:request.seed;
   const artifactUrl=String(file?.url||file?.path||'');
   if(!artifactUrl)throw new Error('benchmark_artifact_url_missing');
   const artifact=await persistBenchmarkArtifact(artifactUrl,request,String(jobId),eventId,providerSeed);

   const output={
     schema:'sauceapproved.hercules.video-benchmark-render-output',
     version:1,
     jobId,
     traceId,
     requestFingerprint:request.requestFingerprint,
     certificationFingerprint:adapter.metadata.certification_fingerprint,
     benchmarkOnly:true,
     productionCapacityCertified:false,
     artifact,
     completedAt:new Date().toISOString()
   };
   await db.from('hercules_execution_jobs').update({
     status:'succeeded',output,error:null,completed_at:output.completedAt,updated_at:output.completedAt
   }).eq('id',jobId);
   await db.from('hercules_audit_log').insert({
     organization_id:ORG,actor_user_id:actor.user.id,action:'video.render.benchmark.completed',
     resource_type:'hercules_execution_job',resource_id:String(jobId),
     changes:{request_fingerprint:request.requestFingerprint,artifact_sha256:artifact.sha256,provider_key:adapter.provider_key},
     metadata:{trace_id:traceId,benchmark_only:true,production_capacity_certified:false,authorization_bypassed:false,fabricated_output:false}
   });
   return {reused:false,job:{id:jobId,status:'succeeded',output,trace_id:traceId,completed_at:output.completedAt}};
 }catch(e){
   const message=e instanceof Error?e.message:'benchmark_render_failed';
   const failedAt=new Date().toISOString();
   await db.from('hercules_execution_jobs').update({
     status:'failed',error:{code:'benchmark_render_failed',message,retryable:true},
     completed_at:failedAt,updated_at:failedAt
   }).eq('id',jobId);
   await db.from('hercules_audit_log').insert({
     organization_id:ORG,actor_user_id:actor.user.id,action:'video.render.benchmark.failed',
     resource_type:'hercules_execution_job',resource_id:String(jobId),
     changes:{request_fingerprint:request.requestFingerprint,error:message},
     metadata:{trace_id:traceId,benchmark_only:true,production_capacity_certified:false,authorization_bypassed:false,fabricated_output:false}
   });
   throw e;
 }
}

async function videoHealth(){
 const capacity=await videoCapacity();
 return {
  ok:true,
  service:'hercules-video-bridge',
  engine:'hercules-video',
  version:'1.0.0',
  orchestrationConnected:true,
  renderCapacityAvailable:capacity.rendererAvailable,
  benchmarkRenderAvailable:capacity.benchmarkRendererAvailable,
  executionPolicy:'fail-closed',
  canonicalRequestSchema:'sauceapproved.hercules.video-render-request',
  studioSurface:'SauceApproved Studio',
  workerCount:capacity.workerCount,
  adapterCount:capacity.adapterCount,
  benchmarkAdapterCount:capacity.benchmarkAdapterCount,
  blockingReason:capacity.rendererAvailable?null:(capacity.benchmarkRendererAvailable?'production_renderer_not_certified':'no_certified_video_renderer_online'),
  checkedAt:new Date().toISOString()
 };
}

function studioRuntimeInjection(){
 return `<section id="hercules-video-runtime" style="margin:16px 0;padding:14px 16px;border:1px solid #292929;border-radius:16px;background:#0d0d0d;color:#ddd;font:500 13px/1.5 Inter,system-ui,sans-serif">
 <strong style="display:block;color:#fff;margin-bottom:4px">Hercules Video Runtime</strong>
 <span id="hercules-video-runtime-state">Checking owned runtime…</span>
 </section>
 <script>
 (()=>{const el=document.getElementById('hercules-video-runtime-state');fetch(location.origin+'/functions/v1/hercules-preview-cell/video/health',{cache:'no-store'}).then(r=>r.json()).then(x=>{
  if(!el)return;
  el.textContent=x.renderCapacityAvailable
    ?'Bridge connected · production renderer certified'
    :(x.benchmarkRenderAvailable
      ?'Bridge connected · certified benchmark renderer online · production capacity unavailable'
      :'Bridge connected · render capacity unavailable · fail-closed');
  el.dataset.ready=String(Boolean(x.renderCapacityAvailable));
  el.dataset.benchmarkReady=String(Boolean(x.benchmarkRenderAvailable));
 }).catch(()=>{if(el)el.textContent='Hercules Video status unavailable · execution locked';});})();
 </script>`;
}

async function authorized(req:Request){
 const key=req.headers.get('x-hercules-cell-key')||'';
 if(!key)return false;
 const digest=await sha(key);
 const {data}=await db.from('hercules_internal_service_keys').select('key_sha256,enabled').eq('purpose',PURPOSE).eq('enabled',true).maybeSingle();
 return Boolean(data?.enabled&&data.key_sha256===digest);
}


function siteHeaders(){
 return {
  'content-type':'text/html; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https://xbwuablxhhwsaoomsoco.supabase.co; media-src 'self' data: blob: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
 };
}

async function serveSite(slug:string){
 if(!/^preview-[a-z0-9][a-z0-9-]{1,62}$/.test(slug))return out({error:'invalid_preview_slug'},400);
 let {data:dep,error}=await db.from('hercules_deployments')
   .select('slug,version,metadata')
   .eq('organization_id',ORG).eq('slug',slug)
   .contains('metadata',{forge_quality_accepted:true})
   .order('version',{ascending:false}).limit(1).maybeSingle();
 if(error)return out({error:'deployment_lookup_failed'},500);
 if(!dep){
   const fallback=await db.from('hercules_deployments')
     .select('slug,version,metadata')
     .eq('organization_id',ORG).eq('slug',slug)
     .order('version',{ascending:false}).limit(1).maybeSingle();
   if(fallback.error)return out({error:'deployment_lookup_failed'},500);
   dep=fallback.data;
 }
 if(!dep)return out({error:'preview_not_found'},404);
 if(dep.metadata?.preview!==true||dep.metadata?.owned_deployment!==true)return out({error:'preview_not_eligible'},403);
 const manifest=Array.isArray(dep.metadata?.file_manifest)?dep.metadata.file_manifest:[];
 const entry=manifest.find((x:any)=>String(x.path||'')==='index.html');
 const livePath=String(entry?.live_path||'');
 if(!livePath)return out({error:'preview_entry_missing'},409);
 const {data:file,error:fe}=await db.storage.from(SITE_BUCKET).download(livePath);
 if(fe||!file)return out({error:'preview_artifact_unavailable'},502);
 let html=await file.text();
 if(!/<html[\s>]/i.test(html))return out({error:'preview_html_invalid'},502);
 if(slug==='preview-sauceapproved-studio-global-20260928'){
   const injection=studioRuntimeInjection();
   html=html.includes('</body>')?html.replace('</body>',injection+'</body>'):html+injection;
 }
 return new Response(html,{status:200,headers:siteHeaders()});
}

async function selftest(){
 const [{data:cell},{data:bucket},runtime]=await Promise.all([
   db.from('hercules_environment_cells').select('*').eq('organization_id',ORG).eq('environment',ENV).maybeSingle(),
   db.storage.getBucket(BUCKET),
   fetch(U+'/functions/v1/hercules-worker-runtime/selftest',{headers:{'cache-control':'no-cache','authorization':'Bearer '+S,'apikey':S},signal:AbortSignal.timeout(10000)}).then(async r=>({status:r.status,body:await r.json().catch(()=>({}))})).catch(e=>({status:0,body:{error:e instanceof Error?e.message:'runtime_unavailable'}}))
 ]);
 const checks={
   environmentIdentity:cell?.environment===ENV,
   cellActive:cell?.status==='active',
   runtimeAdapter:cell?.runtime_adapter==='edge-safe',
   networkDenyByDefault:cell?.network_policy==='deny_by_default',
   filesystemEphemeral:cell?.filesystem_policy==='ephemeral',
   secretsExplicitAllowlist:cell?.secrets_policy==='explicit_allowlist',
   privateArtifactBucket:bucket?.id===BUCKET&&bucket?.public===false,
   productionDataAccessDenied:cell?.metadata?.production_data_access===false,
   workerRuntimeSelftest:runtime.status===200&&runtime.body?.ok===true
 };
 return {ok:Object.values(checks).every(Boolean),checks,runtime:{status:runtime.status,selftestOk:runtime.body?.ok===true}};
}

Deno.serve(async(req:Request)=>{
 const url=new URL(req.url);
 const relative=url.pathname.split('/hercules-preview-cell')[1]||'/';

 if(req.method==='GET'&&relative==='/video/health')return out(await videoHealth());
 if(req.method==='GET'&&relative==='/video/capabilities'){
   const capacity=await videoCapacity();
   return out({ok:true,engine:'hercules-video',executionPolicy:'fail-closed',capacity,requestSchema:'sauceapproved.hercules.video-render-request'});
 }
 if(req.method==='GET'&&relative.startsWith('/video/jobs/')){
   const a=await operator(req);if(!a)return out({error:'owner_or_admin_required'},401);
   const id=relative.slice('/video/jobs/'.length);
   const {data,error}=await db.from('hercules_execution_jobs')
     .select('id,workload_type,status,attempt,max_attempts,output,error,created_at,started_at,completed_at,trace_id,capability_envelope')
     .eq('organization_id',ORG).eq('id',id).eq('workload_type','video.render').maybeSingle();
   if(error)return out({error:'video_job_lookup_failed'},500);
   if(!data)return out({error:'video_job_not_found'},404);
   return out({ok:true,job:data});
 }

 if(req.method==='POST'&&relative==='/video/certify-public-artifact'){
   if(!await consumeCertificationNonce(req))return out({error:'one_time_certification_authorization_required'},403);
   const b=await req.json().catch(()=>({}));
   try{
     const proof=await certifyPublicVideoArtifact(b);
     return out({ok:true,proof},201);
   }catch(e){
     return out({ok:false,error:'video_renderer_certification_failed',detail:e instanceof Error?e.message:'unknown'},502);
   }
 }
 if(req.method==='POST'&&relative==='/video/render'){
   const a=await operator(req);if(!a)return out({error:'owner_or_admin_required'},401);
   const b=await req.json().catch(()=>({}));
   let request:any;try{request=await createVideoRenderRequest(b)}catch(e){return out({error:e instanceof Error?e.message:'video_request_invalid'},400)}
   const mode=b?.mode??'production';
   if(mode!=='benchmark'&&mode!=='production')return out({ok:false,error:'video_mode_invalid',queued:false},400);
   const capacity=await videoCapacity();
   if(mode==='benchmark'){
     if(!capacity.benchmarkRendererAvailable)return out({ok:false,error:'benchmark_adapter_unavailable',queued:false},503);
     try{
       const result=await runBenchmarkRender(a,request);
       return out({ok:true,...result,benchmarkOnly:true,productionCapacityCertified:false});
     }catch(e){
       const code=e instanceof Error?e.message:'';
       const invalid=new Set(['benchmark_duration_limit','benchmark_fps_must_be_16','benchmark_resolution_must_be_480p','benchmark_seed_required','benchmark_image_reference_required','benchmark_image_reference_invalid','benchmark_image_reference_host_denied']);
       return out({ok:false,error:invalid.has(code)?code:'benchmark_render_failed',queued:false},invalid.has(code)?400:502);
     }
   }
   if(!capacity.rendererAvailable){
     await db.from('hercules_audit_log').insert({
       organization_id:ORG,actor_user_id:a.user.id,action:'video.render.blocked',
       resource_type:'hercules_video_render',resource_id:request.requestFingerprint,
       changes:{project_id:request.projectId,shot_id:request.shot.id,request_fingerprint:request.requestFingerprint,reason:'no_certified_video_renderer_online'},
       metadata:{engine:'hercules-video',execution_policy:'fail-closed',authorization_bypassed:false,fabricated_output:false}
     });
     return out({ok:false,error:'video_render_capacity_unavailable',requestFingerprint:request.requestFingerprint,blockingReason:'no_certified_production_video_renderer_online',queued:false},503);
   }
   return out({ok:false,error:'video_dispatch_adapter_not_implemented',requestFingerprint:request.requestFingerprint,queued:false},503);
 }
 if(req.method==='GET'){
   if(url.searchParams.get('health')==='1')return out({ok:true,service:'hercules-preview-cell',environment:ENV,version:'1.1.0'});
   const parts=url.pathname.split('/').filter(Boolean);
   const siteIndex=parts.lastIndexOf('site');
   if(siteIndex>=0&&parts[siteIndex+1]){
     const slug=decodeURIComponent(parts[siteIndex+1]).trim().toLowerCase();
     return await serveSite(slug);
   }
   const {data:cell}=await db.from('hercules_environment_cells').select('environment,cell_id,runtime_adapter,execution_class,network_policy,filesystem_policy,secrets_policy,artifact_bucket,status,endpoint_slug,metadata,verified_at').eq('organization_id',ORG).eq('environment',ENV).maybeSingle();
   return out({ok:true,service:'hercules-preview-cell',version:'1.1.0',cell,publicLaunchChanged:false});
 }
 if(req.method!=='POST')return out({error:'method_not_allowed'},405);
 if(!await authorized(req))return out({error:'cell_authorization_required'},403);
 const b=await req.json().catch(()=>({})),action=String(b.action||'selftest');
 if(action!=='selftest')return out({error:'unsupported_action'},400);
 const result=await selftest();
 if(result.ok)await db.from('hercules_environment_cells').update({verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('organization_id',ORG).eq('environment',ENV);
 return out({service:'hercules-preview-cell',environment:ENV,...result},result.ok?200:503);
});