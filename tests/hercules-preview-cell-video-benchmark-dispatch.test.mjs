import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const source=await readFile(new URL("../supabase/functions/hercules-preview-cell/index.ts",import.meta.url),"utf8");

test("benchmark renders require owner or admin authentication",()=>{
  assert.match(source,/if\(req\.method==='POST'&&relative==='\/video\/render'\)/);
  assert.match(source,/const a=await operator\(req\);if\(!a\)return out\(\{error:'owner_or_admin_required'\},401\)/);
  assert.match(source,/\.in\('role',\['owner','admin'\]\)/);
});

test("benchmark dispatch is tightly bounded",()=>{
  assert.match(source,/benchmark_duration_limit/);
  assert.match(source,/benchmark_fps_must_be_16/);
  assert.match(source,/benchmark_resolution_must_be_480p/);
  assert.match(source,/benchmark_seed_required/);
  assert.match(source,/request\.shot\.durationSeconds>0\.5/);
  assert.match(source,/request\.output\.fps!==16/);
});

test("benchmark image inputs are allowlisted",()=>{
  assert.match(source,/raw\.githubusercontent\.com/);
  assert.match(source,/xbwuablxhhwsaoomsoco\.supabase\.co/);
  assert.match(source,/benchmark_image_reference_host_denied/);
});

test("dispatch uses only the certified benchmark adapter",()=>{
  assert.match(source,/hf-public-zerogpu-fast-wan22-i2v/);
  assert.match(source,/benchmark_only/);
  assert.match(source,/certification_fingerprint/);
  assert.match(source,/production_capacity_certified===true/);
  assert.match(source,/benchmark_adapter_classification_invalid/);
});

test("benchmark jobs are durable and idempotent",()=>{
  assert.match(source,/hercules_execution_jobs/);
  assert.match(source,/video-benchmark:/);
  assert.match(source,/idempotency_key:idem/);
  assert.match(source,/execution_class:'benchmark'/);
  assert.match(source,/workload_type:'video\.render'/);
  assert.match(source,/status:'succeeded'/);
  assert.match(source,/status:'failed'/);
});

test("benchmark artifacts are real MP4 bytes with Hercules evidence",()=>{
  assert.match(source,/benchmark_artifact_not_mp4/);
  assert.match(source,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source,/video-renders\/benchmark\//);
  assert.match(source,/fabricated_output:false/);
  assert.match(source,/authorization_bypassed:false/);
});

test("production mode remains fail-closed and separate",()=>{
  assert.match(source,/production_renderer_not_certified/);
  assert.match(source,/no_certified_production_video_renderer_online/);
  assert.match(source,/video_render_capacity_unavailable/);
  assert.match(source,/queued:false/);
});
