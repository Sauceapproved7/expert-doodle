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
const packetMigration=await readFile(
  new URL("../supabase/migrations/20260927210500_hercules_launch_approval_envelope_v2.sql",import.meta.url),
  "utf8"
);
const privacy=await readFile(
  new URL("../docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md",import.meta.url),
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

test("auth hardening is system-computed and cannot be owner self-approved",()=>{
  assert.match(bridge,/approvalType==='auth_hardening'&&decision==='approved'/);
  assert.match(bridge,/auth_hardening_is_system_computed/);
  assert.match(bridge,/hercules_password_defense_status/);
  assert.match(bridge,/hercules-password-defense-v2/);
  assert.match(ui,/System-computed from live Hercules Password Defense v2 evidence/);
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


test("launch approval envelope v2 is locked to the exact current canonical documents",()=>{
  assert.match(bridge,/hercules-launch-packet-2026-09-27-v2/);
  assert.match(bridge,/e2166a626887f9c5995f409d6ce91900ef2175bcc6e221b6bffec46ce657a086/);
  assert.match(bridge,/85ecbdc37e4d73cdf1b6c3f9987fac8a57c47f00/);
  assert.match(bridge,/e607d7e992458b9a7f0cca82cdeb216cae47eab5/);
  assert.match(bridge,/5bb5022e464c68ba27e80a1a2bfaa430c624cc44/);
  assert.match(packetMigration,/hercules-launch-packet-2026-09-27-v2/);
  assert.match(packetMigration,/e2166a626887f9c5995f409d6ce91900ef2175bcc6e221b6bffec46ce657a086/);
  assert.match(packetMigration,/5bb5022e464c68ba27e80a1a2bfaa430c624cc44/);
});

test("privacy candidate reflects live data-rights and retention evidence before packet v2 approval",()=>{
  assert.match(privacy,/FINAL CANDIDATE v0\.4/);
  assert.match(privacy,/Hercules Data Rights Operations v2/);
  assert.match(privacy,/HERCULES-RETENTION-VERIFICATION-2026-09-27\.md/);
  assert.doesNotMatch(privacy,/complete the reviewed export-delivery and deletion-execution phases/i);
  assert.doesNotMatch(privacy,/confirm internal retention practices against production behavior/i);
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
  assert.match(bridge,/APPROVE HERCULES LAUNCH PACKET/);
  assert.match(block,/LAUNCH_PACKET_CONFIRMATION/);
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
