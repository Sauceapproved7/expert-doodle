import test from "node:test";
import assert from "node:assert/strict";
import {createStudioCompletionManifest} from "./core.mjs";

test("completion accounting includes Creation Floor runtime depth and stays fail-closed",()=>{
 const m=createStudioCompletionManifest();
 assert.equal(m.surfacesReady,true);
 assert.equal(m.productionReady,false);
 assert.equal(m.creationFloor.systems.length,10);
 assert.deepEqual(m.creationFloor.blockedCapabilities,[
  "persistent-project-storage","real-media-ingest","interactive-timeline-persistence","verified-renderer",
  "speech-to-text-runtime","audio-dsp-runtime","private-review-sharing","publishing-adapters",
  "verified-performance-ingestion","verified-integration-ledger"
 ]);
 assert.equal(m.vintageCamera.deviceProofVerified,false);
 assert.equal(m.vintageCamera.fullQualityExportVerified,false);
});
test("runtime evidence closes only explicitly verified capabilities",()=>{
 const m=createStudioCompletionManifest({runtimeEvidence:{persistentProjectStorage:true,realMediaIngest:true,verifiedRenderer:true}});
 assert.deepEqual(m.creationFloor.verifiedCapabilities,["persistent-project-storage","real-media-ingest","verified-renderer"]);
 assert.equal(m.productionReady,false);
});
test("production readiness requires all runtime depth plus Vintage Camera physical proof",()=>{
 const all={persistentProjectStorage:true,realMediaIngest:true,interactiveTimelinePersistence:true,verifiedRenderer:true,speechToTextRuntime:true,audioDspRuntime:true,privateReviewSharing:true,publishingAdapters:true,verifiedPerformanceIngestion:true,verifiedIntegrationLedger:true,vintageCameraDeviceProof:true,vintageCameraFullQualityExport:true};
 const m=createStudioCompletionManifest({runtimeEvidence:all});
 assert.equal(m.creationFloor.blockedCapabilities.length,0);
 assert.equal(m.productionReady,true);
});
