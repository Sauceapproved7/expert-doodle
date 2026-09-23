import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {fingerprint} from "../hercules-video/core.mjs";
import {
  createLaunchRunState,
  readLaunchRunState,
  validateLaunchRunState,
  verifyLaunchRunStateArtifacts,
  writeLaunchRunStateAtomic,
} from "../hercules-video/launch-state.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");

async function fixture() {
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-launch-state-"));
  const renderOutputDir=path.join(root,"renders");
  const finalDir=path.join(root,"final");
  await mkdir(renderOutputDir);
  await mkdir(finalDir);
  const artifactPath=path.join(renderOutputDir,"a.mp4");
  await writeFile(artifactPath,"render-a");
  const executionPlan={fingerprint:sha("plan")};
  const config={
    upstreamCommit:"a".repeat(40),
    checkpointSha256:sha("checkpoint"),
    runtimeId:"runtime-1",
    renderOutputDir,
    finalOutputPath:path.join(finalDir,"final.mp4"),
    evidenceOutputPath:path.join(finalDir,"evidence.json"),
  };
  const sessionUnsigned={
    schema:"sauceapproved.hercules.video-campaign-execution-session",
    version:1,
    executionPlanFingerprint:executionPlan.fingerprint,
    phase:"renders_completed",
    createdAt:"2026-09-23T20:00:00.000Z",
    updatedAt:"2026-09-23T20:00:01.000Z",
    runtime:{healthy:true,runtimeId:"runtime-1",runnerId:"wan"},
    jobs:[{
      shotId:"a",
      requestFingerprint:sha("request-a"),
      remoteJobId:"job-a",
      status:"completed",
      artifact:{
        uri:pathToFileURL(artifactPath).href,
        mimeType:"video/mp4",
        sizeBytes:8,
        sha256:sha("render-a"),
        durationSeconds:2,
      },
      error:null,
    }],
    events:[],
    error:null,
  };
  const session={...sessionUnsigned,fingerprint:fingerprint(sessionUnsigned)};
  const evaluationUnsigned={
    shotId:"a",
    artifactSha256:sha("render-a"),
    result:{promptAdherence:.9,technicalPassed:true},
  };
  const evaluation={...evaluationUnsigned,fingerprint:fingerprint(evaluationUnsigned)};
  return {root,artifactPath,executionPlan,config,session,evaluation};
}

test("launch state fingerprint rejects tampering",async()=>{
  const fx=await fixture();
  const state=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
    evaluations:[fx.evaluation],
  });
  const tampered={...state,stage:"completed"};
  assert.throws(
    ()=>validateLaunchRunState(tampered,{executionPlan:fx.executionPlan,config:fx.config}),
    /launch_state_fingerprint_mismatch/
  );
});

test("launch state rejects model or path identity drift",async()=>{
  const fx=await fixture();
  const state=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
  });
  assert.throws(
    ()=>validateLaunchRunState(state,{
      executionPlan:fx.executionPlan,
      config:{...fx.config,checkpointSha256:sha("other-checkpoint")},
    }),
    /launch_state_identity_mismatch:checkpointSha256/
  );
});

test("completed render artifacts must still exist and match SHA-256",async()=>{
  const fx=await fixture();
  const state=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
  });
  await verifyLaunchRunStateArtifacts(state);

  await writeFile(fx.artifactPath,"changed-render");
  await assert.rejects(
    ()=>verifyLaunchRunStateArtifacts(state),
    /launch_state_completed_artifact_checksum_mismatch:a/
  );

  await rm(fx.artifactPath,{force:true});
  await assert.rejects(
    ()=>verifyLaunchRunStateArtifacts(state),
    /launch_state_completed_artifact_file_missing:a/
  );
});

test("stored evaluation must match its completed render and its own fingerprint",async()=>{
  const fx=await fixture();
  const good=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
    evaluations:[fx.evaluation],
  });
  await verifyLaunchRunStateArtifacts(good);

  const mismatchedUnsigned={
    shotId:"a",
    artifactSha256:sha("different-render"),
    result:{promptAdherence:.9,technicalPassed:true},
  };
  const mismatched={...mismatchedUnsigned,fingerprint:fingerprint(mismatchedUnsigned)};
  const bad=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
    evaluations:[mismatched],
  });
  await assert.rejects(
    ()=>verifyLaunchRunStateArtifacts(bad),
    /launch_state_evaluation_artifact_mismatch:a/
  );

  const tamperedEvaluation={...fx.evaluation,result:{promptAdherence:.1}};
  const tamperedState=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
    evaluations:[tamperedEvaluation],
  });
  await assert.rejects(
    ()=>verifyLaunchRunStateArtifacts(tamperedState),
    /launch_state_evaluation_fingerprint_mismatch:a/
  );
});

test("atomic state writer round-trips a verified state",async()=>{
  const fx=await fixture();
  const state=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:fx.session,
    evaluations:[fx.evaluation],
  });
  const statePath=path.join(fx.root,"state","launch.json");
  const written=await writeLaunchRunStateAtomic(state,statePath);
  assert.equal(written.stateFingerprint,state.fingerprint);
  assert.match(written.sha256,/^[a-f0-9]{64}$/);

  const parsed=await readLaunchRunState(statePath);
  assert.deepEqual(parsed,state);
  assert.equal(JSON.parse(await readFile(statePath,"utf8")).fingerprint,state.fingerprint);
  validateLaunchRunState(parsed,{executionPlan:fx.executionPlan,config:fx.config});
  await verifyLaunchRunStateArtifacts(parsed);
});

test("completed launch state carries final evidence identity",async()=>{
  const fx=await fixture();
  const sessionUnsigned={...fx.session,phase:"completed"};
  delete sessionUnsigned.fingerprint;
  const completedSession={...sessionUnsigned,fingerprint:fingerprint(sessionUnsigned)};
  const state=createLaunchRunState({
    executionPlan:fx.executionPlan,
    config:fx.config,
    session:completedSession,
    stage:"completed",
    evaluations:[fx.evaluation],
    finalOutputSha256:sha("final"),
    campaignEvidenceFingerprint:sha("campaign"),
  });
  assert.equal(state.stage,"completed");
  assert.equal(state.finalOutputSha256,sha("final"));
  assert.equal(state.campaignEvidenceFingerprint,sha("campaign"));
});
