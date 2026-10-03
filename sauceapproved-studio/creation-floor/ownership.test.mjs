import test from "node:test";
import assert from "node:assert/strict";
import {createCreationFloorManifest} from "./core.mjs";

test("Creation Floor is Hercules-owned with no outside platform substitution",()=>{
 const m=createCreationFloorManifest();
 assert.equal(m.implementationOwner,"SauceApproved enterprise LLC");
 assert.equal(m.buildMode,"hercules-owned");
 assert.deepEqual(m.externalPlatforms,[]);
 assert.equal(m.thirdPartyHostedRuntimeAllowed,false);
 assert.equal(m.thirdPartyProductSubstitutionAllowed,false);
 for(const system of m.systems){
  assert.equal(system.herculesOwned,true);
  assert.equal(system.outsidePlatformAllowed,false);
 }
});
