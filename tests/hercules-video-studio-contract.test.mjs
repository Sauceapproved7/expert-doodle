import assert from "node:assert/strict";
import test from "node:test";
import {buildStudioViewModel,createStudioManifest} from "../hercules-video/studio-contract.mjs";

function runStatus(overrides={}) {
  return {
    schema:"sauceapproved.hercules.video-launch-run-status",
    version:1,
    readOnly:true,
    stateFingerprint:"state-1",
    integrity:{ok:true,blockingError:null},
    launchStage:"rendering",
    identity:{
      executionPlanFingerprint:"plan-1",
      upstreamCommit:"a".repeat(40),
      checkpointSha256:"b".repeat(64),
      runtimeId:"hercules-video-local",
      runnerId:"wan22-ti2v5b",
      renderOutputDir:"/renders",
      finalOutputPath:"/output/final.mp4",
      evidenceOutputPath:"/output/evidence.json"
    },
    shots:[
      {order:0,shotId:"shot-a",status:"completed",requestFingerprint:"req-a",artifactSha256:"c".repeat(64),evaluationBound:true,safelyReusable:true,requiresResubmission:false},
      {order:1,shotId:"shot-b",status:"queued",requestFingerprint:"req-b",artifactSha256:null,evaluationBound:false,safelyReusable:false,requiresResubmission:true}
    ],
    reusableShotIds:["shot-a"],
    resubmitShotIds:["shot-b"],
    evaluationCoverage:{covered:1,total:2,complete:false},
    finalization:{closed:false,finalOutputSha256:null,campaignEvidenceFingerprint:null},
    counts:{shots:2,completed:1,evaluated:1},
    ...overrides
  };
}

test("studio manifest exposes the operator surfaces required by SauceApproved Studio",()=>{
  const manifest=createStudioManifest();
  assert.equal(manifest.schema,"sauceapproved.hercules.video-studio-manifest");
  assert.equal(manifest.version,1);
  assert.deepEqual(
    manifest.surfaces.map(surface=>surface.id),
    ["dashboard","project-brief","storyboard","run-status","shot-timeline","quality-evidence","recovery","output-review","content-multiplier","integrations"]
  );
  assert.equal(manifest.executionPolicy,"fail-closed");
});

test("studio view model keeps execution disabled when no trusted execution bridge is connected",()=>{
  const model=buildStudioViewModel({
    runStatus:runStatus(),
    executionBridge:{connected:false,reason:"execution_bridge_unavailable"}
  });
  assert.equal(model.schema,"sauceapproved.hercules.video-studio-view");
  assert.equal(model.mode,"read-only");
  assert.equal(model.controls.start.enabled,false);
  assert.equal(model.controls.resume.enabled,false);
  assert.equal(model.controls.start.reason,"execution_bridge_unavailable");
  assert.equal(model.integrity.ok,true);
  assert.deepEqual(model.timeline.map(item=>item.shotId),["shot-a","shot-b"]);
  assert.deepEqual(model.reusableShotIds,["shot-a"]);
  assert.deepEqual(model.resubmitShotIds,["shot-b"]);
  assert.equal(model.evidence.coverage.complete,false);
});

test("studio view model only exposes resume when integrity is valid and a trusted bridge is connected",()=>{
  const model=buildStudioViewModel({
    runStatus:runStatus(),
    executionBridge:{connected:true,id:"hercules-video-owned-bridge"}
  });
  assert.equal(model.mode,"operator");
  assert.equal(model.controls.start.enabled,true);
  assert.equal(model.controls.resume.enabled,true);
  assert.equal(model.controls.export.enabled,false);
});

test("studio view model fails closed on broken run integrity",()=>{
  const model=buildStudioViewModel({
    runStatus:runStatus({integrity:{ok:false,blockingError:"launch_state_fingerprint_mismatch"}}),
    executionBridge:{connected:true,id:"hercules-video-owned-bridge"}
  });
  assert.equal(model.mode,"blocked");
  assert.equal(model.controls.start.enabled,false);
  assert.equal(model.controls.resume.enabled,false);
  assert.match(model.blockingReason,/fingerprint_mismatch/);
});


test("studio view model redacts server-local artifact paths from customer-facing identity",()=>{
  const model=buildStudioViewModel({
    runStatus:runStatus(),
    executionBridge:{connected:false,reason:"execution_bridge_unavailable"}
  });
  assert.equal(model.identity.executionPlanFingerprint,"plan-1");
  assert.equal(model.identity.runtimeId,"hercules-video-local");
  assert.equal(model.identity.runnerId,"wan22-ti2v5b");
  assert.equal("renderOutputDir" in model.identity,false);
  assert.equal("finalOutputPath" in model.identity,false);
  assert.equal("evidenceOutputPath" in model.identity,false);
});
