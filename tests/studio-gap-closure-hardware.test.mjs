import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHardwareEngineeringProgram} from "../hardware/studio-gap-closure/program.mjs";

test("hardware engineering program covers all sixteen new physical or hybrid systems",()=>{
  const p=createStudioHardwareEngineeringProgram();
  assert.equal(p.packages.length,16);
  assert.deepEqual(p.packages.map(x=>x.id),[
    "soundworld-field-recorder","soundworld-wireless-creator","soundworld-room-reference",
    "soundworld-clock","soundworld-service-bench","soundworld-room-measure",
    "studio-sync-core","studio-signal-core","studio-storage-core","studio-position-nodes",
    "studio-acoustic-kit","studio-comms-slate","studio-environment-node",
    "studio-redundancy-core","studio-calibration-kit","studio-cable-power-map"
  ]);
});

test("every physical package remains owner-designed and fail-closed before prototype evidence",()=>{
  const p=createStudioHardwareEngineeringProgram();
  for(const x of p.packages){
    assert.equal(x.implementationOwner,"SauceApproved enterprise LLC");
    assert.equal(x.ownedDesign,true);
    assert.equal(x.thirdPartyFinishedProductAllowed,false);
    assert.equal(x.prototypeVerified,false);
    assert.equal(x.productionReady,false);
    assert.ok(x.requiredEvidence.length>=4);
  }
});

test("new continuity hardware trio is explicitly defined",()=>{
  const p=createStudioHardwareEngineeringProgram();
  const position=p.packages.find(x=>x.id==="studio-position-nodes");
  const sync=p.packages.find(x=>x.id==="studio-sync-core");
  const room=p.packages.find(x=>x.id==="soundworld-room-reference");
  assert.equal(position.productName,"Hercules Spatial Node");
  assert.equal(sync.productName,"Hercules Sync Core");
  assert.equal(room.productName,"SoundWorld Room Reference Node");
  assert.ok(position.differentiators.includes("Set Geometry Fingerprint"));
  assert.ok(sync.differentiators.includes("Clock Truth Ledger"));
  assert.ok(room.differentiators.includes("Room Memory Signature"));
});

test("mains power is treated as an external safety boundary, not a DIY Hercules supply",()=>{
  const p=createStudioHardwareEngineeringProgram();
  const power=p.packages.find(x=>x.id==="studio-cable-power-map");
  assert.equal(power.mainsPowerConstructionAllowed,false);
  assert.ok(power.requiredEvidence.includes("qualified-electrical-safety-review"));
});
