import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Studio exposes Performance Brain manifest as evidence-only and non-publishing",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"GET",pathname:"/api/studio/performance-brain/manifest"});
  assert.equal(response.status,200);
  const body=JSON.parse(response.body);
  assert.equal(body.product,"Hercules Performance Brain");
  assert.equal(body.executionPolicy,"evidence-analysis-only");
  assert.equal(body.autoPublish,false);
  assert.equal(body.autoSpend,false);
  assert.ok(body.differentiators.includes("Evidence Grade"));
  assert.ok(body.differentiators.includes("Outcome Loop"));
});
