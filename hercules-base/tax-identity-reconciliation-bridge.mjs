/**
 * Hercules Tax Identity Reconciliation Bridge
 *
 * SECURITY: This module never stores or guesses a full SSN/EIN. It compares
 * redacted identity metadata and produces a fail-closed action plan.
 */

export function reconcileTaxIdentity({ stateRecord, irsRecord, providerRecord }) {
  const exactLegalName = stateRecord?.legalName?.trim();
  const providerName = providerRecord?.legalName?.trim();
  const irsName = irsRecord?.recordName?.trim();

  if (!exactLegalName) {
    return { status: "blocked", reason: "missing_state_legal_name", writesAllowed: false };
  }

  const stateProviderNameMatch = providerName === exactLegalName;
  const irsIssuedToLlc = irsName === exactLegalName;
  const providerTaxIdLast4 = providerRecord?.taxIdLast4 ?? null;
  const irsTaxIdLast4 = irsRecord?.taxIdLast4 ?? null;
  const taxIdLast4Match =
    Boolean(providerTaxIdLast4) &&
    Boolean(irsTaxIdLast4) &&
    providerTaxIdLast4 === irsTaxIdLast4;

  if (!stateProviderNameMatch) {
    return {
      status: "blocked",
      reason: "provider_legal_name_mismatch",
      writesAllowed: false,
      expectedLegalName: exactLegalName,
    };
  }

  if (!irsIssuedToLlc) {
    return {
      status: "owner_identity_decision_required",
      reason: "irs_record_not_issued_to_llc",
      writesAllowed: false,
      expectedLegalName: exactLegalName,
      irsRecordName: irsName ?? null,
      taxIdLast4Match,
      safeNextActions: [
        "Use the payment provider's supported single-member-LLC owner-tax-ID path if applicable.",
        "Otherwise provide IRS evidence issued to the LLC under the exact legal name.",
      ],
    };
  }

  if (!taxIdLast4Match) {
    return {
      status: "blocked",
      reason: "tax_id_evidence_mismatch",
      writesAllowed: false,
      expectedLegalName: exactLegalName,
    };
  }

  return {
    status: "identity_evidence_aligned",
    reason: null,
    writesAllowed: true,
    expectedLegalName: exactLegalName,
  };
}
