import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(
  new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),
  "utf8"
);
const ui=await readFile(
  new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),
  "utf8"
);

test("decision backend exposes status without changing approvals",()=>{
  assert.match(bridge,/action==='launch_approval_status'/);
  assert.match(bridge,/hercules_launch_approvals/);
  assert.match(bridge,/publicRegistrationOpen/);
});

test("launch decisions are owner-only",()=>{
  const block=bridge.slice(
    bridge.indexOf("if(action==='launch_approval_decide')"),
    bridge.indexOf("if(action==='spaceship_dns_status')")
  );
  assert.match(block,/String\(a\.m\.role\)!=='owner'/);
  assert.match(block,/owner_required/);
});

test("pricing terms and privacy require explicit typed confirmation",()=>{
  assert.match(bridge,/explicit_confirmation_required/);
  assert.match(bridge,/APPROVE /);
  assert.match(bridge,/REJECT /);
  assert.match(bridge,/RESET /);
  assert.match(ui,/window\.prompt\('Type exactly: '/);
});

test("auth hardening cannot be self-approved",()=>{
  assert.match(bridge,/approvalType==='auth_hardening'&&decision==='approved'/);
  assert.match(bridge,/auth_hardening_requires_verified_platform_evidence/);
  assert.match(bridge,/leaked-password protection/);
  assert.match(ui,/Requires verified leaked-password protection evidence/);
});

test("decision writes are audited and launch gate is refreshed",()=>{
  assert.match(bridge,/resource_type:'hercules_launch_approval'/);
  assert.match(bridge,/launch\.approval\.'/);
  assert.match(bridge,/refreshLaunchGate/);
  assert.match(bridge,/functions\/v1\/hercules-launch-gate/);
});

test("decision center preserves public registration as a separate explicit release gate",()=>{
  assert.match(bridge,/public-registration-open/);
  assert.match(ui,/General public registration/);
  assert.doesNotMatch(bridge,/value:\{open:true\}/);
  assert.doesNotMatch(bridge,/public-registration-open'[\s\S]{0,300}update/);
});

test("UI links prepared documents but does not auto-approve them",()=>{
  assert.match(ui,/HERCULES-PRICING-PROPOSAL\.md/);
  assert.match(ui,/HERCULES-TERMS-OF-SERVICE-DRAFT\.md/);
  assert.match(ui,/HERCULES-PRIVACY-POLICY-DRAFT\.md/);
  assert.match(ui,/HERCULES-AUTH-SECURITY-REVIEW-2026-09-27\.md/);
  assert.doesNotMatch(ui,/launch_approval_decide[^\n]+decision:'approved'/);
});


test("decision status does not expose owner user identifiers",()=>{
  const statusFn=bridge.slice(
    bridge.indexOf("async function launchApprovalStatus"),
    bridge.indexOf("async function refreshLaunchGate")
  );
  assert.doesNotMatch(statusFn,/approved_by/);
  assert.doesNotMatch(statusFn,/approvedBy/);
});


test("launch approval envelope is locked to exact canonical document versions",()=>{
  assert.match(bridge,/hercules-launch-packet-2026-09-27-v1/);
  assert.match(bridge,/2531abae2cf8caae0af2d153feac617d4b21ce7976476c49ced57a5956615690/);
  assert.match(bridge,/85ecbdc37e4d73cdf1b6c3f9987fac8a57c47f00/);
  assert.match(bridge,/e607d7e992458b9a7f0cca82cdeb216cae47eab5/);
  assert.match(bridge,/e88a83a7cb4ce5f01a3049eddfc80f84643c5b8c/);
});

test("one owner approval can atomically decide pricing terms and privacy",()=>{
  const block=bridge.slice(
    bridge.indexOf("if(action==='launch_approval_bundle_decide')"),
    bridge.indexOf("if(action==='spaceship_dns_status')")
  );
  assert.ok(block.length>0);
  assert.match(block,/String\(a\.m\.role\)!=='owner'/);
  assert.match(block,/owner_required/);
  assert.match(block,/hercules_launch_approval_bundle_decide/);
  assert.match(block,/APPROVE HERCULES LAUNCH PACKET/);
  assert.match(block,/refreshLaunchGate/);
});

test("bundle approval refuses stale packets or missing auth hardening",()=>{
  assert.match(bridge,/launch_packet_version_mismatch/);
  assert.match(bridge,/launch_packet_digest_mismatch/);
  assert.match(bridge,/auth_hardening_required_before_launch_packet/);
});

test("decision center exposes one consolidated owner action without auto approval",()=>{
  assert.match(ui,/Launch Approval Envelope/);
  assert.match(ui,/Approve launch packet/);
  assert.match(ui,/APPROVE HERCULES LAUNCH PACKET/);
  assert.match(ui,/launch_approval_bundle_decide/);
  assert.doesNotMatch(ui,/launch_approval_bundle_decide[^\n]+confirmation:['"]APPROVE HERCULES LAUNCH PACKET/);
});
