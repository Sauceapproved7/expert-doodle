import test from "node:test";
import assert from "node:assert/strict";
import {createStudioSystemRegistry, loadStudioSubsystemManifests} from "../sauceapproved-studio/system-registry/core.mjs";

test("registry loads concrete subsystem manifests without converting them into proof", async()=>{
 const registry=createStudioSystemRegistry();
 const loaded=await loadStudioSubsystemManifests(registry);
 assert.equal(loaded.length,registry.systems.length);
 for(const item of loaded){
  assert.equal(item.loaded,true);
  assert.equal(item.verified,false);
  assert.equal(item.currentEvidence,false);
  assert.ok(item.manifest);
  assert.equal(item.systemId.length>0,true);
 }
});
