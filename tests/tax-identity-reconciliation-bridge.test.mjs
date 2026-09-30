import test from "node:test";
import assert from "node:assert/strict";
import { reconcileTaxIdentity } from "../hercules-base/tax-identity-reconciliation-bridge.mjs";

const state = { legalName: "SauceApproved enterprise LLC" };

test("fails closed when provider legal name differs from state record", () => {
  const result = reconcileTaxIdentity({
    stateRecord: state,
    irsRecord: { recordName: "McRae Enterprise", taxIdLast4: "1088" },
    providerRecord: { legalName: "Other Name", taxIdLast4: "1088" },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_legal_name_mismatch");
  assert.equal(result.writesAllowed, false);
});

test("requires owner identity decision when IRS record is not issued to LLC", () => {
  const result = reconcileTaxIdentity({
    stateRecord: state,
    irsRecord: { recordName: "Aaron W McRae / McRae Enterprise", taxIdLast4: "1088" },
    providerRecord: { legalName: "SauceApproved enterprise LLC", taxIdLast4: "1088" },
  });
  assert.equal(result.status, "owner_identity_decision_required");
  assert.equal(result.reason, "irs_record_not_issued_to_llc");
  assert.equal(result.writesAllowed, false);
});

test("blocks when LLC-issued IRS evidence and provider tax-id suffix differ", () => {
  const result = reconcileTaxIdentity({
    stateRecord: state,
    irsRecord: { recordName: "SauceApproved enterprise LLC", taxIdLast4: "1088" },
    providerRecord: { legalName: "SauceApproved enterprise LLC", taxIdLast4: "9999" },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "tax_id_evidence_mismatch");
  assert.equal(result.writesAllowed, false);
});

test("allows provider write only when legal name and redacted tax evidence align", () => {
  const result = reconcileTaxIdentity({
    stateRecord: state,
    irsRecord: { recordName: "SauceApproved enterprise LLC", taxIdLast4: "1088" },
    providerRecord: { legalName: "SauceApproved enterprise LLC", taxIdLast4: "1088" },
  });
  assert.equal(result.status, "identity_evidence_aligned");
  assert.equal(result.writesAllowed, true);
});
