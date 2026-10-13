/**
 * Hercules Smallz provider REST readers v1.
 * Fixed-target GET-only adapters for the existing read-only evidence bridge.
 * A real default fetch uses TLS to the exact GitHub and Render API hosts and
 * requires separately provisioned API credentials. A caller-injected fetch
 * in tests is not proof of independent provider authentication.
 * This module cannot deploy, change autodeploy, authorize, bill or roll back.
 */
const SERVICE_ID='srv-db08fglg1s2s73d0o2rg';
const WORKSPACE='tea-dalo7he5vjqs7383n2o0';
const GITHUB='https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main';
const RENDER='https://api.render.com/v1/services/'+SERVICE_ID;
const DEPLOYS=RENDER+'/deploys?limit=1';
const MAX_RESPONSE_BYTES=64*1024;
const SHA=/^[a-f0-9]{40}$/u;
const HEADER_JSON=/^application\/json(?:\s*;|\s*$)/iu;

function privateCredential(value){
  if(typeof value!=='string'||value.length<24||value.length>512||/\s/u.test(value))
    throw new TypeError('private provider credential is required');
  return value;
}
function exactArgs(value,names){
  return value!==null&&typeof value==='object'&&!Array.isArray(value)
    &&Object.keys(value).length===names.length
    &&names.every(name=>Object.hasOwn(value,name));
}
function assertGitHubArgs(input){
  if(!exactArgs(input,['url'])||input.url!==GITHUB)
    throw new TypeError('unapproved read-only GitHub ref');
}
function assertRenderArgs(input,includeLimit=false){
  const keys=includeLimit?['workspaceId','serviceId','limit']:['workspaceId','serviceId'];
  if(!exactArgs(input,keys)||input.workspaceId!==WORKSPACE
    ||input.serviceId!==SERVICE_ID||(includeLimit&&input.limit!==1))
    throw new TypeError('unapproved read-only Render service');
}
async function safeJsonResponse(response){
  if(response?.status!==200||response?.redirected===true
    ||!HEADER_JSON.test(response?.headers?.get?.('content-type')??''))
    throw Error('provider_read_unverified');
  const header=response.headers?.get?.('content-length');
  if(header!==null && header!==undefined && /^\d+$/u.test(header)
    &&Number(header)>MAX_RESPONSE_BYTES)throw Error('provider_response_too_large');
  if(!response.body||typeof response.body.getReader!=='function')
    throw Error('provider_response_invalid');
  const reader=response.body.getReader(),chunks=[];
  let bytes=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error('provider_response_invalid');
      bytes+=value.byteLength;
      if(bytes>MAX_RESPONSE_BYTES)throw Error('provider_response_too_large');
      chunks.push(value);
    }
  }finally{try{await reader.cancel()}catch{/* No output from cancellation. */}}
  const b=new Uint8Array(bytes);
  let offset=0;
  for(const chunk of chunks){b.set(chunk,offset);offset+=chunk.byteLength}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b))}
  catch{throw Error('provider_response_invalid')}
}
function requireSha(value){
  if(typeof value!=='string'||!SHA.test(value))throw Error('provider_response_invalid');
  return value;
}
function providerService(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('provider_response_invalid');
  const details=raw.serviceDetails;
  return {
    id:raw.id,name:raw.name,repo:raw.repo,branch:raw.branch,
    suspended:raw.suspended,autoDeploy:raw.autoDeploy,
    autoDeployTrigger:raw.autoDeployTrigger,
    serviceDetails:details&&typeof details==='object'&&!Array.isArray(details)
      ?{url:details.url,runtime:details.runtime,plan:details.plan}:null
  };
}
function providerDeployments(raw){
  if(!Array.isArray(raw)||raw.length!==1||!raw[0]||typeof raw[0]!=='object'
    ||!raw[0].deploy||typeof raw[0].deploy!=='object')
    throw Error('provider_response_invalid');
  const deploy=raw[0].deploy;
  if(typeof deploy.id!=='string'||typeof deploy.status!=='string')
    throw Error('provider_response_invalid');
  return [{id:deploy.id,status:deploy.status,commit:{id:requireSha(deploy.commit?.id)}}];
}

/**
 * Secrets stay in closure, never returned. Caller must provide credentials
 * through its approved server-side custody, not user-visible text or query.
 */
export function createSmallzProviderReaders({renderApiToken,githubApiToken,fetchImpl=globalThis.fetch}={}){
  const renderToken=privateCredential(renderApiToken);
  const githubToken=privateCredential(githubApiToken);
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required');
  async function get(url,token){
    let response;
    try{
      response=await fetchImpl(url,{
        method:'GET',redirect:'error',cache:'no-store',credentials:'omit',
        referrerPolicy:'no-referrer',
        headers:{accept:'application/json',authorization:'Bearer '+token},
        signal:AbortSignal.timeout(4000)
      });
    }catch{throw Error('provider_read_unverified')}
    return safeJsonResponse(response);
  }
  return Object.freeze({
    async githubRead(args){
      assertGitHubArgs(args);
      const raw=await get(GITHUB,githubToken);
      if(raw?.ref!=='refs/heads/main')throw Error('provider_response_invalid');
      const sha=requireSha(raw?.object?.sha);
      return {result:{content:JSON.stringify({ref:'refs/heads/main',object:{sha}})}};
    },
    async renderServiceRead(args){
      assertRenderArgs(args);
      const raw=await get(RENDER,renderToken);
      return {text:JSON.stringify(providerService(raw))};
    },
    async renderDeployRead(args){
      assertRenderArgs(args,true);
      const raw=await get(DEPLOYS,renderToken);
      return {text:JSON.stringify(providerDeployments(raw))};
    }
  });
}
