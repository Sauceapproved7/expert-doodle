import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {preflightCloudDeployment} from './preflight.mjs';

const IMAGE=/^[a-z0-9][a-z0-9._/-]{1,128}@sha256:[a-f0-9]{64}$/;
const NAME=/^hc-[a-f0-9]{24}$/;
const MAX_HOST_AGE_MS=15*60*1000;
const CLOCK_SKEW_MS=30*1000;
const MAX_PERMIT_MS=5*60*1000;
const PLAN_SCHEMA='hercules.cloud.host-plan.v1';
const PERMIT_SCHEMA='hercules.cloud.sandbox-permit.v1';

const hash=value=>createHash('sha256').update(value).digest('hex');
function fail(code){throw new Error(code)}
function signingSecret(signingKey){
 if(typeof signingKey!=='string'||signingKey.length<32)fail('signing_key_required');
 return signingKey;
}
function toTime(value){
 const t=Date.parse(String(value??''));
 return Number.isFinite(t)?t:NaN;
}
function exactCommands(name,image){
 return {
  create:['container','create','--name',name,'--pull','never',
   '--network','none','--read-only','--cap-drop','ALL',
   '--security-opt','no-new-privileges','--pids-limit','64',
   '--memory','128m','--cpus','0.5','--user','65532:65532',
   '--restart','no','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
   '--log-driver','none',image],
  start:['container','start',name],
  inspect:['container','inspect','--format','{{.State.Running}}',name],
  rollback:['container','rm','--force',name]
 };
}
function canonicalPlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan))fail('plan_invalid');
 const {planDigest,...rest}=plan;
 return JSON.stringify(rest);
}
function assertPlan(plan){
 if(plan.schema!==PLAN_SCHEMA||plan.mode!=='sandbox-no-network'
   ||plan.executionAuthorized!==false||plan.productionAuthorized!==false
   ||plan.costChangeUsd!==0||!NAME.test(plan.containerName)
   ||!IMAGE.test(plan.image)||plan.target?.kind!=='owned_linux'
   ||plan.target?.environment!=='sandbox'
   ||!isDeepStrictEqual(plan.commands,exactCommands(plan.containerName,plan.image))
   ||hash(canonicalPlan(plan))!==plan.planDigest)fail('plan_integrity_invalid');
 return plan;
}
function payload(permit){
 return JSON.stringify({
  schema:permit.schema,action:permit.action,
  planDigest:permit.planDigest,issuedAt:permit.issuedAt,
  expiresAt:permit.expiresAt,nonce:permit.nonce
 });
}
function seal(permit,key){
 return createHmac('sha256',key).update(payload(permit)).digest('hex');
}
function validatePermit(plan,permit,{signingKey,action,now}){
 const key=signingSecret(signingKey);
 assertPlan(plan);
 if(!permit||permit.schema!==PERMIT_SCHEMA||permit.action!==action)
   fail('permit_action_mismatch');
 if(permit.planDigest!==plan.planDigest
   ||!Number.isSafeInteger(permit.issuedAt)
   ||!Number.isSafeInteger(permit.expiresAt)
   ||permit.expiresAt<=permit.issuedAt
   ||permit.expiresAt-permit.issuedAt>MAX_PERMIT_MS
   ||typeof permit.nonce!=='string'
   ||!(/^[a-f0-9]{32}$/.test(permit.nonce)))
    fail('permit_invalid');
 const expected=Buffer.from(seal(permit,key),'hex');
 const supplied=/^[a-f0-9]{64}$/.test(String(permit.signature??''))
   ?Buffer.from(permit.signature,'hex'):Buffer.alloc(0);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))
   fail('permit_signature_invalid');
 if(now<permit.issuedAt-CLOCK_SKEW_MS)fail('permit_not_yet_valid');
 if(now>permit.expiresAt)fail('permit_expired');
}
export function createSandboxHostPlan(request,{targets=[],image,now=Date.now()}={}){
 const base=preflightCloudDeployment(request,{targets});
 const host=Array.isArray(targets)?
  targets.find(t=>t?.kind===base.target.kind&&t?.reference===base.target.reference):null;
 const checked=toTime(host?.verifiedAt);
 const fresh=Number.isFinite(checked)&&checked<=now+CLOCK_SKEW_MS
   &&checked>=now-MAX_HOST_AGE_MS;
 if(!base.readyForStaging||base.target.kind!=='owned_linux'||!host
   ||host.runtime!=='rootless_docker'||!fresh)
   fail('sandbox_host_not_authorized');
 if(typeof image!=='string'||!IMAGE.test(image)
   ||!Array.isArray(host.allowlistedImages)||!host.allowlistedImages.includes(image))
    fail('pinned_allowlisted_image_required');
 const containerName='hc-'+hash(base.requestDigest+'|'+image).slice(0,24);
 const body={
  schema:PLAN_SCHEMA,mode:'sandbox-no-network',
  target:{kind:base.target.kind,reference:base.target.reference,environment:'sandbox'},
  serviceId:base.serviceId,releaseId:base.releaseId,
  sourceCommit:base.sourceCommit,artifactFingerprint:base.artifactFingerprint,
  requestDigest:base.requestDigest,image,containerName,
  commands:exactCommands(containerName,image),
  costChangeUsd:0,executionAuthorized:false,productionAuthorized:false,
  limits:{memoryMiB:128,cpus:0.5,pids:64,network:'none',filesystem:'read-only'},
  limitation:'Locally staged sandbox container only; not a verified hosting or production release.'
 };
 return Object.freeze({...body,planDigest:hash(JSON.stringify(body))});
}
export function createSandboxPermit(plan,{signingKey,action='start',now=Date.now(),ttlMs=120000}={}){
 const key=signingSecret(signingKey);
 assertPlan(plan);
 if(!['start','rollback'].includes(action))fail('permit_action_invalid');
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_PERMIT_MS)
  fail('permit_ttl_invalid');
 const data={
  schema:PERMIT_SCHEMA,action,planDigest:plan.planDigest,
  issuedAt:now,expiresAt:now+ttlMs,nonce:randomBytes(16).toString('hex')
 };
 return Object.freeze({...data,signature:seal(data,key)});
}
function requireRunner(runCommand,consumeNonce){
 if(typeof runCommand!=='function')fail('runner_unavailable');
 if(typeof consumeNonce!=='function')fail('replay_store_required');
}
async function run(runCommand,args){
 let result;
 try{result=await runCommand('docker',args,{timeoutMs:10000,shell:false})}
 catch{return {ok:false,stdout:''}}
 return {ok:result?.exitCode===0,stdout:typeof result?.stdout==='string'?result.stdout:''};
}
async function verifyRootless(runCommand){
 const r=await run(runCommand,['info','--format','{{json .SecurityOptions}}']);
 if(!r.ok)fail('rootless_docker_unverified');
 let options;
 try{options=JSON.parse(r.stdout.trim())}catch{fail('rootless_docker_unverified')}
 if(!Array.isArray(options)||!options.some(x=>x==='name=rootless'))
   fail('rootless_docker_unverified');
}
async function consume(consumeNonce,permit){
 let used=false;
 try{used=await consumeNonce(permit.nonce,permit.expiresAt)}
 catch{fail('permit_replay_store_unavailable')}
 if(used!==true)fail('permit_replayed');
}
export async function executeSandboxHostPlan(plan,{
 permit,signingKey,runCommand,consumeNonce,now=Date.now()
}={}){
 validatePermit(plan,permit,{signingKey,action:'start',now});
 requireRunner(runCommand,consumeNonce);
 await verifyRootless(runCommand);
 await consume(consumeNonce,permit);
 let created=false;
 try{
  const creation=await run(runCommand,plan.commands.create);
  if(!creation.ok)fail('sandbox_launch_unverified');
  created=true;
  const started=await run(runCommand,plan.commands.start);
  if(!started.ok)fail('sandbox_launch_unverified');
  const result=await run(runCommand,plan.commands.inspect);
  if(!result.ok||result.stdout.trim()!=='true')fail('sandbox_launch_unverified');
  return Object.freeze({
   schema:'hercules.cloud.host-receipt.v1',planDigest:plan.planDigest,
   serviceId:plan.serviceId,containerName:plan.containerName,
   started:true,runningVerified:true,productionAuthorized:false
  });
 }catch{
  if(created)await run(runCommand,plan.commands.rollback);
  fail('sandbox_launch_unverified');
 }
}
export async function rollbackSandboxHostPlan(plan,{
 permit,signingKey,runCommand,consumeNonce,now=Date.now()
}={}){
 validatePermit(plan,permit,{signingKey,action:'rollback',now});
 requireRunner(runCommand,consumeNonce);
 await verifyRootless(runCommand);
 await consume(consumeNonce,permit);
 const result=await run(runCommand,plan.commands.rollback);
 if(!result.ok)fail('sandbox_rollback_unverified');
 return Object.freeze({
  schema:'hercules.cloud.rollback-receipt.v1',
  planDigest:plan.planDigest,serviceId:plan.serviceId,
  containerName:plan.containerName,rolledBack:true,productionAuthorized:false
 });
}
