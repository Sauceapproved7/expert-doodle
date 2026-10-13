import test from "node:test";
import assert from "node:assert/strict";
import {mergeLocalSamples, listObservedTransitions, makeLocalArchive, LIMIT, RETENTION_DAYS} from "./local-archive.mjs";
const clock="2026-10-13T15:00:00.000Z";
const entry=(at,status="reachable",name="Hercules MCP")=>({sampledAt:at,signals:[{name,status,token:"forbidden",url:"https://secret"}],customer:"hidden"});

test("sanitizes public observations and drops every unknown or sensitive field",()=>{
 const result=mergeLocalSamples([],[{
  sampledAt:"2026-10-13T14:00:00.000Z",customer:"secret",
  signals:[{name:"Hercules MCP",status:"reachable",apiKey:"private"},{name:"Stripe",status:"healthy",payout:200},{name:"Smallz",status:"broken"}]
 }],clock);
 assert.deepEqual(result,[{sampledAt:"2026-10-13T14:00:00.000Z",signals:[{name:"Hercules MCP",status:"reachable"}]}]);
 assert.equal(JSON.stringify(result).includes("private"),false);
});
test("merges duplicate observations without inventing samples",()=>{
 const a=entry("2026-10-13T14:00:00.000Z");
 const b=entry("2026-10-13T14:00:00.000Z");
 const results=mergeLocalSamples([a],[b],clock);
 assert.equal(results.length,1);
});
test("rejects future, stale and invalid observations and bounds device storage",()=>{
 const newSamples=Array.from({length:850},(_,i)=>entry(new Date(Date.parse(clock)-(849-i)*60_000).toISOString()));
 const data=[...newSamples,entry("2026-09-01T12:00:00.000Z"),entry("2026-10-15T12:00:00.000Z"),entry("nonsense")];
 const merged=mergeLocalSamples([],data,clock);
 assert.equal(merged.length,LIMIT);
 assert.ok(merged.every(e=>Date.parse(e.sampledAt)<=Date.parse(clock)));
 assert.equal(RETENTION_DAYS,30);
});
test("does not infer continuous uptime and only reports observed transitions",()=>{
 const sampleA=entry("2026-10-13T13:00:00.000Z","reachable");
 const sampleB=entry("2026-10-13T14:00:00.000Z","unreachable");
 const merged=mergeLocalSamples([],[sampleB,sampleA],clock);
 const changes=listObservedTransitions(merged);
 assert.equal(changes.length,1);
 assert.deepEqual(changes[0],{name:"Hercules MCP",from:"reachable",to:"unreachable",sampledAt:"2026-10-13T14:00:00.000Z"});
});
test("archives explicitly say browser-only, unsigned, no revenue and no background guarantee",()=>{
 const result=makeLocalArchive([entry("2026-10-13T14:00:00.000Z")],clock);
 assert.equal(result.productionAuthorized,false);
 assert.equal(result.providerAttested,false);
 assert.equal(result.verifiedSales,null);
 assert.equal(result.continuousMonitoring,false);
 assert.equal(result.storage,"device-export");
 assert.equal(result.samples.length,1);
 assert.equal(JSON.stringify(result).includes("forbidden"),false);
});
