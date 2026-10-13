import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {studioActivation} from '../hercules-video/studio-activation.mjs';
import {createStudioHttpHandler} from '../hercules-video/studio-server.mjs';
const origin='https://sauceapproved-studio.onrender.com';
const request={method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer fixture-token'},body:JSON.stringify({action:'titan_purchase_claim'})};
test('hosted callback routes authenticated Titan claims to the product-specific backend',async()=>{
 let called=false;const r=await studioActivation(request,{fetchUpstream:async(u,o)=>{called=true;assert.match(u,/\?titan_access=1$/);assert.deepEqual(JSON.parse(o.body),{action:'titan_purchase_claim'});return Response.json({ok:true});}});assert.equal(r.status,200);assert.ok(called);
});
test('Titan callback rejects cross-origin or missing bearer before contacting backend',async()=>{
 for(const headers of [{...request.headers,origin:'https://evil.invalid'},{origin,'content-type':'application/json'}]){
 const r=await studioActivation({...request,headers},{fetchUpstream:()=>{throw Error('must not fetch');}});assert.ok([401,403].includes(r.status));}
});
test('hosted Titan workspace renders only the canonical main Hercules page',async()=>{
 const handler=createStudioHttpHandler({activationFetch:async u=>{assert.equal(u,'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch');return new Response('<!doctype html><title>Hercules Revenue Recovery by SauceApproved</title>');}});
 const r=await handler({method:'GET',pathname:'/titan'});assert.equal(r.status,200);assert.match(r.headers['content-type'],/text\/html/);
});
test('workspace proxy refuses unknown actions and foreign origin',async()=>{
 const handler=createStudioHttpHandler({activationFetch:()=>{throw Error('must not fetch');}});
 for(const req of [{...request,body:JSON.stringify({action:'enable_commerce'})},{...request,headers:{...request.headers,origin:'https://evil.invalid'}}]){
 const r=await handler({...req,pathname:'/titan'});assert.ok([400,403].includes(r.status));}
});
test('Titan claims return the hosted workspace and OTP uses the already-saved callback',async()=>{
 const source=await readFile(new URL('../supabase/functions/hercules-launch/titan-access.ts',import.meta.url),'utf8');
 globalThis.__titanHostedClient=()=>({auth:{getUser:async()=>({data:{user:{id:'fixture-user',email:'buyer@example.test'}}})},rpc:async()=>({data:{ok:true,product_code:'hercules-titan-founding-access'}})});
 const isolated=source.replace("import {createClient} from 'npm:@supabase/supabase-js@2';",'const createClient=globalThis.__titanHostedClient;');
 const {titanAccessClaim}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(isolated)).toString('base64'));
 const r=await titanAccessClaim(new Request('https://isolated.invalid',{headers:request.headers}),{U:'https://isolated.invalid',K:'fixture',S:'fixture'});
 assert.equal((await r.json()).titanUrl,origin+'/titan');assert.match(source,/emailRedirectTo:'https:\/\/sauceapproved-studio\.onrender\.com\/activate'/);
});
test('shared hosted activation handles Titan separately without granting Studio access',async()=>{
 const source=await readFile(new URL('../supabase/functions/hercules-launch/studio-access.ts',import.meta.url),'utf8');
 assert.match(source,/action:"titan_purchase_claim"/);assert.match(source,/x\.titanUrl/);
});
test('a Titan buyer falls back only after a Studio mismatch and receives only the Titan link',async()=>{
 const source=await readFile(new URL('../supabase/functions/hercules-launch/studio-access.ts',import.meta.url),'utf8');
 const script=source.split('<script type="module">')[1].split('</script>')[0].replace(/import\{createClient\}from[^;]+;/,'').replace('const cfg=${cfg}', 'const cfg={url:"https://isolated.invalid",key:"fixture",studioUrl:"https://studio.invalid"}');
 for(const first of [{status:409,error:'email_entitlement_mismatch'},{status:401,error:'authenticated_user_required'}]){
  const elements=Object.fromEntries(['state','request','open'].map(id=>[id,{classList:{add(){},remove(){}},addEventListener(){}}]));const calls=[];
  const context=vm.createContext({createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture-token'}}})}}),document:{getElementById:id=>elements[id]},location:{pathname:'/activate',search:''},history:{replaceState(){}},fetch:async(_u,o)=>{calls.push(JSON.parse(o.body).action);return calls.length===1?{status:first.status,ok:false,json:async()=>({ok:false,error:first.error})}:{status:200,ok:true,json:async()=>({ok:true,titanUrl:origin+'/titan'})};}});
  await vm.runInContext('(async()=>{'+script+'})()',context);
  assert.deepEqual(calls,first.status===409?['studio_purchase_claim','titan_purchase_claim']:['studio_purchase_claim']);
  assert.equal(elements.open.href,first.status===409?origin+'/titan':undefined);
 }
});
test('workspace forwards bounded JSON only to the fixed main backend and drops cookies',async()=>{
 const handler=createStudioHttpHandler({activationFetch:async(u,o)=>{assert.equal(u,'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch');assert.equal(o.headers.cookie,undefined);assert.equal(o.headers.authorization,'Bearer fixture-token');return Response.json({error:'public_registration_closed'},{status:403});}});
 const r=await handler({...request,pathname:'/titan',headers:{...request.headers,cookie:'private'},body:JSON.stringify({action:'secure_signup',email:'fixture@example.test'})});assert.equal(r.status,403);
});
test('workspace rejects redirects, unexpected markup, and excessive data',async()=>{
 for(const response of [new Response('other'),new Response('redirect',{status:302}),new Response('x'.repeat(262145))]){
 const handler=createStudioHttpHandler({activationFetch:async()=>response});assert.equal((await handler({method:'GET',pathname:'/titan'})).status,502);}
});
