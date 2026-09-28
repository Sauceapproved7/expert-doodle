import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const source=await readFile(new URL("../supabase/functions/hercules-preview-cell/index.ts",import.meta.url),"utf8");

test("public artifact certification is one-time authorized and host allowlisted",()=>{
  assert.match(source,/\/video\/certify-public-artifact/);
  assert.match(source,/x-hercules-e2e-nonce/);
  assert.match(source,/hercules_forge_e2e_nonces/);
  assert.match(source,/zerogpu-aoti-wan2-2-fp8da-aoti-faster\.hf\.space/);
  assert.match(source,/certification_artifact_host_denied/);
});

test("certification verifies real MP4 bytes and persists evidence",()=>{
  assert.match(source,/certification_artifact_empty/);
  assert.match(source,/25\*1024\*1024/);
  assert.match(source,/signature!=='ftyp'/);
  assert.match(source,/SHA-256|SHA256|crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source,/video-certifications\//);
  assert.match(source,/certificationFingerprint/);
  assert.match(source,/fabricatedOutput:false/);
});

test("benchmark adapters cannot satisfy production capacity",()=>{
  assert.match(source,/production_capacity_certified===true/);
  assert.match(source,/benchmark_only===true/);
  assert.match(source,/benchmarkRendererAvailable/);
  assert.match(source,/production_renderer_not_certified/);
});

test("Studio runtime reports benchmark and production readiness separately",()=>{
  assert.match(source,/benchmarkRenderAvailable/);
  assert.match(source,/certified benchmark renderer online · production capacity unavailable/);
  assert.match(source,/production renderer certified/);
});

test("production video render remains fail-closed",()=>{
  assert.match(source,/video_render_capacity_unavailable/);
  assert.match(source,/no_certified_video_renderer_online/);
  assert.match(source,/queued:false/);
});
