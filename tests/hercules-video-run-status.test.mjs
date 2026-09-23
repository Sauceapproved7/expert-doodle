import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,writeFile,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {fingerprint} from "../hercules-video/core.mjs";
import {createLaunchRunState,writeLaunchRunStateAtomic} from "../hercules-video/launch-state.mjs";
import {inspectLaunchRunState,inspectLaunchRunStateFile} from "../hercules-video/run-status.mjs";
const sha=v=>createHash("sha256").update(v).digest("hex");

async function fixture() {
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-status-"));
  const renders=path.join(root,"renders"); await mkdir(renders);
  const artifact=path.join(renders,"a.mp4"); await writeFile(artifact,"render-a");
  const plan={fingerprint:sha("plan")};
  const config={upstreamCommit:"a".repeat(40),checkpointSha256:sha("checkpoint"),runtimeId:"local",renderOutputDir:renders,finalOutputPath:path.join(root,"final.mp4"),evidenceOutputPath:path.join(root,"evidence.json")};
  const unsigned={schema:"sauceapproved.hercules.video-campaign-execution-session",version:1,executionPlanFingerprint:plan.fingerprint,phase:"rendering",createdAt:"2026-09-23T00:00:00.000Z",updatedAt:"2026-09-23T00:00:01.000Z",runtime:{healthy:true,runtimeId:"local",runnerId:"wan22-ti2v5b"},jobs:[{shotId:"a",requestFingerprint:sha("a"),remoteJobId:"job-a",status:"completed",artifact:{uri:pathToFileURL(artifact).href,mimeType:"video/mp4",sizeBytes:8,sha256:sha("render-a"),durationSeconds:2},error:null},{shotId:"b",requestFingerprint:sha("b"),remoteJobId:null,status:"queued",artifact:null,error:null}],events:[],error:null};
  const session={...unsigned,fingerprint:fingerprint(unsigned)};
  const evalUnsigned={shotId:"a",artifactSha256:sha("render-a"),result:{technicalPassed:true}};
  const evaluation={...evalUnsigned,fingerprint:fingerprint(evalUnsigned)};
  return {root,artifact,plan,config,state:createLaunchRunState({executionPlan:plan,config,session,evaluations:[evaluation]})};
}

test("status reports reusable and resubmission shots without mutation",async()=>{
  const fx=await fixture(); const before=JSON.stringify(fx.state);
  const report=await inspectLaunchRunState(fx.state);
  assert.equal(report.integrity.ok,true);
  assert.deepEqual(report.reusableShotIds,["a"]);
  assert.deepEqual(report.resubmitShotIds,["b"]);
  assert.equal(report.evaluationCoverage.covered,1);
  assert.equal(report.finalization.closed,false);
  assert.equal(report.identity.runnerId,"wan22-ti2v5b");
  assert.equal(JSON.stringify(fx.state),before);
});

test("status fails closed when completed artifact integrity is broken",async()=>{
  const fx=await fixture(); await writeFile(fx.artifact,"tampered");
  const report=await inspectLaunchRunState(fx.state);
  assert.equal(report.integrity.ok,false);
  assert.match(report.integrity.blockingError,/checksum_mismatch/);
  assert.deepEqual(report.reusableShotIds,[]);
});

test("status file inspection does not rewrite launch state",async()=>{
  const fx=await fixture(); const statePath=path.join(fx.root,"launch.json");
  await writeLaunchRunStateAtomic(fx.state,statePath);
  const before=await readFile(statePath,"utf8");
  const report=await inspectLaunchRunStateFile(statePath);
  const after=await readFile(statePath,"utf8");
  assert.equal(report.readOnly,true);
  assert.equal(after,before);
});

test("status rejects a tampered state fingerprint and never marks artifacts reusable",async()=>{
  const fx=await fixture(); const tampered={...fx.state,stage:"completed"};
  const report=await inspectLaunchRunState(tampered);
  assert.equal(report.integrity.ok,false);
  assert.match(report.integrity.blockingError,/fingerprint_mismatch/);
  assert.deepEqual(report.reusableShotIds,[]);
  assert.equal(report.finalization.closed,false);
});
