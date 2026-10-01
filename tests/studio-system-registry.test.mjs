import test from "node:test";
import assert from "node:assert/strict";
import {createStudioSystemRegistry,evaluateStudioSystemRegistry} from "../sauceapproved-studio/system-registry/core.mjs";

test("registry includes the owned integrated Studio engines",()=>{
 const r=createStudioSystemRegistry();
 const ids=r.systems.map(x=>x.id);
 for(const id of ["creation-floor","creation-floor-production-ops","soundworld","soundworld-field-system","studio-infrastructure","studio-infrastructure-production","studio-memory-grid","studio-global-closure","hardware-engineering-program"]) assert.ok(ids.includes(id),id);
 assert.equal(r.implementationOwner,"SauceApproved enterprise LLC");
 assert.equal(r.externalPlatforms.length,0);
});
test("registry fails closed when evidence is missing",()=>{
 const x=evaluateStudioSystemRegistry(createStudioSystemRegistry(),{});
 assert.equal(x.ready,false);
 assert.equal(x.blockedSystemIds.length,9);
});
test("registry only opens systems with current verified fingerprinted evidence",()=>{
 const r=createStudioSystemRegistry();
 const evidence=Object.fromEntries(r.systems.map(s=>[s.id,{verified:true,current:true,artifactSha256:"a".repeat(64)}]));
 const x=evaluateStudioSystemRegistry(r,evidence);
 assert.equal(x.ready,true);
 assert.deepEqual(x.blockedSystemIds,[]);
 assert.equal(x.finalAuthority,"owner-controlled-release");
});
