import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ai=await readFile(new URL("../supabase/functions/hercules-ai/index.ts",import.meta.url),"utf8");
const privacy=await readFile(new URL("../docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md",import.meta.url),"utf8");
const flow=await readFile(new URL("../docs/launch/HERCULES-PRODUCTION-DATA-FLOW-VERIFICATION-2026-09-27.md",import.meta.url),"utf8");

test("production AI allowlist excludes providers without verified privacy evidence",()=>{
  assert.match(ai,/provider:'LLM7'/);
  assert.match(ai,/provider:'KiloCode'/);
  assert.doesNotMatch(ai,/Yqcloud/);
  assert.doesNotMatch(privacy,/Yqcloud/);
  assert.doesNotMatch(flow,/Yqcloud/);
});

test("privacy evidence reflects the canonical standalone browser",()=>{
  assert.match(flow,/hercules-browser-standalone/);
  assert.match(flow,/playwright-local-chromium/);
  assert.doesNotMatch(flow,/Render-hosted Browserless upstream/);
});

test("privacy candidate avoids unsupported no-training guarantees",()=>{
  assert.match(privacy,/does not claim that all AI providers prohibit training/i);
  assert.match(privacy,/provider-specific/i);
  assert.doesNotMatch(privacy,/all prompts are never used for training/i);
});
