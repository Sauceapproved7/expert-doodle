import test from "node:test";
import assert from "node:assert/strict";
import {
 createProductionCommand, evaluateProductionCommand,
 createAccessZone, authorizeAccess,
 createConsentRecord, evaluateConsent,
 createAuthenticityRecord, appendAuthenticityEvent, verifyAuthenticityRecord,
 createMasteringPlan, evaluateMasteringPlan,
 createVfxTurnover, evaluateVfxTurnover,
 createLocalizationPackage, evaluateLocalizationPackage,
 createLiveSession, evaluateLiveSession,
 createNetworkBudget, evaluateNetworkBudget,
 createDeliveryPackage, evaluateDeliveryPackage,
 createArchivePlan, evaluateArchivePlan,
 createIncidentCapsule, evaluateRecovery,
 createObservabilitySnapshot, evaluateObservability,
 createCapacitySnapshot, evaluateCapacity,
 createProductionLedger, addProductionCost, evaluateBudget,
 createReleaseRoom, evaluateReleaseRoom
} from "../sauceapproved-studio/global-closure/operations.mjs";

test("production command blocks unresolved dependencies",()=>{
 const x=createProductionCommand({projectId:"p1",milestones:["shoot"],shots:[{id:"s1",ready:false}],dependencies:[{id:"location",resolved:false}]});
 assert.equal(evaluateProductionCommand(x).ready,false);
});
test("access zones enforce role scope and revocation",()=>{
 const z=createAccessZone({id:"vault",roles:["editor"],resources:["master"]});
 assert.equal(authorizeAccess(z,{role:"editor",resource:"master"}).allowed,true);
 assert.equal(authorizeAccess({...z,revokedRoles:["editor"]},{role:"editor",resource:"master"}).allowed,false);
});
test("consent is use and time scoped",()=>{
 const c=createConsentRecord({id:"c1",subjectId:"talent1",uses:["advertising"],territories:["US"],validUntil:"2027-01-01T00:00:00Z",signed:true});
 assert.equal(evaluateConsent(c,{use:"advertising",territory:"US",asOf:"2026-10-01T00:00:00Z"}).usable,true);
 assert.equal(evaluateConsent(c,{use:"training",territory:"US",asOf:"2026-10-01T00:00:00Z"}).usable,false);
});
test("authenticity chain detects mutation",()=>{
 let r=createAuthenticityRecord({assetId:"a1",originSha256:"a".repeat(64)});
 r=appendAuthenticityEvent(r,{action:"edit",outputSha256:"b".repeat(64),aiAssisted:true});
 assert.equal(verifyAuthenticityRecord(r).verified,true);
 const bad={...r,events:[...r.events,{...r.events[0],previousSha256:"f".repeat(64)}]};
 assert.equal(verifyAuthenticityRecord(bad).verified,false);
});
test("mastering requires calibration and target proof",()=>{
 const p=createMasteringPlan({assetId:"a1",inputColor:"log",workingSpace:"scene-linear",targets:["SDR"],displayCalibrated:false});
 assert.equal(evaluateMasteringPlan(p).ready,false);
});
test("VFX turnover requires returned conform proof",()=>{
 const v=createVfxTurnover({shotId:"s1",version:1,handles:12,plates:["plate-a"]});
 assert.equal(evaluateVfxTurnover(v).ready,false);
});
test("localization requires QC for every declared locale",()=>{
 const p=createLocalizationPackage({assetId:"a1",locales:["en-US","es-US"],captionMaster:true,qcLocales:["en-US"]});
 assert.equal(evaluateLocalizationPackage(p).ready,false);
});
test("live session requires backup, destination authorization and failover",()=>{
 const s=createLiveSession({id:"live1",encoderHealthy:true,backupRecording:true,destinationAuthorized:true,failoverReady:false});
 assert.equal(evaluateLiveSession(s).ready,false);
});
test("network budget enforces measured headroom",()=>{
 const n=createNetworkBudget({measuredMbps:100,requiredMbps:90,latencyMs:10,jitterMs:2,packetLossPct:0.1,alternatePath:true});
 assert.equal(evaluateNetworkBudget(n).ready,false);
});
test("delivery package requires essence audio captions checksums and receipt",()=>{
 const d=createDeliveryPackage({id:"d1",essenceValid:true,loudnessValid:true,captionsValid:true,checksumManifest:true,deliveryReceipt:false});
 assert.equal(evaluateDeliveryPackage(d).ready,false);
});
test("archive requires multiple verified copies and restore drill",()=>{
 const a=createArchivePlan({id:"arc1",verifiedCopies:2,restoreDrillPassed:false,keyCustodyVerified:true});
 assert.equal(evaluateArchivePlan(a).ready,false);
});
test("incident recovery requires known-good restore proof",()=>{
 const i=createIncidentCapsule({id:"i1",safeStopped:true,recoveryCapsule:true,knownGoodRestore:false,postIncidentProof:true});
 assert.equal(evaluateRecovery(i).ready,false);
});
test("observability fails when a critical health channel is unhealthy",()=>{
 const o=createObservabilitySnapshot({service:true,device:true,queue:true,render:false,proofGate:true});
 assert.equal(evaluateObservability(o).ready,false);
});
test("capacity requires configured headroom and safe thermal state",()=>{
 const c=createCapacitySnapshot({storagePctFree:30,computePctFree:25,memoryPctFree:20,thermalC:95,powerPctFree:30});
 assert.equal(evaluateCapacity(c).ready,false);
});
test("production ledger calculates committed and actual variance",()=>{
 let l=createProductionLedger({projectId:"p1",budget:1000});
 l=addProductionCost(l,{id:"c1",amount:400,state:"actual"});
 l=addProductionCost(l,{id:"c2",amount:700,state:"committed"});
 assert.equal(evaluateBudget(l).overBudget,true);
});
test("release room cannot open with any blocked gate",()=>{
 const room=createReleaseRoom({releaseId:"r1",gates:[{id:"rights",verified:true,current:true},{id:"archive",verified:false,current:true}],ownerApproved:true,rollbackPlan:true});
 assert.equal(evaluateReleaseRoom(room).ready,false);
});
