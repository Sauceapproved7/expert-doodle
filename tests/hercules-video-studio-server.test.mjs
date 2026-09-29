import assert from "node:assert/strict";
import test from "node:test";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";
import "./sauceapproved-vintage-camera-quality.test.mjs";
import "./sauceapproved-vintage-camera-receipt.test.mjs";
import "./sauceapproved-vintage-camera-frame-scheduler.test.mjs";
import "./sauceapproved-vintage-camera-device-proof.test.mjs";

test("Vintage Camera serves an owned local-first capture surface and client",async()=>{
  const handle=createStudioHttpHandler();
  const page=await handle({method:"GET",pathname:"/vintage-camera"});
  assert.equal(page.status,200);
  assert.match(page.body,/SauceApproved Vintage Camera/);
  assert.match(page.body,/Original stays on your device/);
  assert.match(page.body,/\/assets\/vintage-camera.js/);
  assert.match(page.headers["content-security-policy"],/script-src 'self'/);
  const client=await handle({method:"GET",pathname:"/assets/vintage-camera.js"});
  assert.equal(client.status,200);
  assert.match(client.headers["content-type"],/javascript/);
  assert.match(client.body,/getUserMedia/);
  assert.match(client.body,/MediaRecorder/);
  assert.match(client.body,/assessCapture/);
  const quality=await handle({method:"GET",pathname:"/assets/capture-quality.mjs"});
  assert.equal(quality.status,200);
  const receipt=await handle({method:"GET",pathname:"/assets/capture-receipt.mjs"});
  assert.equal(receipt.status,200);
  assert.match(page.body,/Save QA receipt/);
  assert.match(quality.body,/low_frame_cadence/);
  const root=await handle({method:"GET",pathname:"/"});
  assert.match(root.body,/href="\/vintage-camera"/);
  const manifest=JSON.parse((await handle({method:"GET",pathname:"/api\/studio\/manifest"})).body);
  assert.ok(manifest.surfaces.some(surface=>surface.id==="vintage-camera"));
});

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


test("Studio root advertises the owned Content Multiplier surface",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/"});
  assert.equal(response.status,200);
  assert.match(response.body,/Content Multiplier/);
  assert.match(response.body,/\/content-multiplier/);
});

test("Content Multiplier surface renders Hercules differentiators and provider lock",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/content-multiplier"});
  assert.equal(response.status,200);
  assert.match(response.headers["content-type"],/text\/html/);
  assert.match(response.body,/SauceApproved Content Multiplier/);
  assert.match(response.body,/Content DNA/);
  assert.match(response.body,/Variation Tree/);
  assert.match(response.body,/Content Opportunity Radar/);
  assert.match(response.body,/Variant Fatigue Guard/);
  assert.match(response.body,/Generation provider not connected/);
});

test("Content Multiplier manifest API is owned and fail-closed",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/content-multiplier/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"SauceApproved Content Multiplier");
  assert.equal(body.executionPolicy,"fail-closed");
  assert.equal(body.providerRequiredForGeneration,true);
  assert.ok(body.differentiators.includes("Content DNA"));
});


test("Studio root advertises the owned AI Sales Agent surface",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/"});
  assert.equal(response.status,200);
  assert.match(response.body,/AI Sales Agent/);
  assert.match(response.body,/\/ai-sales-agent/);
});

test("AI Sales Agent surface renders Hercules differentiators and action lock",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/ai-sales-agent"});
  assert.equal(response.status,200);
  assert.match(response.headers["content-type"],/text\/html/);
  assert.match(response.body,/SauceApproved AI Sales Agent/);
  assert.match(response.body,/Objection Intelligence Map/);
  assert.match(response.body,/Adaptive Pitch Memory/);
  assert.match(response.body,/Confidence-to-Handoff Governor/);
  assert.match(response.body,/Objection-to-Asset Bridge/);
  assert.match(response.body,/Action adapter not connected/);
});

test("AI Sales Agent manifest API is owned, fail-closed and blocks sensitive profiling",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/ai-sales-agent/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"SauceApproved AI Sales Agent");
  assert.equal(body.executionPolicy,"fail-closed");
  assert.equal(body.actionAdapterRequired,true);
  assert.equal(body.sensitiveProfilingAllowed,false);
  assert.ok(body.differentiators.includes("Objection Intelligence Map"));
});


test("Studio root advertises the owned Brand Brain surface",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/"});
  assert.equal(response.status,200);
  assert.match(response.body,/Brand Brain/);
  assert.match(response.body,/\/brand-brain/);
});

