import test from "node:test";
import assert from "node:assert/strict";
import {createSoundWorldFamily} from "./product-family.mjs";

test("SoundWorld 1-12 is Hercules-owned with no finished outside product substitution",()=>{
 const m=createSoundWorldFamily();
 assert.equal(m.implementationOwner,"SauceApproved enterprise LLC");
 assert.equal(m.buildMode,"hercules-owned");
 assert.deepEqual(m.externalPlatforms,[]);
 assert.equal(m.thirdPartyHostedRuntimeAllowed,false);
 assert.equal(m.thirdPartyProductSubstitutionAllowed,false);
 for(const product of m.products){
  assert.equal(product.herculesOwned,true);
  assert.equal(product.outsidePlatformAllowed,false);
 }
});
