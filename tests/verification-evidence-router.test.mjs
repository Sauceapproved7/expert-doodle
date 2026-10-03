import test from "node:test";
import assert from "node:assert/strict";
import { routeVerificationEvidence } from "../hercules-runtime/verification-evidence-router.mjs";

test("fails closed when evidence is missing or stale", () => {
  const result = routeVerificationEvidence([
    { id: "DA-20", kind: "dns", evidenceFresh: false, provenance: null, ownerOnly: false }
  ]);
  assert.deepEqual(result.autoResume, []);
  assert.equal(result.checkpoints[0].decision, "hold");
  assert.match(result.checkpoints[0].reason, /fresh verified evidence/i);
});

test("auto-resumes only authorized non-owner work with fresh provenance", () => {
  const result = routeVerificationEvidence([
    {
      id: "DA-42",
      kind: "shopify_reconciliation",
      evidenceFresh: true,
      provenance: { source: "shopify-admin", fingerprint: "sha256:abc" },
      ownerOnly: false,
      authorized: true,
      requestedAction: "reconcile_verified_paid_orders"
    }
  ]);
  assert.deepEqual(result.autoResume, [{
    id: "DA-42",
    action: "reconcile_verified_paid_orders",
    provenanceFingerprint: "sha256:abc"
  }]);
  assert.equal(result.checkpoints[0].decision, "auto_resume");
});

test("owner-only boundaries never become automatic actions", () => {
  const result = routeVerificationEvidence([
    {
      id: "DA-27",
      kind: "live_payment",
      evidenceFresh: true,
      provenance: { source: "stripe-live", fingerprint: "sha256:def" },
      ownerOnly: true,
      authorized: true,
      requestedAction: "start_live_charge"
    }
  ]);
  assert.deepEqual(result.autoResume, []);
  assert.deepEqual(result.ownerActions, ["DA-27"]);
  assert.equal(result.checkpoints[0].decision, "owner_action");
});

test("provider readiness cannot stand in for payment-path proof", () => {
  const result = routeVerificationEvidence([
    {
      id: "DA-27",
      kind: "payment_path",
      evidenceFresh: true,
      provenance: { source: "stripe-live", fingerprint: "sha256:ghi" },
      ownerOnly: false,
      authorized: true,
      requestedAction: "mark_payment_path_verified",
      providerReady: true,
      paymentProof: { checkout: true, refund: false, payout: false }
    }
  ]);
  assert.deepEqual(result.autoResume, []);
  assert.equal(result.checkpoints[0].decision, "hold");
  assert.match(result.checkpoints[0].reason, /checkout, refund, and payout/i);
});

test("complete payment proof permits downstream reconciliation but never fabricates proof", () => {
  const result = routeVerificationEvidence([
    {
      id: "DA-27",
      kind: "payment_path",
      evidenceFresh: true,
      provenance: { source: "stripe-live", fingerprint: "sha256:jkl" },
      ownerOnly: false,
      authorized: true,
      requestedAction: "reconcile_payment_evidence",
      providerReady: true,
      paymentProof: { checkout: true, refund: true, payout: true }
    }
  ]);
  assert.equal(result.checkpoints[0].decision, "auto_resume");
  assert.deepEqual(result.autoResume[0], {
    id: "DA-27",
    action: "reconcile_payment_evidence",
    provenanceFingerprint: "sha256:jkl"
  });
});
