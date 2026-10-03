import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesAbyssAdapters} from "../hercules-bot/abyss-adapters.mjs";

const calls=[];
const boundary={
 emergencyStopClear:()=>true,
 assessTrust:()=>({identityTrusted:true,auditTrusted:true}),
 authorizeOperation:()=>true,
 authorizeContainment:()=>true,
 verifyRecoveryArtifact:artifact=>artifact?.digest==="sha256:trusted",
 browser:async x=>(calls.push(["browser",x]),{ok:true}),
 vault:async x=>(calls.push(["vault",x]),{ok:true}),
 forge:async x=>(calls.push(["forge",x]),{ok:true}),
 deploy:async x=>(calls.push(["deploy",x]),{ok:true}),
 containment:async x=>(calls.push(["containment",x]),{ok:true}),
 recovery:async x=>(calls.push(["recovery",x]),{ok:true}),
};
const a=createHerculesAbyssAdapters(boundary);

test("browser and vault invoke bounded services only after external authorization",async()=>{
 await a.browser({action:"scrape",url:"https://example.com"});
 await a.vault({action:"search",query:"release"});
 assert.equal(calls.at(-2)[0],"browser");assert.equal(calls.at(-1)[0],"vault");
});
test("missing trust, stopped state, or denied authorization prevents invocation",async()=>{
 for(const overrides of [{assessTrust:()=>({identityTrusted:false,auditTrusted:true})},{emergencyStopClear:()=>false},{authorizeOperation:()=>false}]){
  const denied=createHerculesAbyssAdapters({...boundary,...overrides});
  await assert.rejects(()=>denied.deploy({action:"status",deploymentId:"abc"}),/external identity/);
 }
});
test("deploy adapter remains diagnostics-only",async()=>{
 await a.deploy({action:"status",deploymentId:"abc"});
 await assert.rejects(()=>a.deploy({action:"publish",deploymentId:"abc"}),/deploy mutation denied/);
});
test("forge build is preview-only and externally authorized",async()=>{
 await a.forge({action:"build",target:"demo",preview:true});
 await assert.rejects(()=>a.forge({action:"build",target:"demo",preview:false}),/preview required/);
});
test("containment uses a distinct external authorization boundary",async()=>{
 await a.contain({action:"freeze-deployments",reason:"security-event"});
 const denied=createHerculesAbyssAdapters({...boundary,authorizeContainment:()=>false});
 await assert.rejects(()=>denied.contain({action:"freeze-deployments"}),/external identity/);
 await assert.rejects(()=>a.contain({action:"disable-audit"}),/containment action denied/);
});
test("recovery requires external signature verification, never caller booleans",async()=>{
 await a.recover({artifact:{digest:"sha256:trusted"},signed:true,knownGood:true});
 await assert.rejects(()=>a.recover({artifact:{digest:"sha256:fake"},signed:true,knownGood:true}),/externally verified/);
 const flags=createHerculesAbyssAdapters({...boundary,verifyRecoveryArtifact:()=>false});
 await assert.rejects(()=>flags.recover({signed:true,knownGood:true}),/externally verified/);
});
test("credential-shaped fields and values are rejected recursively before invocation",async()=>{
 for(const input of [
  {action:"search",query:"x",token:"secret"},
  {action:"search",metadata:{nested:{api_key:"secret"}}},
  {action:"search",query:"Bearer abc.def.ghi"},
  {action:"search",items:["prefix "+"ghp_"+"a".repeat(40)]},
 ]) await assert.rejects(()=>a.vault(input),/credential/);
});

test("credential-shaped service responses are rejected before returning to callers",async()=>{
 const leaking=createHerculesAbyssAdapters({...boundary,browser:async()=>(calls.push(["leaking-browser"]),{accessToken:"not-for-caller"})});
 await assert.rejects(()=>leaking.browser({action:"screenshot"}),/credential field rejected/);
});
