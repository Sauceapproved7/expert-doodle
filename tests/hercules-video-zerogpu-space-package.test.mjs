import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const app=await readFile(new URL("../deploy/huggingface/hercules-video-wan22-zerogpu/app.py",import.meta.url),"utf8");
const req=await readFile(new URL("../deploy/huggingface/hercules-video-wan22-zerogpu/requirements.txt",import.meta.url),"utf8");
const readme=await readFile(new URL("../deploy/huggingface/hercules-video-wan22-zerogpu/README.md",import.meta.url),"utf8");

test("ZeroGPU Space consumes the canonical Hercules render request",()=>{
  assert.match(app,/sauceapproved\.hercules\.video-render-request/);
  assert.match(app,/requestFingerprint/);
  assert.match(app,/@spaces\.GPU\(size="large", duration=300\)/);
  assert.match(app,/Wan-AI\/Wan2\.2-TI2V-5B-Diffusers/);
});

test("ZeroGPU Space emits artifact evidence instead of fabricated success",()=>{
  assert.match(app,/hashlib\.sha256/);
  assert.match(app,/sauceapproved\.hercules\.video-render-artifact-evidence/);
  assert.match(app,/"fabricated": False/);
  assert.match(app,/export_to_video/);
});

test("benchmark renderer is deliberately constrained",()=>{
  assert.match(app,/SUPPORTED_RATIOS/);
  assert.match(app,/"16:9"/);
  assert.match(app,/"9:16"/);
  assert.match(app,/restricted to 720p/);
  assert.match(app,/fixed at 24 FPS/);
  assert.match(app,/limited to 3 seconds/);
  assert.match(app,/min\(73,/);
  assert.match(app,/num_inference_steps=35/);
});

test("Space package uses dependencies rather than copied vendor source",()=>{
  assert.match(req,/diffusers/);
  assert.match(req,/transformers/);
  assert.match(req,/spaces/);
  assert.match(readme,/Third-party rights remain/);
  assert.match(readme,/Apache-2\.0/);
});
