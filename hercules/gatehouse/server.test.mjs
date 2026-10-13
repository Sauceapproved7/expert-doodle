import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";

async function withServer(config,fn){
 const server=createServer(config);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port;
 try{await fn(base)}finally{await new Promise(resolve=>server.close(resolve))}
}
test("public health is side-effect-free while private dashboard is locked",async()=>{
 await withServer({accessToken:"example-strong-owner-secret-not-production",probeUrls:[]},async base=>{
  const h=await fetch(base+"/health");
  assert.equal(h.status,200);
  const health=await h.json();
  assert.equal(health.productionAuthorized,false);
  const r=await fetch(base+"/api/dashboard");
  assert.equal(r.status,401);
  assert.equal(r.headers.get("cache-control"),"no-store");
 });
});
test("empty credential configuration blocks private APIs",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  const r=await fetch(base+"/api/dashboard");
  assert.equal(r.status,503);
 });
});
test("synthetic simulation rejects anonymous write and preserves production",async()=>{
 await withServer({accessToken:"dev-passphrase-only",probeUrls:[]},async base=>{
  const p=await fetch(base+"/api/simulate",{method:"POST",headers:{"content-type":"application/json"},body:'{"scenario":"success"}'});
  assert.equal(p.status,401);
  const login=await fetch(base+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:"dev-passphrase-only"})});
  assert.equal(login.status,200);
  const cookie=login.headers.get("set-cookie").split(";")[0];
  const ok=await fetch(base+"/api/simulate",{method:"POST",headers:{"content-type":"application/json","cookie":cookie},body:'{"scenario":"success"}'});
  assert.equal(ok.status,200);
  assert.equal((await ok.json()).moneyMoved,false);
 });
});
test("GET-only live probes do not grant launch or payment authority",async()=>{
 await withServer({accessToken:"dev-passphrase-only",probeUrls:[]},async base=>{
  const login=await fetch(base+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:"dev-passphrase-only"})});
  const cookie=login.headers.get("set-cookie").split(";")[0];
  const out=await fetch(base+"/api/dashboard",{headers:{cookie}});
  assert.equal(out.status,200);
  const dashboard=await out.json();
  assert.equal(dashboard.launch.productionAuthorized,false);
  assert.equal(dashboard.revenue.verifiedGrossCents,null);
  assert.equal(dashboard.probes.every(x=>x.status==="unknown"),true);
 });
});
test("no credential can be sent in a GET URL and unknown routes 404",async()=>{
 await withServer({accessToken:"dev-passphrase-only",probeUrls:[]},async base=>{
  const r=await fetch(base+"/api/dashboard?token=dev-passphrase-only");
  assert.equal(r.status,401);
  assert.equal((await fetch(base+"/api/anything-else")).status,404);
 });
});
