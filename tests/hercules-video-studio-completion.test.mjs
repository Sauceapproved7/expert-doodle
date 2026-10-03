import assert from "node:assert/strict";
import test from "node:test";

import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

const surfaces=[
  ["reality-forge","Hercules Reality Forge"],
  ["performance-lab","Hercules Performance Lab"],
  ["scene-forge","Hercules SceneForge"],
  ["sound-world","Hercules SoundWorld"],
  ["actor-lab","Hercules Actor Lab"],
  ["studio-director","Hercules Studio Director"],
  ["integrations","Hercules Integrations Hub"]
];

test("Studio exposes every completion-pass surface through owned page and manifest routes",async()=>{
  const handle=createStudioHttpHandler();
  for(const [id,label] of surfaces){
    const page=await handle({method:"GET",pathname:"/"+id});
    assert.equal(page.status,200,id+" page");
    assert.match(page.body,new RegExp(label),id+" label");
    const manifest=await handle({method:"GET",pathname:"/api/studio/"+id+"/manifest"});
    assert.equal(manifest.status,200,id+" manifest");
  }
});

test("Studio root links every completion-pass surface instead of rendering dead labels",async()=>{
  const handle=createStudioHttpHandler();
  const root=await handle({method:"GET",pathname:"/"});
  assert.equal(root.status,200);
  for(const [id] of surfaces){
    assert.match(root.body,new RegExp('href="/'+id+'"'),id+" root link");
  }
});

test("Studio completion manifest separates implemented capability from evidence-gated proof",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/completion/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"SauceApproved Studio");
  assert.equal(body.executionPolicy,"fail-closed");
  assert.equal(body.surfacesReady,true);
  assert.equal(body.vintageCamera.deviceProofVerified,false);
  assert.equal(body.vintageCamera.fullQualityExportVerified,false);
  assert.equal(body.commercial.paidCheckoutEnabled,false);
  assert.ok(body.remainingOwnerOrPhysicalGates.includes("vintage-camera-physical-device-proof"));
  assert.ok(body.remainingOwnerOrPhysicalGates.includes("studio-commercial-approval-and-payment-proof"));
});

test("Integrations Hub is an inventory surface, not an authorization bypass",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/integrations/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"Hercules Integrations Hub");
  assert.equal(body.executionPolicy,"inventory-plan-authorize-fail-closed");
  assert.equal(body.autoConnect,false);
  assert.equal(body.credentialCollectionAllowed,false);
  assert.ok(body.differentiators.includes("Permission Boundary Map"));
  assert.ok(body.differentiators.includes("Connection Readiness Ledger"));
});

test("Commercial activation remains locked until separate verified approvals and payment proof exist",async()=>{
  const handle=createStudioHttpHandler();
  const checkout=await handle({method:"POST",pathname:"/api/studio/checkout"});
  assert.equal(checkout.status,423);
  const body=JSON.parse(checkout.body);
  assert.equal(body.ok,false);
  assert.equal(body.error,"studio_commercial_approval_and_payment_path_required");
});
