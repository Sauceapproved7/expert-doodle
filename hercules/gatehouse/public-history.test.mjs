import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "./server.mjs";
import {verifyEvidenceLedger} from "./core.mjs";

async function withServer(config, fn){
 const server=createServer(config);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port;
 try{await fn(base)}finally{await new Promise(resolve=>server.close(resolve))}
}
const targets=[
 {name:"Hercules MCP",url:"https://hercules-mcp.onrender.com/health"},
 {name:"Smallz",url:"https://smallz-hercules.onrender.com/health"}
];

test("public observation history begins empty and never implies a continuous monitor",async()=>{
 await withServer({accessToken:"",probeUrls:targets,fetcher:async()=>({status:200})},async base=>{
  const r=await fetch(base+"/api/public-history");
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.sampleCount,0);
  assert.equal(body.continuousMonitoring,false);
  assert.equal(body.authoritative,false);
  assert.deepEqual(body.samples,[]);
 });
});
test("one cached probe produces one bounded, sanitized observation",async()=>{
 let calls=0;
 await withServer({accessToken:"",probeUrls:targets,fetcher:async()=>{calls++;return {status:200}}},async base=>{
  await fetch(base+"/api/public-summary");
  await fetch(base+"/api/public-summary");
  const history=await (await fetch(base+"/api/public-history")).json();
  assert.equal(history.sampleCount,1);
  assert.equal(calls,2);
  assert.equal(history.samples[0].signals.length,2);
  assert.equal(history.samples[0].signals[0].status,"reachable");
  assert.equal(JSON.stringify(history).includes("https://"),false);
  assert.equal(JSON.stringify(history).includes("access_token"),false);
 });
});
test("portable capsule has a verifiable hash chain and is download-only",async()=>{
 await withServer({accessToken:"",probeUrls:targets,fetcher:async()=>({status:503})},async base=>{
  await fetch(base+"/api/public-summary");
  const response=await fetch(base+"/api/public-evidence");
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-disposition"),/attachment; filename=/);
  assert.equal(response.headers.get("cache-control"),"no-store");
  const body=await response.json();
  assert.equal(body.scope,"public-connectivity-only");
  assert.equal(body.persistence,"download-required");
  assert.equal(body.providerAttested,false);
  assert.equal(body.productionAuthorized,false);
  assert.equal(verifyEvidenceLedger(body.entries).ok,true);
  assert.equal(body.integrity.count,2);
  assert.equal(body.entries[0].record.state,"unreachable");
  assert.equal(JSON.stringify(body).includes("onrender.com"),false);
 });
});
test("sample retention is explicitly bounded and does not count duplicates in a cached window",async()=>{
 await withServer({
  accessToken:"",probeUrls:[targets[0]],cacheTtlMs:0,
  fetcher:async()=>({status:200})
 },async base=>{
  for(let i=0;i<125;i++)await fetch(base+"/api/public-summary");
  const body=await(await fetch(base+"/api/public-history")).json();
  assert.equal(body.sampleCount,120);
  assert.equal(body.truncated,true);
  assert.equal(body.authoritative,false);
 });
});
test("public history and export only accept GET and never grant owner permissions",async()=>{
 await withServer({accessToken:"",probeUrls:[]},async base=>{
  assert.equal((await fetch(base+"/api/public-history",{method:"POST"})).status,405);
  assert.equal((await fetch(base+"/api/public-evidence",{method:"POST"})).status,405);
  assert.equal((await fetch(base+"/api/dashboard")).status,503);
  assert.equal((await fetch(base+"/api/ledger")).status,503);
 });
});
