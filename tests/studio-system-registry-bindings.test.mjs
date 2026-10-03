import test from "node:test";
import assert from "node:assert/strict";
import {createStudioSystemRegistry} from "../sauceapproved-studio/system-registry/core.mjs";

test("registry binds each system to a concrete owned manifest export",()=>{
 const r=createStudioSystemRegistry();
 assert.equal(r.systems.length,9);
 for(const s of r.systems){
  assert.equal(typeof s.manifestExport,"string");
  assert.ok(s.manifestExport.length>0);
  assert.equal(s.herculesOwned,true);
 }
 assert.equal(r.releasePolicy.syntheticEvidenceAllowed,false);
});
