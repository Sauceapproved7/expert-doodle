import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesAbyssAdapters} from "../hercules-bot/abyss-adapters.mjs";

const calls=[];
const a=createHerculesAbyssAdapters({
 browser:async x=>(calls.push(["browser",x]),{ok:true}),
 vault:async x=>(calls.push(["vault",x]),{ok:true}),
 forge:async x=>(calls.push(["forge",x]),{ok:true}),
 deploy:async x=>(calls.push(["deploy",x]),{ok:true}),
 containment:async x=>(calls.push(["containment",x]),{ok:true}),
 recovery:async x=>(calls.push(["recovery",x]),{ok:true}),
});

test("browser and vault use bounded server-side adapters",async()=>{
 await a.browser({action:"scrape",url:"https://example.com"});
 await a.vault({action:"search",query:"release"});
 assert.equal(calls.at(-2)[0],"browser"); assert.equal(calls.at(-1)[0],"vault");
});
test("deploy adapter is diagnostics-only",async()=>{
 await a.deploy({action:"status",deploymentId:"abc"});
 await assert.rejects(()=>a.deploy({action:"publish",deploymentId:"abc"}),/deploy mutation denied/);
});
test("forge build is preview-only",async()=>{
 await a.forge({action:"build",target:"demo",preview:true});
 await assert.rejects(()=>a.forge({action:"build",target:"demo",preview:false}),/preview required/);
});
test("containment exposes only independent defensive controls",async()=>{
 await a.contain({action:"freeze-deployments",reason:"security-event"});
 await assert.rejects(()=>a.contain({action:"disable-audit"}),/containment action denied/);
});
test("recovery requires signed known-good evidence",async()=>{
 await a.recover({artifact:"sha256:abc",signed:true,knownGood:true});
 await assert.rejects(()=>a.recover({artifact:"sha256:abc",signed:false,knownGood:true}),/signed known-good artifact required/);
});
test("credential-shaped fields are rejected at every adapter boundary",async()=>{
 await assert.rejects(()=>a.vault({action:"search",query:"x",token:"secret"}),/credential field rejected/);
});
