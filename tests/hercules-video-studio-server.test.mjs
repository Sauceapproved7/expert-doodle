import assert from "node:assert/strict";
import test from "node:test";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

function statusFixture() {
  return {
    schema:"sauceapproved.hercules.video-launch-run-status",
    version:1,
    readOnly:true,
    stateFingerprint:"state-1",
    integrity:{ok:true,blockingError:null},
    launchStage:"rendering",
    identity:{executionPlanFingerprint:"plan-1",runtimeId:"local",runnerId:"wan22-ti2v5b"},
    shots:[
      {order:0,shotId:"shot-a",status:"completed",requestFingerprint:"req-a",artifactSha256:"a".repeat(64),evaluationBound:true,safelyReusable:true,requiresResubmission:false}
    ],
    reusableShotIds:["shot-a"],
    resubmitShotIds:[],
    evaluationCoverage:{covered:1,total:1,complete:true},
    finalization:{closed:false,finalOutputSha256:null,campaignEvidenceFingerprint:null},
    counts:{shots:1,completed:1,evaluated:1}
  };
}

test("Studio root serves the owned SauceApproved operator shell",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/"});
  assert.equal(response.status,200);
  assert.match(response.headers["content-type"],/text\/html/);
  assert.match(response.body,/SauceApproved Studio/);
  assert.match(response.body,/Project Brief/);
  assert.match(response.body,/Shot Timeline/);
  assert.match(response.body,/Quality (?:&|&amp;) Evidence/);
  assert.match(response.body,/Execution bridge unavailable/);
});

test("Studio manifest and status APIs expose fail-closed owned contracts",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const manifest=await handle({method:"GET",pathname:"/api/studio/manifest"});
  assert.equal(manifest.status,200);
  const manifestBody=JSON.parse(manifest.body);
  assert.equal(manifestBody.executionPolicy,"fail-closed");

  const status=await handle({method:"GET",pathname:"/api/studio/status"});
  assert.equal(status.status,200);
  const statusBody=JSON.parse(status.body);
  assert.equal(statusBody.mode,"read-only");
  assert.equal(statusBody.controls.start.enabled,false);
  assert.equal(statusBody.controls.resume.enabled,false);
  assert.equal(statusBody.timeline[0].shotId,"shot-a");
});

test("Studio execution endpoints stay locked when trusted bridge is unavailable",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  for (const pathname of ["/api/studio/start","/api/studio/resume"]) {
    const response=await handle({method:"POST",pathname});
    assert.equal(response.status,423);
    const body=JSON.parse(response.body);
    assert.equal(body.ok,false);
    assert.equal(body.error,"execution_bridge_unavailable");
  }
});

test("Studio status fails closed when no verified run state exists",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>null,
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/api/studio/status"});
  assert.equal(response.status,404);
  assert.equal(JSON.parse(response.body).error,"studio_run_state_unavailable");
});

test("Studio health does not expose run paths or credentials",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/health"});
  const body=JSON.parse(response.body);
  assert.equal(response.status,200);
  assert.equal(body.ok,true);
  assert.equal(body.service,"sauceapproved-studio");
  assert.equal(body.executionPolicy,"fail-closed");
  assert.equal("statePath" in body,false);
  assert.equal("credential" in body,false);
});


test("Studio mutation stays unauthorized even when execution bridge is connected",async()=>{
  let invoked=false;
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:true,id:"hercules-video-owned-bridge"}),
    actions:{start:async()=>{invoked=true;return {started:true};}}
  });
  const response=await handle({method:"POST",pathname:"/api/studio/start",headers:{}});
  assert.equal(response.status,401);
  assert.equal(JSON.parse(response.body).error,"studio_operator_authorization_required");
  assert.equal(invoked,false);
});

test("Studio mutation runs only after explicit operator authorization and trusted bridge checks",async()=>{
  let invoked=false;
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:true,id:"hercules-video-owned-bridge"}),
    authorizeOperator:async request=>request?.headers?.authorization==="Bearer test-owner",
    actions:{start:async()=>{invoked=true;return {started:true};}}
  });
  const response=await handle({
    method:"POST",
    pathname:"/api/studio/start",
    headers:{authorization:"Bearer test-owner"}
  });
  assert.equal(response.status,200);
  assert.equal(JSON.parse(response.body).ok,true);
  assert.equal(invoked,true);
});
