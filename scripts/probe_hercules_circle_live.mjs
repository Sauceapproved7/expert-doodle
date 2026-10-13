// Read-only live proof for the Hercules Founding Circle.
// All POSTs send p_consent:false and p_email:null. This cannot retain a subscriber.
// No owner credentials, SMTP, or service-role privileges are used.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const STATIC_ORIGIN='https://hercules-owned-circle-free.onrender.com';
const DB_ORIGIN='https://xbwuablxhhwsaoomsoco.supabase.co';
const PAGES=Object.freeze([
 ['/', ['HERCULES','FOUNDING CIRCLE']],
 ['/early.html',['EARLY TESTER INTEREST','consent']],
 ['/owner.html',['OWNER VAULT','Existing owner identity only']],
 ['/app.mjs',['hercules_cloud_join_founders']],
 ['/early.mjs',['hercules_circle_request_early']],
 ['/owner.mjs',['hercules_circle_owner_acl']],
 ['/circle-access.css',['.owner-wrap']],
 ['/verify.html',['Email confirmation is not active yet','No email address has been verified']],
 ['/verify.mjs',['history.replaceState','Never read, store or submit']]
]);
function gate(ok,code){if(!ok)throw Error(code)}
export function readCirclePublishableKey(source){
 gate(typeof source==='string','publishable_key_missing');
 const match=source.match(/const publishableKey\s*=\s*['"](sb_publishable_[a-zA-Z0-9_-]{15,100})['"]/);
 gate(Boolean(match),'publishable_key_missing');
 return match[1];
}
function sameResponseOrigin(actual,wanted){
 return actual==='*'||actual===wanted;
}
async function fetchOne(fetchImpl,url,options){
 const r=await fetchImpl(url,{
  mode:'cors',
  redirect:'error',
  credentials:'omit',
  cache:'no-store',
  signal:AbortSignal.timeout(12000),
  ...options
 });
 return r;
}
export async function probeCirclePublic({
 fetchImpl=fetch,
 publishableKey,
 origin=STATIC_ORIGIN,
 projectBase=DB_ORIGIN
}={}){
 gate(origin===STATIC_ORIGIN&&projectBase===DB_ORIGIN,'origin_not_allowlisted');
 gate(typeof fetchImpl==='function','invalid_fetcher');
 gate(typeof publishableKey==='string'&&/^sb_publishable_[a-zA-Z0-9_-]{15,100}$/.test(publishableKey),'publishable_key_missing');
 // Verify hosted pages before any API request.
 const assets=await Promise.all(PAGES.map(async([path,markers])=>{
  const r=await fetchOne(fetchImpl,origin+path,{method:'GET'});
  gate(r.status===200,'live_asset_unavailable:'+path);
  const data=await r.text();
  gate(data.length>=25&&data.length<=300000&&markers.every(x=>data.includes(x)),'live_asset_invalid:'+path);
  return path;
 }));
 // Explicit browser-equivalent CORS preflight; an OPTIONS request never creates subscribers.
 const preflight=await fetchOne(fetchImpl,projectBase+'/rest/v1/rpc/hercules_circle_request_early',{
  method:'OPTIONS',
  headers:{
   Origin:origin,
   'Access-Control-Request-Method':'POST',
   'Access-Control-Request-Headers':'apikey,content-type'
  }
 });
 gate(preflight.ok,'cors_preflight_unavailable');
 gate(sameResponseOrigin(preflight.headers.get('access-control-allow-origin'),origin),'cors_origin_denied');
 const methods=preflight.headers.get('access-control-allow-methods')??'';
 const allowHeaders=preflight.headers.get('access-control-allow-headers')??'';
 gate(methods.toUpperCase().includes('POST')&&allowHeaders.toLowerCase().includes('apikey')&&allowHeaders.toLowerCase().includes('content-type'),'cors_preflight_incomplete');
 // Public users must not be able to enumerate emails or owner ACL entries.
 const tables=['hercules_circle_early_requests','hercules_circle_owner_acl'];
 for(const table of tables){
  const r=await fetchOne(fetchImpl,projectBase+'/rest/v1/'+table+'?select=*&limit=1',{
   method:'GET',headers:{apikey:publishableKey,accept:'application/json',Origin:origin}
  });
  gate(r.status===401||r.status===403,'public_subscriber_read_exposed:'+table);
 }
 const rpcs=[
  {
   name:'hercules_cloud_join_founders',
   body:{p_email:null,p_consent:false,p_interest:'both',p_website:''}
  },
  {
   name:'hercules_circle_request_early',
   body:{p_email:null,p_consent:false,p_use_case:'software',p_project_stage:'idea',p_website:''}
  }
 ];
 for(const rpc of rpcs){
  const r=await fetchOne(fetchImpl,projectBase+'/rest/v1/rpc/'+rpc.name,{
   method:'POST',
   headers:{apikey:publishableKey,'content-type':'application/json',Origin:origin},
   body:JSON.stringify(rpc.body)
  });
  gate(r.status===200,'rpc_unavailable:'+rpc.name);
  let value;
  try{value=await r.json()}catch{throw Error('rpc_unexpected_response:'+rpc.name)}
  gate(value?.ok===false&&value.error==='consent_required','consent_bypass_detected:'+rpc.name);
 }
 return Object.freeze({
  allPassed:true,
  checkedPages:assets.length,
  corsPreflightPassed:true,
  privilegedTablesDenied:tables.length,
  consentFailuresRejected:rpcs.length,
  syntheticSubmissionsCreated:0,
  ownerLoginVerified:false,
  emailReceiptVerified:false,
  paymentEnabled:false,
  note:'GET/OPTIONS + negative consent only. No real signup, email or identity was tested.'
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const source=await readFile(new URL('../hercules-deploy/owned-circle/free-site/app.mjs',import.meta.url),'utf8');
 const key=readCirclePublishableKey(source);
 try{
  const receipt=await probeCirclePublic({publishableKey:key});
  process.stdout.write(JSON.stringify(receipt)+'\n');
 }catch(error){
  process.stderr.write(JSON.stringify({allPassed:false,reason:String(error.message??'unknown').slice(0,100)})+'\n');
  process.exitCode=1;
 }
}
