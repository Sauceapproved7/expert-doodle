import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const source=await readFile(new URL("../supabase/functions/hercules-preview-cell/index.ts",import.meta.url),"utf8");

test("Preview Cell exposes the owned Hercules Video health contract",()=>{
  assert.match(source,/relative==='\/video\/health'/);
  assert.match(source,/service:'hercules-video-bridge'/);
  assert.match(source,/engine:'hercules-video'/);
  assert.match(source,/executionPolicy:'fail-closed'/);
  assert.match(source,/canonicalRequestSchema:'sauceapproved\.hercules\.video-render-request'/);
});

test("video mutations require an owner or admin",()=>{
  assert.match(source,/if\(req\.method==='POST'&&relative==='\/video\/render'\)/);
  assert.match(source,/const a=await operator\(req\);if\(!a\)return out\(\{error:'owner_or_admin_required'\},401\)/);
  assert.match(source,/\.in\('role',\['owner','admin'\]\)/);
});

test("video render requests use the canonical provider-neutral schema",()=>{
  assert.match(source,/schema:'sauceapproved\.hercules\.video-render-request'/);
  assert.match(source,/requestFingerprint:await fingerprint\(normalized\)/);
  assert.match(source,/project_id_required/);
  assert.match(source,/shot_prompt_required/);
  assert.match(source,/render_fps_invalid/);
});

test("video execution fails closed when no certified renderer is online",()=>{
  assert.match(source,/no_certified_video_renderer_online/);
  assert.match(source,/video_render_capacity_unavailable/);
  assert.match(source,/queued:false/);
  assert.match(source,/fabricated_output:false/);
});

test("Studio preview receives a live Hercules Video runtime indicator",()=>{
  assert.match(source,/Hercules Video Runtime/);
  assert.match(source,/\/functions\/v1\/hercules-preview-cell\/video\/health/);
  assert.match(source,/Bridge connected · render capacity unavailable · fail-closed/);
});
