import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("../supabase/functions/hercules-tax-identity-bridge/index.ts",import.meta.url),"utf8");

test("tax identity bridge never exports or logs a full tax identifier",()=>{
  assert.doesNotMatch(source,/company\[tax_id\]|tax_id\s*=|SSN|fullEin|fullTaxId/);
  assert.match(source,/fullTaxIdentifierStored/);
});

test("tax identity bridge fails closed on legacy IRS ownership mismatch",()=>{
  assert.match(source,/owner_identity_decision_required/);
  assert.match(source,/irs_record_not_issued_to_llc/);
  assert.match(source,/writesAllowed:false/);
});

test("tax identity bridge inspects live Stripe requirements",()=>{
  assert.match(source,/verification_failed_tax_id_match/);
  assert.match(source,/requirements/);
});

test("tax identity bridge writes only bounded reconciliation evidence",()=>{
  assert.match(source,/tax-identity-reconciliation/);
  assert.match(source,/hercules_continuity_ledger/);
  assert.doesNotMatch(source,/console\.log\([^\n]*(?:tax|ein|ssn)/i);
});
