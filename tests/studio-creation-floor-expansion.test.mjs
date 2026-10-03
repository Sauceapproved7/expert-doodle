import test from "node:test";
import assert from "node:assert/strict";
import {
  createCreationFloorExpansionManifest,
  createIngestSession,
  registerIngestTake,
  buildProxyPlan,
  buildDeliveryQcReport,
  buildAssetDependencyGraph,
  evaluateRelinkHealth,
  registerRightsRelease,
  evaluateRightsStatus,
  bindShootContinuity
} from "../sauceapproved-studio/creation-floor/production-ops.mjs";

test("Creation Floor expansion defines all six missing systems as Hercules-owned",()=>{
  const m=createCreationFloorExpansionManifest();
  assert.deepEqual(m.systems.map(x=>x.id),[
    "dailies-live-ingest","proxy-offline-media","delivery-qc",
    "asset-dependency-relink","rights-release-expiration","physical-shoot-continuity"
  ]);
  for(const x of m.systems){
    assert.equal(x.herculesOwned,true);
    assert.equal(x.outsidePlatformAllowed,false);
  }
});

test("ingest session rejects duplicate media identity and preserves provenance",()=>{
  const s=createIngestSession({id:"ing-1",projectId:"p1",sourceId:"card-a"});
  const a=registerIngestTake(s,{takeId:"t1",assetId:"a1",sha256:"a".repeat(64),bytes:1000});
  assert.equal(a.takes.length,1);
  assert.equal(a.takes[0].sourceId,"card-a");
  assert.throws(()=>registerIngestTake(a,{takeId:"t2",assetId:"a2",sha256:"a".repeat(64),bytes:1000}),/duplicate_ingest_fingerprint/);
});

test("proxy plan never replaces original identity",()=>{
  const plan=buildProxyPlan({assetId:"a1",sourceSha256:"b".repeat(64),target:{width:1280,height:720,bitrateKbps:3000}});
  assert.equal(plan.originalPreserved,true);
  assert.equal(plan.proxyIsDerivative,true);
  assert.equal(plan.state,"planned");
});

test("delivery QC fails closed on missing video audio captions or proof",()=>{
  const report=buildDeliveryQcReport({
    deliverableId:"d1",
    video:{width:1920,height:1080,fps:23.976,durationMs:10000},
    audio:{channels:2,sampleRateHz:48000,peakDbfs:-1.5},
    captions:{required:true,present:false},
    proof:{verified:false}
  });
  assert.equal(report.ready,false);
  assert.ok(report.blockers.includes("captions_required"));
  assert.ok(report.blockers.includes("proof_receipt_unverified"));
});

test("dependency graph identifies missing relinks",()=>{
  const graph=buildAssetDependencyGraph({
    projectId:"p1",
    assets:[
      {id:"a1",sha256:"1".repeat(64),location:"vault/a1"},
      {id:"a2",sha256:"2".repeat(64),location:"vault/a2"}
    ],
    references:[
      {consumerId:"clip-1",assetId:"a1"},
      {consumerId:"clip-2",assetId:"a3"}
    ]
  });
  const health=evaluateRelinkHealth(graph);
  assert.equal(health.healthy,false);
  assert.deepEqual(health.missingAssetIds,["a3"]);
});

test("rights release expires deterministically",()=>{
  const r=registerRightsRelease({id:"r1",assetId:"a1",status:"cleared",expiresAt:"2027-01-01T00:00:00Z"});
  assert.equal(evaluateRightsStatus(r,{asOf:"2026-12-01T00:00:00Z"}).usable,true);
  assert.equal(evaluateRightsStatus(r,{asOf:"2027-02-01T00:00:00Z"}).usable,false);
});

test("shoot continuity binds editorial state to a verified Golden Take",()=>{
  const b=bindShootContinuity({
    projectId:"p1",timelineVersion:8,shotId:"s4",
    goldenTake:{takeId:"gt1",fingerprint:"c".repeat(64),verified:true}
  });
  assert.equal(b.ready,true);
  assert.equal(b.goldenTakeFingerprint,"c".repeat(64));
});
