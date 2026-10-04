import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const U=Deno.env.get('SUPABASE_URL')!;
const S=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{persistSession:false}});
const ORG='ea5fb196-67f9-42fa-b592-49eeb3b84346';
const LOVABLE_URL='https://hercules-forge-command.lovable.app';
const H={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
const out=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const enc=new TextEncoder();
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const digest=(s:string)=>sha(s).then(x=>'sha256:'+x);
const SHA256=/^sha256:[0-9a-f]{64}$/;
const COMMIT=/^[0-9a-f]{40,64}$/;
const RENDER_API='https://api.render.com';
const RENDER_COMMIT=/^[0-9a-f]{40}$/;
const RENDER_DEPLOY=/^dep-[a-z0-9]+$/;
const RENDER_SERVICE=/^srv-[a-z0-9]+$/;
const VAULT_RENDER_ACTIONS=new Set(['vault_render_status','vault_render_deploy','vault_render_verify','vault_render_rollback']);
function canonical(v:any):string{
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function pemBytes(pem:string){
  const raw=pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  return Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
}
async function verifyEd25519(message:string,signature:string,pem:string){
  try{
    const key=await crypto.subtle.importKey('spki',pemBytes(pem),{name:'Ed25519'},false,['verify']);
    return await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),enc.encode(message));
  }catch{return false}
}
async function admit(passport:any){
  const {data:cfg}=await db.from('hercules_release_trust_config').select('*').eq('id','primary').eq('enabled',true).maybeSingle();
  const findings:any[]=[]; const deny=(code:string,message:string)=>findings.push({code,message});
  if(!cfg)deny('trust_config_missing','Release trust configuration is unavailable.');
  if(!passport||passport.schemaVersion!=='hercules.release-passport/v1')deny('passport_invalid','Release passport is invalid.');
  const repository=String(passport?.source?.repository||''),commit=String(passport?.source?.commit||'');
  const builder=String(passport?.builder?.identity||''),environment=String(passport?.target?.environment||'');
  if(!cfg?.trusted_repositories?.includes(repository)||passport?.source?.trusted!==true)deny('source_untrusted','Source repository is not trusted.');
  if(!COMMIT.test(commit))deny('source_commit_invalid','Source commit is not immutable.');
  if(!cfg?.trusted_builders?.includes(builder)||passport?.builder?.trusted!==true)deny('builder_untrusted','Builder identity is not trusted.');
  if(passport?.builder?.ephemeral!==true)deny('builder_not_ephemeral','Builder must be ephemeral.');
  for(const [code,value] of [['artifact_digest_invalid',passport?.artifact?.digest],['provenance_missing',passport?.evidence?.provenanceDigest],['sbom_missing',passport?.evidence?.sbomDigest],['rollback_missing',passport?.rollback?.artifactDigest]])if(!SHA256.test(String(value||'')))deny(code,'Required SHA-256 evidence is missing.');
  if(passport?.evidence?.testsPassed!==true)deny('tests_failed','Required tests did not pass.');
  if(Number(passport?.evidence?.criticalFindings||0)>0)deny('critical_findings','Critical findings remain.');
  if(environment==='production'&&!String(passport?.approvedBy||''))deny('approval_missing','Production approval is required.');
  if(!String(passport?.artifact?.signature||''))deny('signature_missing','Artifact signature is required.');
  else if(cfg&&!await verifyEd25519(String(passport.artifact.digest),String(passport.artifact.signature),String(cfg.release_public_key_pem)))deny('signature_invalid','Artifact signature is invalid.');
  const passportDigest=await digest(canonical(passport));
  return {decision:findings.length?'deny':'allow',findings,passportDigest};
}
async function createPortableAttestation(releaseId:string,passportDigest:string){
  const auth=await sha(S+':attest:'+releaseId+':'+passportDigest);
  const r=await fetch(U+'/functions/v1/hercules-attestation',{
    method:'POST',
    headers:{'content-type':'application/json','x-hercules-attestation-auth':auth},
    body:JSON.stringify({action:'attest',release_id:releaseId}),
    signal:AbortSignal.timeout(15000)
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok||body?.ok!==true||body?.verified!==true)throw new Error('portable_attestation_failed:'+String(body?.error||r.status));
  return body;
}

async function recordAdmission(releaseId:string,admission:any){
  const {data,error}=await db.from('hercules_forge_flight_records').insert({organization_id:ORG,release_id:releaseId,passport_digest:admission.passportDigest,decision:admission.decision,findings:admission.findings}).select('record_hash').single();
  if(error)throw new Error('flight_record_failed:'+error.message);
  return String(data.record_hash);
}

async function authorized(req:Request,purpose='deployment-broker'){
  const key=req.headers.get('x-hercules-internal-key')||'';
  if(!key)return false;
  const digest=await sha(key);
  const {data}=await db.from('hercules_internal_service_keys')
    .select('key_sha256,enabled').eq('purpose',purpose).eq('enabled',true).maybeSingle();
  return Boolean(data?.enabled&&data.key_sha256===digest);
}
async function internalKey(purpose:string){
  const {data}=await db.from('hercules_internal_service_keys')
    .select('secret_ref,enabled').eq('purpose',purpose).eq('enabled',true).maybeSingle();
  if(!data?.secret_ref)throw new Error(purpose+'_secret_missing');
  const {data:secret,error}=await db.rpc('hercules_get_secret',{p_id:data.secret_ref});
  if(error||!secret)throw new Error(purpose+'_secret_unavailable');
  return String(secret);
}
async function vaultRenderTarget(code:string){
  if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(code))throw new Error('target_invalid');
  const {data,error}=await db.from('hercules_deploy_targets')
    .select('code,provider,service_id,public_origin,enabled')
    .eq('code',code).eq('enabled',true).maybeSingle();
  if(error||!data||data.provider!=='render'||!RENDER_SERVICE.test(String(data.service_id||'')))throw new Error('target_unavailable');
  const origin=new URL(String(data.public_origin||''));
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('target_origin_invalid');
  return {code:String(data.code),serviceId:String(data.service_id),publicOrigin:origin.origin};
}
async function renderCall(path:string,token:string,init:RequestInit={}){
  const headers=new Headers({authorization:'Bearer '+token,accept:'application/json'});
  for(const [key,value] of new Headers(init.headers||{}).entries())headers.set(key,value);
  if(init.body)headers.set('content-type','application/json');
  const response=await fetch(RENDER_API+path,{...init,headers,redirect:'error',signal:AbortSignal.timeout(10000)});
  const text=await response.text();
  let body:any={};
  if(text){try{body=JSON.parse(text)}catch{throw new Error('render_response_invalid')}}
  if(!response.ok)throw new Error('render_request_failed_'+response.status);
  return body;
}
async function verifyRenderPublic(publicOrigin:string){
  const health=await fetch(publicOrigin+'/health',{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!health.ok)throw new Error('health_verification_failed');
  const healthBody=await health.json().catch(()=>null);
  if(healthBody?.ok!==true||healthBody?.service!=='hercules-ai'||healthBody?.mcp!=='/mcp')throw new Error('health_verification_failed');
  const mcp=await fetch(publicOrigin+'/mcp',{
    method:'POST',redirect:'error',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:'verify',method:'ping'}),signal:AbortSignal.timeout(5000)
  });
  if(![401,403].includes(mcp.status))throw new Error('mcp_protection_verification_failed');
  return {health:true,mcpProtected:true};
}
async function handleVaultRender(action:string,b:any){
  const target=await vaultRenderTarget(String(b?.target||''));
  if(action==='vault_render_status'){
    let credentialConfigured=true;
    try{await internalKey('render-deployer')}catch{credentialConfigured=false}
    return out({ok:true,action,target:target.code,provider:'render',credentialConfigured,carriesCredentials:false});
  }
  const token=await internalKey('render-deployer');
  if(action==='vault_render_deploy'){
    const sourceCommit=String(b?.source_commit||'').trim().toLowerCase();
    if(!RENDER_COMMIT.test(sourceCommit))return out({error:'source_commit_invalid'},400);
    const result=await renderCall('/v1/services/'+encodeURIComponent(target.serviceId)+'/deploys',token,{
      method:'POST',body:JSON.stringify({clearCache:'do_not_clear',commitId:sourceCommit})
    });
    const providerDeploymentId=String(result?.id||'');
    if(!RENDER_DEPLOY.test(providerDeploymentId))throw new Error('render_deployment_id_invalid');
    return out({ok:true,action,target:target.code,provider:'render',providerDeploymentId,sourceCommit,carriesCredentials:false},202);
  }
  const providerDeploymentId=String(b?.provider_deployment_id||'').trim();
  if(!RENDER_DEPLOY.test(providerDeploymentId))return out({error:'provider_deployment_id_invalid'},400);
  if(action==='vault_render_verify'){
    const sourceCommit=String(b?.source_commit||'').trim().toLowerCase();
    if(!RENDER_COMMIT.test(sourceCommit))return out({error:'source_commit_invalid'},400);
    const deployment=await renderCall('/v1/services/'+encodeURIComponent(target.serviceId)+'/deploys/'+encodeURIComponent(providerDeploymentId),token);
    if(deployment?.status!=='live'||String(deployment?.commit?.id||'').toLowerCase()!==sourceCommit){
      return out({ok:false,action,target:target.code,provider:'render',providerDeploymentId,status:String(deployment?.status||'unknown'),exactCommit:false,carriesCredentials:false},409);
    }
    const publicEvidence=await verifyRenderPublic(target.publicOrigin);
    return out({ok:true,action,target:target.code,provider:'render',providerDeploymentId,sourceCommit,exactCommit:true,...publicEvidence,carriesCredentials:false});
  }
  const rollback=await renderCall('/v1/services/'+encodeURIComponent(target.serviceId)+'/rollback',token,{
    method:'POST',body:JSON.stringify({deployId:providerDeploymentId})
  });
  const rollbackDeploymentId=String(rollback?.id||'');
  if(!RENDER_DEPLOY.test(rollbackDeploymentId))throw new Error('render_deployment_id_invalid');
  return out({ok:true,action,target:target.code,provider:'render',rollbackTargetDeploymentId:providerDeploymentId,providerDeploymentId:rollbackDeploymentId,carriesCredentials:false},202);
}
async function selectTarget(kind:string){
  const {data,error}=await db.rpc('hercules_select_deployment_target',{p_artifact_kind:kind});
  if(error)throw new Error('target_selection_failed');
  return Array.isArray(data)&&data.length?data[0]:null;
}
async function monitorLovable(){
  let status=0,contentType='',ok=false,detail:any={};
  try{
    const r=await fetch(LOVABLE_URL,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(8000)});
    status=r.status; contentType=r.headers.get('content-type')||'';
    const text=await r.text();
    ok=status===200&&contentType.toLowerCase().includes('text/html')&&text.includes('Hercules');
    detail={
      contentLength:enc.encode(text).byteLength,
      bodySha256:await sha(text),
      deploymentHeader:r.headers.get('x-deployment-id')||null
    };
  }catch(e){
    detail={error:e instanceof Error?e.message:'host_check_failed'};
  }
  await db.from('hercules_host_checks').insert({
    provider:'lovable',target:'production-hosting',url:LOVABLE_URL,
    ok,status_code:status||null,content_type:contentType||null,detail
  });
  return {provider:'lovable',url:LOVABLE_URL,ok,statusCode:status||null,contentType:contentType||null,detail};
}
async function deployBackendRelease(row:any){
  const key=await internalKey('deploy-controller');
  const r=await fetch(U+'/functions/v1/hercules-deploy-controller',{
    method:'POST',
    headers:{'content-type':'application/json','x-hercules-internal-key':key},
    body:JSON.stringify({action:'deploy_build_api_receipt',build_run_id:row.build_run_id,release_id:row.release_id}),
    signal:AbortSignal.timeout(12000)
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok||body?.ok!==true)throw new Error(body?.detail||body?.error||'deploy_controller_failed');
  return body;
}
async function deployStaticRelease(row:any){
  const key=await internalKey('deploy-controller');
  let source=row;
  const sourceReleaseId=String(row?.payload?.source_release_id||'');
  if(sourceReleaseId){
    const {data}=await db.from('hercules_release_queue').select('release_id,status,admission_decision,artifact_kind,payload')
      .eq('organization_id',ORG).eq('release_id',sourceReleaseId).maybeSingle();
    if(!data||data.status!=='verified'||data.admission_decision!=='allow'||data.artifact_kind!=='static-web'){
      throw new Error('verified_static_source_release_required');
    }
    source=data;
  }
  const slug=String(source?.payload?.slug||'').trim();
  const name=String(source?.payload?.name||slug||'Hercules App').trim();
  const html=String(source?.payload?.html||'');
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)||!html.startsWith('<!doctype html>')){
    throw new Error('static_release_payload_invalid');
  }
  const r=await fetch(U+'/functions/v1/hercules-deploy-controller',{
    method:'POST',
    headers:{'content-type':'application/json','x-hercules-internal-key':key},
    body:JSON.stringify({action:'deploy_static',slug,name,html,release_id:row.release_id}),
    signal:AbortSignal.timeout(20000)
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok||body?.ok!==true)throw new Error(body?.detail||body?.error||'static_deploy_controller_failed');
  return body;
}
async function processOne(){
  const now=new Date().toISOString();
  const {data:rows}=await db.from('hercules_release_queue').select('*')
    .eq('organization_id',ORG)
    .in('status',['queued','routing'])
    .lte('next_attempt_at',now)
    .order('created_at',{ascending:true}).limit(1);
  const row=rows?.[0];
  if(!row)return null;
  if(row.admission_enforced&&row.admission_decision!=='allow'){
    await db.from('hercules_release_queue').update({status:'blocked',block_reason:'release_admission_required',updated_at:now}).eq('id',row.id);
    return {releaseId:row.release_id,status:'blocked',reason:'release_admission_required'};
  }

  await db.from('hercules_release_queue').update({
    status:'routing',attempts:Number(row.attempts||0)+1,last_attempt_at:now,updated_at:now
  }).eq('id',row.id);

  const target=await selectTarget(String(row.artifact_kind));
  if(!target){
    await db.from('hercules_release_queue').update({
      status:'blocked',block_reason:'no_verified_zero_touch_target',
      next_attempt_at:new Date(Date.now()+30*60*1000).toISOString(),updated_at:new Date().toISOString()
    }).eq('id',row.id);
    return {releaseId:row.release_id,status:'blocked',reason:'no_verified_zero_touch_target'};
  }

  await db.from('hercules_release_queue').update({
    selected_provider:target.provider,selected_target:target.target,
    block_reason:null,updated_at:new Date().toISOString()
  }).eq('id',row.id);

  if(target.execution_mode==='backend_autonomous' &&
     target.provider==='supabase' && target.target==='edge-api' &&
     row.artifact_kind==='build-release-api' && row.build_run_id){
    try{
      const result=await deployBackendRelease(row);
      await db.from('hercules_release_queue').update({
        status:'verified',deployment_id:result.deploymentId||result.deployment?.deployment_id||null,
        block_reason:null,updated_at:new Date().toISOString()
      }).eq('id',row.id);
      return {releaseId:row.release_id,status:'verified',provider:'supabase',target:'edge-api',deployment:result};
    }catch(e){
      const message=e instanceof Error?e.message:'deployment_failed';
      await db.from('hercules_release_queue').update({
        status:'failed',block_reason:message,
        next_attempt_at:new Date(Date.now()+10*60*1000).toISOString(),updated_at:new Date().toISOString()
      }).eq('id',row.id);
      return {releaseId:row.release_id,status:'failed',reason:message};
    }
  }

  if(target.execution_mode==='backend_autonomous' &&
     target.provider==='supabase' && target.target==='storage-static' &&
     row.artifact_kind==='static-web'){
    try{
      const result=await deployStaticRelease(row);
      await db.from('hercules_release_queue').update({
        status:'verified',deployment_id:result.deploymentId||null,
        block_reason:null,updated_at:new Date().toISOString()
      }).eq('id',row.id);
      return {releaseId:row.release_id,status:'verified',provider:'supabase',target:'forge-presentation',deployment:result};
    }catch(e){
      const message=e instanceof Error?e.message:'static_deployment_failed';
      await db.from('hercules_release_queue').update({
        status:'failed',block_reason:message,
        next_attempt_at:new Date(Date.now()+10*60*1000).toISOString(),updated_at:new Date().toISOString()
      }).eq('id',row.id);
      return {releaseId:row.release_id,status:'failed',reason:message};
    }
  }

  if(target.execution_mode==='assistant_managed'){
    await db.from('hercules_release_queue').update({
      status:'blocked',block_reason:'assistant_managed_provider_action_pending',
      next_attempt_at:new Date(Date.now()+30*60*1000).toISOString(),updated_at:new Date().toISOString()
    }).eq('id',row.id);
    return {releaseId:row.release_id,status:'blocked',reason:'assistant_managed_provider_action_pending',target};
  }

  await db.from('hercules_release_queue').update({
    status:'blocked',block_reason:'unsupported_execution_mode',updated_at:new Date().toISOString()
  }).eq('id',row.id);
  return {releaseId:row.release_id,status:'blocked',reason:'unsupported_execution_mode'};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='GET'){
    const [{data:caps},{data:queue},{data:checks}]=await Promise.all([
      db.from('hercules_deployment_capabilities').select('*').order('artifact_kind').order('provider'),
      db.from('hercules_release_queue').select('*').eq('organization_id',ORG).order('created_at',{ascending:false}).limit(20),
      db.from('hercules_host_checks').select('*').order('checked_at',{ascending:false}).limit(10)
    ]);
    return out({ok:true,service:'hercules-deployment-broker',version:'1.4.0',attestationRequired:true,attestationFormat:'in-toto Statement/v1 + SLSA provenance/v1 + DSSE Ed25519',capabilities:caps||[],queue:queue||[],hostChecks:checks||[]});
  }
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  const b=await req.json().catch(()=>({}));
  const action=String(b.action||'tick');
  const authPurpose=VAULT_RENDER_ACTIONS.has(action)?'deploy-broker-control':'deployment-broker';
  if(!await authorized(req,authPurpose))return out({error:'internal_authorization_required'},403);
  if(VAULT_RENDER_ACTIONS.has(action)){
    try{return await handleVaultRender(action,b)}
    catch(e){
      const code=e instanceof Error?e.message:'vault_render_failed';
      const safe=/^(render-deployer_secret_missing|render-deployer_secret_unavailable|target_invalid|target_unavailable|target_origin_invalid|render_request_failed_[0-9]{3}|render_response_invalid|render_deployment_id_invalid|health_verification_failed|mcp_protection_verification_failed)$/.test(code)?code:'vault_render_failed';
      return out({ok:false,error:safe,carriesCredentials:false},safe.startsWith('render-deployer_')?503:502);
    }
  }

  if(action==='enqueue'){
    const kind=String(b.artifact_kind||'');
    const allowed=new Set(['build-release-api','backend-service','forge-control-ui','static-web']);
    if(!allowed.has(kind))return out({error:'unsupported_artifact_kind'},400);
    const releaseId='release-'+crypto.randomUUID();
    const passport=b.release_passport;
    let admission:any,flightRecordHash:string;
    try{
      admission=await admit(passport);
      flightRecordHash=await recordAdmission(releaseId,admission);
    }catch(e){return out({error:'release_admission_failed',detail:e instanceof Error?e.message:'unknown'},500)}
    if(admission.decision!=='allow')return out({ok:false,releaseId,status:'denied',admission,flightRecordHash},403);
    const row={
      organization_id:ORG,release_id:releaseId,
      build_run_id:String(b.build_run_id||'')||null,
      artifact_kind:kind,
      requested_provider:String(b.provider||'')||null,
      requested_target:String(b.target||'')||null,
      payload:b.payload&&typeof b.payload==='object'?b.payload:{},
      environment:String(passport.target.environment),release_passport:passport,
      passport_digest:admission.passportDigest,admission_decision:admission.decision,
      flight_record_hash:flightRecordHash,admission_enforced:true,
      status:'blocked',block_reason:'attestation_pending',next_attempt_at:new Date().toISOString()
    };
    const {error}=await db.from('hercules_release_queue').insert(row);
    if(error)return out({error:'release_queue_insert_failed',detail:error.message},500);
    let portableAttestation:any;
    try{
      portableAttestation=await createPortableAttestation(releaseId,admission.passportDigest);
    }catch(e){
      const detail=e instanceof Error?e.message:'portable_attestation_failed';
      await db.from('hercules_release_queue').update({
        status:'blocked',block_reason:'portable_attestation_required',updated_at:new Date().toISOString()
      }).eq('organization_id',ORG).eq('release_id',releaseId);
      await db.from('hercules_audit_log').insert({
        organization_id:ORG,action:'release.attestation.blocked',
        resource_type:'hercules_release',resource_id:releaseId,
        changes:{passport_digest:admission.passportDigest,error:detail},
        metadata:{deployment_queued:false,attestation_required:true}
      });
      return out({ok:false,releaseId,status:'blocked',error:'portable_attestation_required',detail},409);
    }
    await db.from('hercules_release_queue').update({
      status:'queued',
      block_reason:null,
      payload:{...(row.payload||{}),portableAttestation:{
        statementSha256:portableAttestation.statementSha256||null,
        keyId:portableAttestation.keyId||null,
        predicateType:portableAttestation.predicateType||null,
        verified:portableAttestation.verified===true
      }},
      updated_at:new Date().toISOString()
    }).eq('organization_id',ORG).eq('release_id',releaseId);
    return out({ok:true,releaseId,status:'queued',artifactKind:kind,attestation:portableAttestation},202);
  }

  if(action==='process'){
    const results:any[]=[];
    for(let i=0;i<5;i++){const x=await processOne();if(!x)break;results.push(x)}
    return out({ok:true,processed:results.length,results});
  }

  if(action==='rollback'){
    const releaseId=String(b.release_id||''),rollbackBuildRunId=String(b.rollback_build_run_id||'');
    const {data:release}=await db.from('hercules_release_queue').select('*').eq('organization_id',ORG).eq('release_id',releaseId).eq('admission_decision','allow').maybeSingle();
    if(!release)return out({error:'admitted_release_not_found'},404);
    const expected=String(release.release_passport?.rollback?.artifactDigest||'').replace(/^sha256:/,'');
    const {data:target}=await db.from('hercules_backend_build_runs').select('*').eq('organization_id',ORG).eq('run_id',rollbackBuildRunId).eq('status','succeeded').maybeSingle();
    if(!target||String(target.source_snapshot?.package_sha256||'')!==expected)return out({error:'rollback_target_digest_mismatch'},409);
    try{
      const deployment=await deployBackendRelease({build_run_id:rollbackBuildRunId});
      await db.from('hercules_audit_log').insert({organization_id:ORG,action:'release.rollback.verified',resource_type:'hercules_release',resource_id:releaseId,changes:{rollback_build_run_id:rollbackBuildRunId,rollback_digest:expected,deployment},metadata:{through_deployment_broker:true}});
      return out({ok:true,releaseId,rollbackBuildRunId,rollbackDigest:'sha256:'+expected,deployment});
    }catch(e){return out({error:'rollback_failed',detail:e instanceof Error?e.message:'unknown'},500)}
  }

  if(action==='monitor_hosts'){
    return out({ok:true,check:await monitorLovable()});
  }

  if(action==='tick'){
    const check=await monitorLovable();
    const results:any[]=[];
    for(let i=0;i<5;i++){const x=await processOne();if(!x)break;results.push(x)}
    await db.from('hercules_audit_log').insert({
      organization_id:ORG,action:'deployment.broker.tick',
      resource_type:'hercules_deployment_broker',resource_id:'primary',
      changes:{host_check:check,releases_processed:results.length,results},
      metadata:{manual_operator_steps:false,operator_interaction:'conversation_only'}
    });
    return out({ok:true,hostCheck:check,processed:results.length,results});
  }

  return out({error:'unsupported_action'},400);
});
