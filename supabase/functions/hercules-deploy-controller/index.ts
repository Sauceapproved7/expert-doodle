import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {STUDIO_OFFER_SLUG, STUDIO_LEGACY_SHA,studioReleaseSourceCheck,guardedStudioPresentationWrite} from './studio-offer-release-guard.mjs';

const U=Deno.env.get('SUPABASE_URL')!;
const A=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')||'';
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const BUCKET='hercules-deployments';
const PRESENTATION_BUCKET='hercules-sites';
const PRESENTATION_ORIGIN='https://sauceapproved-forge-host.onrender.com';
const PRESENTATION_ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const SELF=U+'/functions/v1/hercules-deploy-controller';
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const enc=new TextEncoder();
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));

function esc(v:string){return v.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!))}
function safeSlug(v:string){return /^[a-z0-9][a-z0-9-]{1,62}$/.test(v)}
function secretLike(s:string){
  return /(github_pat_|gh[pousr]_|sk-[A-Za-z0-9_-]{20,}|sb_secret_|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i.test(s);
}
function htmlHeaders(){
  return {
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer',
    'x-frame-options':'DENY',
    'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  };
}
function buildReceiptHtml(run:any,deploymentId:string){
  const source=run?.source_snapshot||{};
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Deployment</title><style>body{font-family:system-ui;background:#090909;color:#f5f5f5;margin:0;padding:32px}.c{max-width:760px;margin:auto}.k{color:#aaa}code{word-break:break-all}</style></head><body><main class="c"><h1>Hercules Deployment</h1><p>Build <code>'+esc(String(run?.run_id||''))+'</code> passed and was deployed by the Hercules backend.</p><p class="k">Deployment</p><code>'+esc(deploymentId)+'</code><p class="k">Goal</p><p>'+esc(String(run?.goal||''))+'</p><p class="k">Source package</p><p>'+esc(String(source.package_name||''))+'</p><p class="k">Logical source head</p><code>'+esc(String(source.logical_head_sha256||''))+'</code><p class="k">Operator mode: conversation only · Manual steps: none</p></main></body></html>';
}

async function actor(req:Request){
  const h=req.headers.get('authorization')||'',t=h.startsWith('Bearer ')?h.slice(7):'';
  if(!t)return null;
  const auth=createClient(U,A,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+t}}});
  const {data,error}=await auth.auth.getUser(t); if(error||!data.user)return null;
  const {data:m}=await auth.from('hercules_memberships').select('organization_id,role,status')
    .eq('user_id',data.user.id).eq('status','active').in('role',['owner','admin']).limit(1).maybeSingle();
  return m?{user:data.user,m}:null;
}
async function internal(req:Request){
  const key=req.headers.get('x-hercules-internal-key')||''; if(!key)return false;
  const digest=await sha(key);
  const {data}=await db.from('hercules_internal_service_keys').select('key_sha256,enabled')
    .eq('purpose','deploy-controller').eq('enabled',true).maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===digest);
}
async function ensureBucket(){
  const {data}=await db.storage.listBuckets();
  if(!data?.some((b:any)=>b.name===BUCKET)){
    const {error}=await db.storage.createBucket(BUCKET,{public:true,fileSizeLimit:1024*1024,allowedMimeTypes:['text/html','application/json']});
    if(error)throw new Error('deployment_bucket_create_failed');
  }
}
async function put(path:string,content:string,type:string){
  if(enc.encode(content).byteLength>512*1024)throw new Error('artifact_too_large');
  if(secretLike(content))throw new Error('artifact_secret_scan_failed');
  const {error}=await db.storage.from(BUCKET).upload(path,enc.encode(content),{
    upsert:true,contentType:type,cacheControl:'60'
  });
  if(error)throw new Error('artifact_upload_failed:'+error.message);
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
async function putPresentation(slug:string,html:string){
  const path=PRESENTATION_ORG+'/'+slug+'/index.html';
  const {error}=await db.storage.from(PRESENTATION_BUCKET).upload(path,enc.encode(html),{
    upsert:true,contentType:'text/html; charset=utf-8',cacheControl:'60'
  });
  if(error)throw new Error('presentation_publish_failed:'+error.message);
  return {path,url:PRESENTATION_ORIGIN+'/'+encodeURIComponent(slug)+'/'};
}
async function verifyUrl(url:string){
  const r=await fetch(url,{method:'GET',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(8000)});
  const contentType=r.headers.get('content-type')||'';
  const body=await r.text();
  const bodySha256=await sha(body);
  const ok=r.status===200 && contentType.toLowerCase().includes('text/html') && body.startsWith('<!doctype html>') && body.length>0;
  return {ok,status:r.status,contentType,contentLength:enc.encode(body).byteLength,bodySha256,checkedAt:new Date().toISOString()};
}
async function serveBuildReceipt(url:URL){
  const runId=String(url.searchParams.get('run_id')||'');
  if(!/^backend-build-[0-9a-f-]{36}$/i.test(runId)) return new Response('Not found',{status:404,headers:htmlHeaders()});
  const deploymentId=String(url.searchParams.get('deployment_id')||'');
  const {data:run}=await db.from('hercules_backend_build_runs').select('*').eq('run_id',runId).maybeSingle();
  if(!run||run.status!=='succeeded') return new Response('Not found',{status:404,headers:htmlHeaders()});
  let q=db.from('hercules_deployment_runs').select('deployment_id,status,created_at').eq('build_run_id',runId);
  if(deploymentId) q=q.eq('deployment_id',deploymentId);
  const {data:rows}=await q.order('created_at',{ascending:false}).limit(1);
  const d=rows?.[0];
  if(!d) return new Response('Not found',{status:404,headers:htmlHeaders()});
  return new Response(buildReceiptHtml(run,String(d.deployment_id)),{status:200,headers:htmlHeaders()});
}
async function serveStatic(url:URL){
  const deploymentId=String(url.searchParams.get('deployment_id')||'');
  if(!/^deploy-[0-9a-f-]{36}$/i.test(deploymentId)) return new Response('Not found',{status:404,headers:htmlHeaders()});
  const {data:d}=await db.from('hercules_deployment_runs').select('*').eq('deployment_id',deploymentId).maybeSingle();
  const path=String(d?.deployment_manifest?.stablePath||'');
  if(!d||!path) return new Response('Not found',{status:404,headers:htmlHeaders()});
  const {data,error}=await db.storage.from(BUCKET).download(path);
  if(error||!data) return new Response('Not found',{status:404,headers:htmlHeaders()});
  const html=await data.text();
  if(secretLike(html)) return new Response('Artifact rejected',{status:500,headers:htmlHeaders()});
  return new Response(html,{status:200,headers:htmlHeaders()});
}

async function verifyReleaseApi(deploymentId:string){
  const url=U+'/functions/v1/hercules-release-status?deployment_id='+encodeURIComponent(deploymentId);
  const r=await fetch(url,{method:'GET',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(8000)});
  const contentType=r.headers.get('content-type')||'';
  const text=await r.text();
  let body:any=null;
  try{body=JSON.parse(text)}catch{}
  const bodySha256=await sha(text);
  const ok=r.status===200 &&
    contentType.toLowerCase().includes('application/json') &&
    body?.ok===true &&
    body?.deployment?.deployment_id===deploymentId;
  return {
    ok,status:r.status,contentType,
    contentLength:enc.encode(text).byteLength,
    bodySha256,
    service:body?.service||null,
    observedDeploymentId:body?.deployment?.deployment_id||null,
    observedBuildRunId:body?.deployment?.build_run_id||null,
    checkedAt:new Date().toISOString(),
    url
  };
}

Deno.serve(async(req:Request)=>{
  const url=new URL(req.url);

  if(req.method==='GET'){
    const view=String(url.searchParams.get('view')||'');
    if(view==='build') return await serveBuildReceipt(url);
    if(view==='static') return await serveStatic(url);
    return out({
      ok:true,service:'hercules-deploy-controller',version:'1.10.0',
      policy:'deployment-required',operatorInteraction:'conversation_only',
      providers:[
        {provider:'supabase',target:'edge-served-receipt',automatic:true},
        {provider:'supabase',target:'storage-archive',automatic:true},
        {provider:'supabase',target:'edge-functions',assistantManaged:true}
      ],
      manualOperatorStepsAllowed:false
    });
  }

  if(req.method!=='POST')return out({error:'method_not_allowed'},405);

  const internalOk=await internal(req);
  const a=internalOk?null:await actor(req);
  if(!internalOk&&!a)return out({error:'owner_admin_or_internal_required'},403);

  const b=await req.json().catch(()=>({}));
  const action=String(b.action||'status');
  const org=String(a?.m.organization_id||'ea5fb196-67f9-42fa-b592-49eeb3b84346');
  const uid=a?.user?.id||null;

  const {data:policy}=await db.from('hercules_build_policy').select('*').eq('organization_id',org).maybeSingle();
  if(!policy?.deployment_required||policy?.manual_operator_steps_allowed)return out({error:'deployment_policy_invalid'},409);

  if(action==='status'){
    const {data:runs}=await db.from('hercules_deployment_runs').select('*').eq('organization_id',org).order('created_at',{ascending:false}).limit(20);
    return out({ok:true,policy,recentDeployments:runs||[]});
  }

  if(action==='verify_deployment'){
    const deploymentId=String(b.deployment_id||'');
    const {data:d}=await db.from('hercules_deployment_runs').select('*')
      .eq('organization_id',org).eq('deployment_id',deploymentId).maybeSingle();
    if(!d)return out({error:'deployment_not_found'},404);
    const stableUrl=String(d?.result?.stableUrl||'');
    if(!stableUrl)return out({error:'stable_url_missing'},409);
    await db.from('hercules_deployment_runs').update({verification_status:'verifying',updated_at:new Date().toISOString()}).eq('id',d.id);
    try{
      const verification=await verifyUrl(stableUrl);
      if(!verification.ok) throw new Error('deployment_verification_failed');
      const now=new Date().toISOString();
      await db.from('hercules_deployment_runs').update({
        verification_status:'verified',verification,verified_at:now,updated_at:now
      }).eq('id',d.id);
      if(d.build_run_id){
        await db.from('hercules_backend_build_runs').update({
          release_status:'verified',release_verified_at:now,updated_at:now
        }).eq('organization_id',org).eq('run_id',d.build_run_id);
      }
      return out({ok:true,deploymentId,verification,releaseComplete:true});
    }catch(e){
      const message=e instanceof Error?e.message:'verification_failed';
      await db.from('hercules_deployment_runs').update({
        verification_status:'failed',verification:{ok:false,error:message,checkedAt:new Date().toISOString()},updated_at:new Date().toISOString()
      }).eq('id',d.id);
      if(d.build_run_id){
        await db.from('hercules_backend_build_runs').update({release_status:'failed',updated_at:new Date().toISOString()})
          .eq('organization_id',org).eq('run_id',d.build_run_id);
      }
      return out({error:'verification_failed',detail:message},502);
    }
  }

  await ensureBucket();

  if(action==='deploy_build_api_receipt'){
    const runId=String(b.build_run_id||'');
    if(!/^backend-build-[0-9a-f-]{36}$/i.test(runId))return out({error:'valid_build_run_id_required'},400);
    const {data:run}=await db.from('hercules_backend_build_runs').select('*')
      .eq('organization_id',org).eq('run_id',runId).maybeSingle();
    if(!run)return out({error:'build_run_not_found'},404);
    if(run.status!=='succeeded')return out({error:'build_not_succeeded',status:run.status},409);

    const {data:already}=await db.from('hercules_deployment_runs')
      .select('*').eq('organization_id',org).eq('build_run_id',runId)
      .eq('target','edge-api').eq('verification_status','verified')
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(already){
      await db.from('hercules_backend_build_runs').update({
        deployment_status:'deployed',deployment_id:already.deployment_id,
        deployment_provider:'supabase',deployment_target:'edge-api',
        deployment_artifact_kind:'build-release-api',
        release_status:'verified',release_verified_at:already.verified_at||new Date().toISOString(),
        updated_at:new Date().toISOString()
      }).eq('id',run.id);
      return out({ok:true,alreadyDeployed:true,deployment:already});
    }

    const deploymentId='deploy-'+crypto.randomUUID();
    const publicUrl=U+'/functions/v1/hercules-release-status?deployment_id='+encodeURIComponent(deploymentId);
    const now=new Date().toISOString();

    await db.from('hercules_deployment_runs').insert({
      organization_id:org,deployment_id:deploymentId,build_run_id:runId,
      provider:'supabase',target:'edge-api',artifact_kind:'build-release-api',
      source_logical_head_sha256:run?.source_snapshot?.logical_head_sha256||null,
      status:'deployed',verification_status:'verifying',
      deployment_manifest:{service:'hercules-release-status',autoDeploy:true,publicUrl},
      result:{publicUrl,provider:'supabase',target:'edge-api'},
      created_by:uid,deployed_at:now
    });

    try{
      const verification=await verifyReleaseApi(deploymentId);
      if(!verification.ok) throw new Error('release_api_verification_failed');
      const verifiedAt=new Date().toISOString();
      await db.from('hercules_deployment_runs').update({
        verification_status:'verified',verification,verified_at:verifiedAt,updated_at:verifiedAt
      }).eq('deployment_id',deploymentId);
      await db.from('hercules_backend_build_runs').update({
        deployment_status:'deployed',deployment_id:deploymentId,
        deployment_provider:'supabase',deployment_target:'edge-api',
        deployment_artifact_kind:'build-release-api',
        release_status:'verified',release_verified_at:verifiedAt,updated_at:verifiedAt
      }).eq('id',run.id);
      await db.from('hercules_audit_log').insert({
        organization_id:org,actor_user_id:uid,action:'deployment.verified',
        resource_type:'hercules_deployment',resource_id:deploymentId,
        changes:{build_run_id:runId,provider:'supabase',target:'edge-api',public_url:publicUrl,verification},
        metadata:{manual_operator_steps:false,release_verified:true,repository_write_performed:false}
      });
      return out({ok:true,deploymentId,buildRunId:runId,publicUrl,verification,releaseComplete:true,manualOperatorSteps:false},201);
    }catch(e){
      const message=e instanceof Error?e.message:'release_api_verification_failed';
      await db.from('hercules_deployment_runs').update({
        status:'failed',verification_status:'failed',
        verification:{ok:false,error:message,checkedAt:new Date().toISOString()},
        error:{message},updated_at:new Date().toISOString()
      }).eq('deployment_id',deploymentId);
      await db.from('hercules_backend_build_runs').update({
        deployment_status:'failed',deployment_id:deploymentId,
        release_status:'failed',updated_at:new Date().toISOString()
      }).eq('id',run.id);
      return out({error:'release_api_deployment_failed',detail:message},502);
    }
  }

  if(action==='deploy_build_receipt'){
    const runId=String(b.build_run_id||'');
    if(!/^backend-build-[0-9a-f-]{36}$/i.test(runId))return out({error:'valid_build_run_id_required'},400);
    const {data:run}=await db.from('hercules_backend_build_runs').select('*').eq('organization_id',org).eq('run_id',runId).maybeSingle();
    if(!run)return out({error:'build_run_not_found'},404);
    if(run.status!=='succeeded')return out({error:'build_not_succeeded',status:run.status},409);
    if(!run.deployment_required)return out({error:'deployment_not_required_for_build'},409);
    if(run.deployment_status==='deployed'&&run.deployment_id){
      const {data:existing}=await db.from('hercules_deployment_runs').select('*').eq('deployment_id',run.deployment_id).maybeSingle();
      return out({ok:true,alreadyDeployed:true,deployment:existing});
    }
    if(run.deployment_status==='deploying')return out({ok:true,alreadyDeploying:true,buildRunId:runId},202);

    const {data:claimed}=await db.from('hercules_backend_build_runs')
      .update({deployment_status:'deploying',updated_at:new Date().toISOString()})
      .eq('id',run.id).in('deployment_status',['pending','failed'])
      .select('id').maybeSingle();
    if(!claimed)return out({error:'deployment_claim_race'},409);

    const deploymentId='deploy-'+crypto.randomUUID();
    const html=buildReceiptHtml(run,deploymentId);
    const releasePath='builds/'+runId+'/'+deploymentId+'/index.html';
    const stablePath='builds/'+runId+'/current/index.html';

    await db.from('hercules_deployment_runs').insert({
      organization_id:org,deployment_id:deploymentId,build_run_id:runId,provider:'supabase',
      target:'edge-served-receipt',artifact_kind:'build-receipt',
      source_logical_head_sha256:run?.source_snapshot?.logical_head_sha256||null,
      status:'deploying',deployment_manifest:{releasePath,stablePath,autoDeploy:true,archiveProvider:'supabase-storage'},created_by:uid
    });

    try{
      const archiveReleaseUrl=await put(releasePath,html,'text/html; charset=utf-8');
      const archiveStableUrl=await put(stablePath,html,'text/html; charset=utf-8');
      const releaseUrl=SELF+'?view=build&run_id='+encodeURIComponent(runId)+'&deployment_id='+encodeURIComponent(deploymentId);
      const stableUrl=SELF+'?view=build&run_id='+encodeURIComponent(runId);
      const verification=await verifyUrl(stableUrl);
      const result={releaseUrl,stableUrl,archiveReleaseUrl,archiveStableUrl,provider:'supabase',target:'edge-served-receipt'};
      if(!verification.ok) throw new Error('deployment_verification_failed');
      const now=new Date().toISOString();
      await db.from('hercules_deployment_runs').update({
        status:'deployed',result,deployed_at:now,verification_status:'verified',
        verification,verified_at:now,updated_at:now
      }).eq('deployment_id',deploymentId);
      await db.from('hercules_backend_build_runs').update({
        deployment_status:'deployed',deployment_id:deploymentId,
        release_status:'verified',release_verified_at:now,updated_at:now
      }).eq('id',run.id);
      await db.from('hercules_audit_log').insert({
        organization_id:org,actor_user_id:uid,action:'deployment.completed',
        resource_type:'hercules_deployment',resource_id:deploymentId,
        changes:{build_run_id:runId,provider:'supabase',target:'edge-served-receipt',stable_url:stableUrl,verification},
        metadata:{manual_operator_steps:false,release_verified:true,repository_write_performed:false}
      });
      return out({ok:true,deploymentId,buildRunId:runId,...result,manualOperatorSteps:false},201);
    }catch(e){
      const message=e instanceof Error?e.message:'deployment_failed';
      await db.from('hercules_deployment_runs').update({
        status:'failed',verification_status:'failed',error:{message},updated_at:new Date().toISOString()
      }).eq('deployment_id',deploymentId);
      await db.from('hercules_backend_build_runs').update({
        deployment_status:'failed',deployment_id:deploymentId,release_status:'failed',updated_at:new Date().toISOString()
      }).eq('id',run.id);
      return out({error:'deployment_failed',detail:message},500);
    }
  }

  if(action==='deploy_canonical_ad_studio'){
    const sourceUrl='https://raw.githubusercontent.com/Sauceapproved7/expert-doodle/43f80013b71298883cb0a3cbc48dc7d731e5b86b/hercules-forge/ad-studio/index.html';
    try{
      const source=await fetch(sourceUrl,{headers:{'accept':'text/html','cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
      const html=await source.text();
      if(!source.ok||html.length<5000||html.length>200000||!/^<!doctype html>/i.test(html)||!html.includes('Hercules Ad Studio'))throw new Error('canonical_ad_studio_source_invalid');
      if(secretLike(html))throw new Error('artifact_secret_scan_failed');
      const slug='hercules-ad-studio';
      const deploymentId='deploy-'+crypto.randomUUID();
      const archiveReleaseUrl=await put('apps/'+slug+'/'+deploymentId+'/index.html',html,'text/html; charset=utf-8');
      const archiveStableUrl=await put('apps/'+slug+'/current/index.html',html,'text/html; charset=utf-8');
      const presentation=await putPresentation(slug,html);
      const verification=await verifyUrl(presentation.url);
      if(!verification.ok)throw new Error('deployment_verification_failed');
      const contentSha256=await sha(html);
      const now=new Date().toISOString();
      await db.from('hercules_deployment_runs').insert({
        organization_id:org,deployment_id:deploymentId,provider:'supabase',target:'forge-presentation',
        artifact_kind:'static-web',status:'deployed',
        deployment_manifest:{slug,sourceRepository:'Sauceapproved7/expert-doodle',sourceCommit:'43f80013b71298883cb0a3cbc48dc7d731e5b86b',sourcePath:'hercules-forge/ad-studio/index.html',archiveReleaseUrl,archiveStableUrl,presentationPath:presentation.path},
        result:{releaseUrl:presentation.url,stableUrl:presentation.url,archiveReleaseUrl,archiveStableUrl,presentationProvider:'render',contentSha256},
        created_by:uid,deployed_at:now,verification_status:'verified',verification,verified_at:now,updated_at:now
      });
      await db.from('hercules_audit_log').insert({
        organization_id:org,actor_user_id:uid,action:'deployment.canonical_ad_studio.verified',
        resource_type:'hercules_deployment',resource_id:deploymentId,
        changes:{slug,public_url:presentation.url,content_sha256:contentSha256,source_commit:'43f80013b71298883cb0a3cbc48dc7d731e5b86b',verification},
        metadata:{orchestrator:'hercules-deploy-controller',assistant_managed_provider_step:true,direct_provider_invocation:false,credentials_exported:false,manual_operator_steps:false}
      });
      return out({ok:true,deploymentId,slug,publicUrl:presentation.url,contentSha256,verification,source:{repository:'Sauceapproved7/expert-doodle',commit:'43f80013b71298883cb0a3cbc48dc7d731e5b86b',path:'hercules-forge/ad-studio/index.html'},manualOperatorSteps:false,directProviderInvocation:false},201);
    }catch(e){
      return out({error:'canonical_ad_studio_deployment_failed',detail:e instanceof Error?e.message:'deployment_failed'},500);
    }
  }

  if(action==='deploy_marketing_16_native'){
    const sourceCommit=String(b.source_commit||'').trim();
    if(!/^[0-9a-f]{40}$/i.test(sourceCommit))return out({error:'valid_source_commit_required'},400);
    const base='https://raw.githubusercontent.com/Sauceapproved7/expert-doodle/'+sourceCommit+'/sauceapproved-studio/marketing-16/';
    try{
      const [coreRes,runtimeRes]=await Promise.all([
        fetch(base+'core.mjs',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(10000)}),
        fetch(base+'runtime.mjs',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(10000)})
      ]);
      const [core,runtime]=await Promise.all([coreRes.text(),runtimeRes.text()]);
      if(!coreRes.ok||!runtimeRes.ok)throw new Error('marketing_16_source_unavailable');
      const names=['THE MACHINE','Product Intelligence Engine','Creative Lab','Offer Architect','Ad Economics Calculator','Landing-Page Killer','Retention Engine','Creative Performance Brain','Daily Command Center','BLACKBOX','Shadow Radar','Creative DNA','Profit Sniper','Customer X-Ray','Kill Switch','THE LAB'];
      if(!names.every(n=>core.includes(n))||!core.includes('autoPublish: false')||!core.includes('autoSpend: false')||!core.includes('storefrontMutation: false')||!runtime.includes('marketing_operation_not_allowed'))throw new Error('marketing_16_source_contract_failed');
      const contentSha256=await sha(core+'\n---runtime---\n'+runtime);
      const deploymentId='deploy-'+crypto.randomUUID();
      const manifest={service:'hercules-marketing-16',version:'1',modules:16,targetKind:'hercules_marketing_16',sourceRepository:'Sauceapproved7/expert-doodle',sourceCommit,contentSha256,releaseReady:false,autoPublish:false,autoSpend:false,storefrontMutation:false};
      const html='<!doctype html><html><head><meta charset="utf-8"><title>Hercules Marketing 16</title></head><body><h1>Hercules Marketing 16</h1><p>Native Hercules deployment verified.</p><p>Modules: 16</p><p>Release controls: fail-closed</p><code>'+esc(sourceCommit)+'</code></body></html>';
      const slug='hercules-marketing-16';
      const archiveReleaseUrl=await put('apps/'+slug+'/'+deploymentId+'/index.html',html,'text/html; charset=utf-8');
      const archiveStableUrl=await put('apps/'+slug+'/current/index.html',html,'text/html; charset=utf-8');
      const presentation=await putPresentation(slug,html);
      const verification=await verifyUrl(presentation.url);
      if(!verification.ok)throw new Error('deployment_verification_failed');
      const now=new Date().toISOString();
      await db.from('hercules_deployment_runs').insert({
        organization_id:org,deployment_id:deploymentId,provider:'hercules',target:'hercules_marketing_16',
        artifact_kind:'native-runtime',status:'deployed',deployment_manifest:{...manifest,archiveReleaseUrl,archiveStableUrl,presentationPath:presentation.path},
        result:{stableUrl:presentation.url,releaseUrl:presentation.url,contentSha256,modules:16,releaseReady:false,autoPublish:false,autoSpend:false,storefrontMutation:false},
        created_by:uid,deployed_at:now,verification_status:'verified',verification,verified_at:now,updated_at:now
      });
      await db.from('hercules_audit_log').insert({
        organization_id:org,actor_user_id:uid,action:'deployment.marketing_16.verified',
        resource_type:'hercules_deployment',resource_id:deploymentId,
        changes:{source_commit:sourceCommit,content_sha256:contentSha256,modules:16,target:'hercules_marketing_16',verification},
        metadata:{orchestrator:'hercules-deploy-controller',manual_operator_steps:false,release_ready:false,auto_publish:false,auto_spend:false,storefront_mutation:false}
      });
      return out({ok:true,deploymentId,service:'hercules-marketing-16',target:'hercules_marketing_16',modules:16,sourceCommit,contentSha256,publicUrl:presentation.url,verification,releaseReady:false,autoPublish:false,autoSpend:false,storefrontMutation:false,manualOperatorSteps:false},201);
    }catch(e){
      return out({error:'marketing_16_deployment_failed',detail:e instanceof Error?e.message:'deployment_failed'},500);
    }
  }

  if(action==='deploy_static'){
    const slug=String(b.slug||'').trim(),html=String(b.html||'');
    if(!safeSlug(slug))return out({error:'valid_slug_required'},400);
    if(!html||html.length>500000)return out({error:'valid_html_required'},400);
    if(secretLike(html))return out({error:'artifact_secret_scan_failed'},400);
    const studioOnly=slug===STUDIO_OFFER_SLUG;
    if(studioOnly){
      const checked=await studioReleaseSourceCheck({
        slug,html,claimedSha:String(b.approved_sha256||''),previousSha:String(b.previous_sha256||'')
      });
      if(!checked.ok)return out({error:'studio_offer_source_not_authorized',reason:checked.reason},409);
    }
    const deploymentId='deploy-'+crypto.randomUUID();
    const releasePath='apps/'+slug+'/'+deploymentId+'/index.html';
    const stablePath='apps/'+slug+'/current/index.html';
    await db.from('hercules_deployment_runs').insert({
      organization_id:org,deployment_id:deploymentId,provider:'supabase',target:'forge-presentation',
      artifact_kind:'static-web',status:'deploying',deployment_manifest:{slug,releasePath,stablePath,autoDeploy:true,presentationHost:PRESENTATION_ORIGIN},created_by:uid
    });
    try{
      const archiveReleaseUrl=await put(releasePath,html,'text/html; charset=utf-8');
      const archiveStableUrl=await put(stablePath,html,'text/html; charset=utf-8');
      let presentation:{path:string,url:string},verification:any;
      if(studioOnly){
        const path=PRESENTATION_ORG+'/'+slug+'/index.html';
        const guarded=await guardedStudioPresentationWrite({
          slug,html,claimedSha:String(b.approved_sha256||''),
          previousSha:String(b.previous_sha256||''),
          pinnedPreviousSha:STUDIO_LEGACY_SHA,
          storage:{
            async read(){
              const {data,error}=await db.storage.from(PRESENTATION_BUCKET).download(path);
              if(error||!data)throw new Error('studio_previous_object_unavailable');
              return await data.text();
            },
            async write(contents:string){
              const {error}=await db.storage.from(PRESENTATION_BUCKET).upload(path,enc.encode(contents),{
                upsert:true,contentType:'text/html; charset=utf-8',cacheControl:'60'
              });
              if(error)throw new Error('studio_write_failed');
            }
          },
          publicUrl:PRESENTATION_ORIGIN+'/'+slug+'/'
        });
        if(!guarded.ok)throw new Error('studio_guard_'+guarded.reason);
        presentation={path,url:PRESENTATION_ORIGIN+'/'+slug+'/'};
        verification=guarded.verification;
      }else{
        presentation=await putPresentation(slug,html);
        verification=await verifyUrl(presentation.url);
        if(!verification.ok)throw new Error('deployment_verification_failed');
      }
      const releaseUrl=SELF+'?view=static&deployment_id='+encodeURIComponent(deploymentId);
      const stableUrl=presentation.url;
      const result={releaseUrl,stableUrl,archiveReleaseUrl,archiveStableUrl,presentationPath:presentation.path,presentationProvider:'render'};
      const now=new Date().toISOString();
      await db.from('hercules_deployment_runs').update({
        status:'deployed',result,deployed_at:now,verification_status:'verified',
        verification,verified_at:now,updated_at:now
      }).eq('deployment_id',deploymentId);
      return out({ok:true,deploymentId,slug,...result,manualOperatorSteps:false},201);
    }catch(e){
      const message=e instanceof Error?e.message:'deployment_failed';
      await db.from('hercules_deployment_runs').update({status:'failed',verification_status:'failed',error:{message},updated_at:new Date().toISOString()}).eq('deployment_id',deploymentId);
      return out({error:'deployment_failed',detail:message},500);
    }
  }

  return out({error:'unsupported_action'},400);
});