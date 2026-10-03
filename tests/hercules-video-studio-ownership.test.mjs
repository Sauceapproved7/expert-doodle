import test from "node:test";
import assert from "node:assert/strict";
import {createStudioManifest} from "../hercules-video/studio-contract.mjs";

test("every SauceApproved Studio surface is Hercules-owned",()=>{
 const m=createStudioManifest();
 assert.equal(m.implementationOwner,"SauceApproved enterprise LLC");
 assert.equal(m.buildMode,"hercules-owned");
 assert.deepEqual(m.externalPlatforms,[]);
 assert.equal(m.thirdPartyHostedRuntimeAllowed,false);
 assert.equal(m.thirdPartyProductSubstitutionAllowed,false);
 assert.ok(m.surfaces.length>=26);
 for(const surface of m.surfaces){
  assert.equal(surface.herculesOwned,true);
  assert.equal(surface.outsidePlatformAllowed,false);
 }
});
