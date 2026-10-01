import test from "node:test";
import assert from "node:assert/strict";
import {createStudioOwnershipManifest} from "./ownership-contract.mjs";
import {createCreationFloorManifest} from "./creation-floor/core.mjs";
import {createSoundWorldFamily} from "../soundworld/product-family.mjs";
import {createStudioManifest} from "../hercules-video/studio-contract.mjs";

test("Studio, Creation Floor and SoundWorld share the Hercules ownership boundary",()=>{
 const o=createStudioOwnershipManifest();
 const studio=createStudioManifest();
 const floor=createCreationFloorManifest();
 const sound=createSoundWorldFamily();
 for(const x of [o,studio,floor,sound]){
  assert.equal(x.implementationOwner,"SauceApproved enterprise LLC");
  assert.equal(x.buildMode,"hercules-owned");
  assert.deepEqual(x.externalPlatforms,[]);
  assert.equal(x.thirdPartyHostedRuntimeAllowed,false);
  assert.equal(x.thirdPartyProductSubstitutionAllowed,false);
 }
});
test("every Studio surface and Creation Floor system is owner-built",()=>{
 const studio=createStudioManifest(),floor=createCreationFloorManifest();
 for(const x of [...studio.surfaces,...floor.systems]){
  assert.equal(x.herculesOwned,true);
  assert.equal(x.outsidePlatformAllowed,false);
 }
});
test("every SoundWorld product is owner-built",()=>{
 for(const x of createSoundWorldFamily().products){
  assert.equal(x.herculesOwned,true);
  assert.equal(x.outsidePlatformAllowed,false);
 }
});
test("standards interoperability does not authorize outside product substitution",()=>{
 const o=createStudioOwnershipManifest();
 assert.equal(o.interoperability.allowed,true);
 assert.equal(o.interoperability.outsideRuntimeControlAllowed,false);
 assert.ok(o.interoperability.examples.includes("usb-c"));
});
