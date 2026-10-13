import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {studioActivation} from '../hercules-video/studio-activation.mjs';
import {createStudioHttpHandler} from '../hercules-video/studio-server.mjs';
const origin='https://sauceapproved-studio.onrender.com';
const page='<!doctype html><html><title>SauceApproved Studio Access</title><script>studio_purchase_claim</script></html>';
const req={method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer fixture-token'},body:JSON.stringify({action:'studio_purchase_claim'})};
test('hosted activation renders the trusted upstream page as HTML',async()=>{
 let target,options;const r=await studioActivation({method:'GET'},{fetchUpstream:async(u,o)=>{target=u;options=o;return new Response(page,{headers:{'content-type':'text/plain'}});}});
 assert.equal(r.status,200);assert.match(r.headers['content-type'],/text\/html/);assert.equal(r.body,page);
 assert.equal(target,'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?studio_access=1');assert.equal(options.redirect,'error');assert.match(r.headers['content-security-policy'],/connect-src 'self'/);
});
test('claim forwards only bounded action and bearer to fixed backend',async()=>{
 const r=await studioActivation({...req,headers:{...req.headers,cookie:'private', 'x-api-key':'secret'}},{fetchUpstream:async(u,o)=>{assert.equal(o.headers.authorization,'Bearer fixture-token');assert.equal(o.headers.cookie,undefined);assert.equal(o.headers['x-api-key'],undefined);assert.deepEqual(JSON.parse(o.body),{action:'studio_purchase_claim'});return Response.json({ok:false,error:'email_entitlement_mismatch'},{status:409});}});
 assert.equal(r.status,409);assert.equal(JSON.parse(r.body).error,'email_entitlement_mismatch');
});
test('cross-origin and unsupported actions reject before upstream access',async()=>{
 for(const r of [{...req,headers:{...req.headers,origin:'https://evil.invalid'}},{...req,body:JSON.stringify({action:'enable_commerce'})},{...req,body:'{broken'},{...req,body:'x'.repeat(4097)},{...req,method:'DELETE'}]){
 const result=await studioActivation(r,{fetchUpstream:()=>{throw Error('must not contact upstream');}});assert.ok([400,403,405,413].includes(result.status));
 }
});
test('missing claim token rejects locally',async()=>{const r=await studioActivation({...req,headers:{origin,'content-type':'application/json'}});assert.equal(r.status,401);});
test('access request forwards only email and exact action',async()=>{
 const r=await studioActivation({...req,body:JSON.stringify({action:'studio_access_request',email:'buyer@example.test',redirectTo:'https://evil.invalid'})},{fetchUpstream:async(u,o)=>{assert.deepEqual(JSON.parse(o.body),{action:'studio_access_request',email:'buyer@example.test'});assert.equal(o.headers.authorization,undefined);return Response.json({ok:true});}});assert.equal(r.status,200);
});
test('unexpected upstream markup, redirects, and oversized response fail closed',async()=>{
 for(const response of [new Response('<html>other</html>'),new Response(page,{status:302}),new Response(page+'x'.repeat(262145))]){
 const r=await studioActivation({method:'GET'},{fetchUpstream:async()=>response});assert.equal(r.status,502);
 }
});
test('Studio HTTP handler exposes activation without operator or checkout changes',async()=>{
 const handler=createStudioHttpHandler({activationFetch:async()=>new Response(page)});
 const r=await handler({method:'GET',pathname:'/activate?studio_access=1'});assert.equal(r.status,200);assert.match(r.headers['content-type'],/text\/html/);
});
test('sign-in callback uses the owned rendered activation host',async()=>{
 const source=await readFile(new URL('../supabase/functions/hercules-launch/studio-access.ts',import.meta.url),'utf8');
 assert.match(source,/emailRedirectTo:'https:\/\/sauceapproved-studio\.onrender\.com\/activate'/);
});