test("Brand Brain surface renders governance differentiators and approval gate",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/brand-brain"});
  assert.equal(response.status,200);
  assert.match(response.headers["content-type"],/text\/html/);
  assert.match(response.body,/SauceApproved Brand Brain/);
  assert.match(response.body,/Brand Constitution/);
  assert.match(response.body,/Cross-Channel Consistency Simulator/);
  assert.match(response.body,/Rule Blast Radius Preview/);
  assert.match(response.body,/Brand Drift Time Machine/);
  assert.match(response.body,/Changes require review/);
});

test("Brand Brain manifest API is owned and approval-gated",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/brand-brain/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"SauceApproved Brand Brain");
  assert.equal(body.executionPolicy,"approval-gated");
  assert.equal(body.silentAutoLearningAllowed,false);
  assert.ok(body.differentiators.includes("Brand Constitution"));
});


test("Studio root advertises the public Studios Market",async()=>{
  const handle=createStudioHttpHandler({
    statusReader:async()=>statusFixture(),
    executionBridgeProvider:async()=>({connected:false,reason:"execution_bridge_unavailable"})
  });
  const response=await handle({method:"GET",pathname:"/"});
  assert.equal(response.status,200);
  assert.match(response.body,/Studios Market/);
  assert.match(response.body,/\/market/);
});

test("Studios Market lists all three products and the bundle with tracked pilot CTAs",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/market"});
  assert.equal(response.status,200);
  assert.match(response.body,/SauceApproved Studios Market/);
  assert.match(response.body,/Content Multiplier/);
  assert.match(response.body,/AI Sales Agent/);
  assert.match(response.body,/Brand Brain/);
  assert.match(response.body,/Studios Bundle/);
  assert.match(response.body,/utm_content=studio-content-multiplier/);
  assert.match(response.body,/utm_content=studio-ai-sales-agent/);
  assert.match(response.body,/utm_content=studio-brand-brain/);
  assert.match(response.body,/utm_content=studio-bundle/);
  assert.match(response.body,/Paid checkout remains locked/);
});

test("Studios Market manifest keeps public discovery open and paid checkout closed",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/market/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"SauceApproved Studios Market");
  assert.equal(body.publicDiscovery,true);
  assert.equal(body.pilotApplicationsOpen,true);
  assert.equal(body.paidCheckoutEnabled,false);
  assert.equal(body.pricingApprovalRequired,true);
  assert.equal(body.products.length,5);
  assert.ok(body.products.some(item=>item.id==="content-multiplier"));
  assert.ok(body.products.some(item=>item.id==="ai-sales-agent"));
  assert.ok(body.products.some(item=>item.id==="brand-brain"));
  assert.ok(body.products.some(item=>item.id==="vintage-camera"&&item.availability==="free-preview"&&item.ctaUrl==="/vintage-camera"));
  assert.ok(body.products.some(item=>item.id==="studios-bundle"));
});


test("Studio commercial manifest is canonical and paid checkout stays fail-closed",async()=>{
  const handle=createStudioHttpHandler();
  const manifest=await handle({method:"GET",pathname:"/api/studio/commercial/manifest"});
  assert.equal(manifest.status,200);
  const body=JSON.parse(manifest.body);
  assert.equal(body.product,"SauceApproved Studio");
  assert.equal(body.plans.length,3);
  assert.deepEqual(body.plans.map(plan=>plan.monthlyUsd),[29,79,199]);
  assert.deepEqual(body.plans.map(plan=>plan.code),["starter","pro","agency"]);
  assert.deepEqual(body.plans.map(plan=>plan.name),["Starter","Pro","Business"]);
  assert.equal(body.ownerApproval.pricing,false);
  assert.equal(body.ownerApproval.terms,false);
  assert.equal(body.ownerApproval.privacy,false);
  assert.equal(body.paymentPathVerified,false);
  assert.equal(body.paidCheckoutEnabled,false);
  assert.equal(body.checkoutPolicy,"fail-closed");

  const checkout=await handle({method:"POST",pathname:"/api/studio/checkout"});
  assert.equal(checkout.status,423);
  const checkoutBody=JSON.parse(checkout.body);
  assert.equal(checkoutBody.ok,false);
  assert.equal(checkoutBody.error,"studio_commercial_approval_and_payment_path_required");
  assert.equal(checkoutBody.commercial.paidCheckoutEnabled,false);
});
