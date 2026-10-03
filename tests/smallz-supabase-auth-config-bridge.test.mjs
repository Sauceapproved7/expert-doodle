import test from "node:test";
import assert from "node:assert/strict";
import {createSupabaseAuthConfigBridge} from "../hercules-bot/supabase-auth-config-bridge.mjs";

test("fails closed when management authority is absent",async()=>{
 const bridge=createSupabaseAuthConfigBridge({projectRef:"xbwuablxhhwsaoomsoco",managementToken:""});
 await assert.rejects(()=>bridge.configureSmallz(),/management-authority-required/);
});

test("patches only Smallz site and redirect configuration",async()=>{
 let seen;
 const bridge=createSupabaseAuthConfigBridge({
  projectRef:"xbwuablxhhwsaoomsoco",
  managementToken:"server-secret",
  request:async input=>{seen=input;return {ok:true,status:200,json:async()=>({site_url:input.body.site_url,uri_allow_list:input.body.uri_allow_list})};}
 });
 const result=await bridge.configureSmallz();
 assert.equal(seen.method,"PATCH");
 assert.equal(seen.url,"https://api.supabase.com/v1/projects/xbwuablxhhwsaoomsoco/config/auth");
 assert.deepEqual(seen.body,{site_url:"https://smallz-hercules.onrender.com",uri_allow_list:"https://smallz-hercules.onrender.com/app"});
 assert.equal(seen.authorization,"Bearer server-secret");
 assert.equal(result.ok,true);
});

test("rejects credential-bearing caller input",async()=>{
 const bridge=createSupabaseAuthConfigBridge({projectRef:"xbwuablxhhwsaoomsoco",managementToken:"server-secret"});
 await assert.rejects(()=>bridge.configureSmallz({token:"caller-secret"}),/credential-fields-rejected/);
});
