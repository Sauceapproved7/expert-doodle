import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHerculesBotApp} from "../hercules-bot/app-server.mjs";

test("Smallz app server is valid Render-ready source",async()=>{
 const src=await readFile(new URL("../hercules-bot/app-server.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(src,/\\\\n/);
 assert.match(src,/process\.env\.PORT/);
 assert.match(src,/server\.listen\(port,"0\.0\.0\.0"/);
 assert.match(src,/createSmallzOwnerBridge/);
 assert.match(src,/createSmallzRequestAuth/);
 assert.match(src,/url==="\/api\/browser"/);
 const html=await readFile(new URL("../hercules-bot/index.html",import.meta.url),"utf8");
 assert.doesNotMatch(html,/HERCULES_BROWSER_BRIDGE_TOKEN|HERCULES_DEPLOY_CONTROL_TOKEN/);
});


test("public config exposes only publishable auth settings and protected routes reject anonymous access",async()=>{
 const names=["SUPABASE_PUBLIC_URL","SUPABASE_PUBLISHABLE_KEY","HERCULES_BROWSER_BRIDGE_TOKEN"];
 const saved=names.map(name=>process.env[name]);
 try{
  process.env.SUPABASE_PUBLIC_URL="https://auth.example";
  process.env.SUPABASE_PUBLISHABLE_KEY="public-test-key";
  process.env.HERCULES_BROWSER_BRIDGE_TOKEN="private-test-sentinel";
  const app=createHerculesBotApp({boundary:{authenticateOwner:async()=>{throw Object.assign(new Error("denied"),{statusCode:401})}}});
  const config=await app.handle({method:"GET",url:"/api/auth-config"});
  assert.deepEqual(config.body,{url:"https://auth.example",key:"public-test-key"});
  for(const url of ["/api/state","/api/browser","/api/command","/api/approve","/api/resume"]){
   const result=await app.handle({method:url==="/api/state"?"GET":"POST",url,body:{}});
   assert.equal(result.status,401,url);
   assert.equal(JSON.stringify(result).includes("private-test-sentinel"),false);
  }
 }finally{names.forEach((name,i)=>saved[i]===undefined?delete process.env[name]:process.env[name]=saved[i])}
});
