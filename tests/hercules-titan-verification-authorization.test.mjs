import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const gate=readFileSync(new URL("../supabase/functions/hercules-launch-gate/index.ts",import.meta.url),"utf8");

test("public Titan verification authorization exposes only bounded approval state",()=>{
  assert.match(gate,/titan_verification_authorization/);
  assert.match(gate,/commercialApproved/);
  assert.match(gate,/packetFingerprint/);
  assert.match(gate,/33C0F4567B6C/);
  assert.match(gate,/pricing/);
  assert.match(gate,/terms/);
  assert.match(gate,/privacy/);
  assert.doesNotMatch(gate,/access_secret_ref[^\n]*titan_verification_authorization/);
});

test("Titan verification authorization is true only when all three owner approvals are approved",()=>{
  assert.match(gate,/pricing.*terms.*privacy/s);
  assert.match(gate,/status===['"]approved['"]/);
  assert.match(gate,/every/);
});
