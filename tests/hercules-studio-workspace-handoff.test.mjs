import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

const source=await readFile(new URL('../supabase/functions/hercules-launch/studio-access.ts',import.meta.url),'utf8');
globalThis.__studioHandoffClient=()=>({auth:{getUser:async()=>({data:{user:{id:'fixture-user',email:'buyer@example.test'}},error:null})},rpc:async()=>({data:{ok:true,entitlement_id:'fixture-entitlement',organization_id:'fixture-org',product_code:'sauceapproved-studio'},error:null})});
const isolated=source.replace("import {createClient} from 'npm:@supabase/supabase-js@2';",'const createClient=globalThis.__studioHandoffClient;');
const {studioAccessPage,studioAccessClaim}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(isolated)).toString('base64'));
const ctx={U:'https://isolated.invalid',K:'fixture-public-key',S:'fixture-service-key'};
test('activation page handoff targets the existing hosted Studio rather than raw Edge HTML',async()=>{
 const html=await studioAccessPage(ctx).text();
 assert.match(html,/"studioUrl":"https:\/\/sauceapproved-studio\.onrender\.com\/"/);
 assert.doesNotMatch(html,/preview-sauceapproved-studio-global-20260928/);
});
test('successful verified claim returns the canonical hosted Studio destination',async()=>{
 const r=await studioAccessClaim(new Request('https://isolated.invalid',{headers:{authorization:'Bearer fixture-token'}}),ctx);
 assert.equal(r.status,200);assert.equal((await r.json()).studioUrl,'https://sauceapproved-studio.onrender.com/');
});
test('missing session still cannot receive a successful workspace handoff',async()=>{
 const r=await studioAccessClaim(new Request('https://isolated.invalid'),ctx);assert.equal(r.status,401);assert.equal((await r.json()).studioUrl,undefined);
});
