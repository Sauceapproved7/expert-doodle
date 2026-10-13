import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
const OWNER_TOKEN="sample".repeat(8);

async function withServer(config,fn){
 const server=createServer(config);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port;
 try{await fn(base)}finally{await new Promise(resolve=>server.close(resolve))}
}
test("public health is side-effect-free while private dashboard is locked",async()=>{
 await withServer({accessToken:OWNER_TOKEN,probeUrls:[]},async base=>{
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
 await withServer({accessToken:OWNER_TOKEN,probeUrls:[]},async base=>{
  const p=await fetch(base+"/api/simulate",{method:"POST",headers:{"content-type":"application/json"},body:'{"scenario":"success"}'});
  assert.equal(p.status,401);
  const login=await fetch(base+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:OWNER_TOKEN})});
  assert.equal(login.status,200);
  const cookie=login.headers.get("set-cookie").split(";")[0];
  const ok=await fetch(base+"/api/simulate",{method:"POST",headers:{"content-type":"application/json","cookie":cookie},body:'{"scenario":"success"}'});
  assert.equal(ok.status,200);
  assert.equal((await ok.json()).moneyMoved,false);
 });
});
test("GET-only live probes do not grant launch or payment authority",async()=>{
 await withServer({accessToken:OWNER_TOKEN,probeUrls:[]},async base=>{
  const login=await fetch(base+"/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:OWNER_TOKEN})});
  const cookie=login.headers.get("set-cookie").split(";")[0];
  const out=await fetch(base+"/api/dashboard",{headers:{cookie}});
  assert.equal(out.status,200);
  const dashboard=await out.json();
  assert.equal(dashboard.launch.productionAuthorized,false);
  assert.equal(dashboard.revenue.verifiedGrossCents,null);
  assert.equal(dashboard.signals.every(x=>x.status==="unknown"),true);
 });
});
test("no credential can be sent in a GET URL and unknown routes 404",async()=>{
 await withServer({accessToken:OWNER_TOKEN,probeUrls:[]},async base=>{
  const r=await fetch(base+"/api/dashboard?token="+OWNER_TOKEN);
  assert.equal(r.status,401);
  assert.equal((await fetch(base+"/api/anything-else")).status,404);
 });
});

test("public summary exposes only bounded public reachability, never private data",async()=>{
 const calls=[];
 await withServer({
  accessToken:"",probeUrls:[{name:"Hercules MCP",url:"https://hercules-mcp.onrender.com/health"}],
  fetcher:async (url,options)=>{calls.push({url:String(url),options});return {status:200}}
 },async base=>{
  const r=await fetch(base+"/api/public-summary");
  assert.equal(r.status,200);
  const json=await r.json();
  assert.equal(json.productionAuthorized,false);
  assert.equal(json.moneyMoved,false);
  assert.equal(json.mode,"public-connectivity-only");
  assert.deepEqual(json.signals.map(s=>s.name),["Hercules MCP"]);
  assert.equal(json.signals[0].status,"reachable");
  assert.equal(json.authoritative,false);
  assert.equal(JSON.stringify(json).includes("onrender.com"),false);
  assert.deepEqual(calls.map(c=>c.options.method),["GET"]);
 });
});
test("public summary caches probes and never causes repeated upstream hits during refresh",async()=>{
 let hits=0;
 await withServer({
  accessToken:"",probeUrls:[{name:"Studio",url:"https://sauceapproved-studio.onrender.com/health"}],
  fetcher:async()=>{hits++;return {status:200}}
 },async base=>{
  const a=await fetch(base+"/api/public-summary");
  const b=await fetch(base+"/api/public-summary");
  assert.equal(a.status,200);
  assert.equal(b.status,200);
  assert.equal(hits,1);
 });
});
test("public summary is GET-only and never bypasses private dashboard",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  assert.equal((await fetch(base+"/api/public-summary",{method:"POST"})).status,405);
  assert.equal((await fetch(base+"/api/dashboard")).status,503);
 });
});
