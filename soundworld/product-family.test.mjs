import test from "node:test";
import assert from "node:assert/strict";
import {createSoundWorldFamily,validateSoundWorldFamily} from "./product-family.mjs";

test("SoundWorld defines the complete 1-12 ecosystem in order",()=>{
 const f=createSoundWorldFamily();
 assert.deepEqual(f.products.map(p=>p.id),["computer-pro","pods","max","portable","desk","mic","creator-headset","mini","bar","hub","control","studio-bridge"]);
 assert.equal(f.products.length,12);
 assert.equal(f.brand,"SoundWorld");
});
test("computer headphones support resilient computer connectivity and creator use",()=>{
 const p=createSoundWorldFamily().products[0];
 assert.deepEqual(p.connectivity,["usb-c","bluetooth","3.5mm"]);
 assert.equal(p.microphone,"detachable-or-hidden");
 assert.equal(p.wiredPassivePath,true);
 assert.ok(p.tests.includes("mic-call-quality"));
 assert.ok(p.tests.includes("long-session-comfort"));
});
test("physical products carry engineering and manufacturing gates",()=>{
 const f=createSoundWorldFamily();
 for(const p of f.products.filter(x=>x.type==="hardware")){
  assert.ok(p.gates.includes("acoustic-validation"));
  assert.ok(p.gates.includes("electrical-safety"));
  assert.ok(p.gates.includes("prototype-validation"));
  assert.equal(p.productionClaimAllowed,false);
 }
});
test("Control and Studio Bridge create the Hercules audio loop without fake connections",()=>{
 const f=createSoundWorldFamily();
 const control=f.products.find(p=>p.id==="control");
 const bridge=f.products.find(p=>p.id==="studio-bridge");
 assert.equal(control.autonomousFirmwareMutation,false);
 assert.equal(bridge.proofSpine,true);
 assert.equal(bridge.providerConnectionVerified,false);
 assert.equal(bridge.silentBrandMutationAllowed,false);
});
test("family validation stays fail-closed until physical and runtime evidence exists",()=>{
 const result=validateSoundWorldFamily(createSoundWorldFamily());
 assert.equal(result.catalogReady,true);
 assert.equal(result.productionReady,false);
 assert.ok(result.blockers.includes("physical-prototype-validation-required"));
 assert.ok(result.blockers.includes("studio-bridge-runtime-proof-required"));
});
