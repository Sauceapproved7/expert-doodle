import test from "node:test";
import assert from "node:assert/strict";
import {createStudioInfrastructureManifest,evaluateStudioInfrastructure} from "./core.mjs";

const IDS=["equipment-kit","power-station","camera-io","teleprompter","lighting-control","color-suite","monitor-mode","camera-mic-sync","hardware-control-surface","accessibility-suite","portable-project-package","creation-floor-runtime"];

test("Studio infrastructure defines all twelve missing layers in order",()=>{
 const m=createStudioInfrastructureManifest();
 assert.deepEqual(m.layers.map(x=>x.id),IDS);
 assert.equal(m.layers.length,12);
});
test("physical and external-device layers remain fail-closed without evidence",()=>{
 const m=createStudioInfrastructureManifest();
 for(const id of ["equipment-kit","power-station","camera-io","lighting-control","hardware-control-surface"]){
  const x=m.layers.find(v=>v.id===id);
  assert.equal(x.verified,false);
 }
});
test("teleprompter, color, monitor, sync, accessibility and portable package have software requirements",()=>{
 const m=createStudioInfrastructureManifest();
 for(const id of ["teleprompter","color-suite","monitor-mode","camera-mic-sync","accessibility-suite","portable-project-package"]){
  assert.ok(m.layers.find(v=>v.id===id).requirements.length>=4);
 }
});
test("Creation Floor runtime names the real remaining runtime capabilities",()=>{
 const x=createStudioInfrastructureManifest().layers.find(v=>v.id==="creation-floor-runtime");
 assert.ok(x.requirements.includes("persistent-project-storage"));
 assert.ok(x.requirements.includes("verified-renderer"));
 assert.ok(x.requirements.includes("speech-to-text-runtime"));
 assert.ok(x.requirements.includes("publishing-adapters"));
});
test("program is not production complete until all twelve layers have verified evidence",()=>{
 const r=evaluateStudioInfrastructure(createStudioInfrastructureManifest());
 assert.equal(r.productionReady,false);
 assert.equal(r.blocked.length,12);
});

test("all twelve layers are Hercules-owned with no outside platform substitution",()=>{
 const m=createStudioInfrastructureManifest();
 assert.equal(m.implementationOwner,"SauceApproved enterprise LLC");
 assert.equal(m.buildMode,"hercules-owned");
 assert.deepEqual(m.externalPlatforms,[]);
 assert.equal(m.thirdPartyHostedRuntimeAllowed,false);
 assert.equal(m.thirdPartyProductSubstitutionAllowed,false);
 for(const x of m.layers){
  assert.equal(x.implementationOwner,"SauceApproved enterprise LLC");
  assert.equal(x.herculesOwned,true);
  assert.equal(x.outsidePlatformAllowed,false);
 }
});
