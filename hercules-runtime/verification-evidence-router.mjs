const PAYMENT_PROOF_FIELDS = ["checkout", "refund", "payout"];

function validProvenance(provenance) {
  if (!provenance || typeof provenance !== "object") return false;
  const source = String(provenance.source ?? "").trim();
  const fingerprint = String(provenance.fingerprint ?? "").trim();
  return source.length > 0 && /^sha256:[A-Za-z0-9._:-]+$/.test(fingerprint);
}

function hasCompletePaymentProof(paymentProof) {
  if (!paymentProof || typeof paymentProof !== "object") return false;
  return PAYMENT_PROOF_FIELDS.every((field) => paymentProof[field] === true);
}

function normalizeCheckpoint(input) {
  const checkpoint = input && typeof input === "object" ? input : {};
  return {
    id: String(checkpoint.id ?? "").trim(),
    kind: String(checkpoint.kind ?? "").trim(),
    evidenceFresh: checkpoint.evidenceFresh === true,
    ownerOnly: checkpoint.ownerOnly === true,
    authorized: checkpoint.authorized === true,
    requestedAction: String(checkpoint.requestedAction ?? "").trim(),
    provenance: checkpoint.provenance ?? null,
    providerReady: checkpoint.providerReady === true,
    paymentProof: checkpoint.paymentProof ?? null
  };
}

function routeCheckpoint(rawCheckpoint) {
  const checkpoint = normalizeCheckpoint(rawCheckpoint);

  if (!checkpoint.id) {
    return {
      id: "",
      decision: "hold",
      reason: "Checkpoint id is required before any verification action can run."
    };
  }

  if (!checkpoint.evidenceFresh || !validProvenance(checkpoint.provenance)) {
    return {
      id: checkpoint.id,
      decision: "hold",
      reason: "Fresh verified evidence with bound provenance is required before any automatic resume."
    };
  }

  if (checkpoint.ownerOnly) {
    return {
      id: checkpoint.id,
      decision: "owner_action",
      reason: "This checkpoint crosses an owner-only authorization boundary and cannot be automated."
    };
  }

  if (!checkpoint.authorized) {
    return {
      id: checkpoint.id,
      decision: "hold",
      reason: "The requested provider or system action is not currently authorized."
    };
  }

  if (!checkpoint.requestedAction) {
    return {
      id: checkpoint.id,
      decision: "hold",
      reason: "An explicit bounded downstream action is required before automatic resume."
    };
  }

  if (checkpoint.kind === "payment_path") {
    if (!checkpoint.providerReady || !hasCompletePaymentProof(checkpoint.paymentProof)) {
      return {
        id: checkpoint.id,
        decision: "hold",
        reason: "Payment-path verification requires independent checkout, refund, and payout evidence; provider readiness alone is insufficient."
      };
    }
  }

  return {
    id: checkpoint.id,
    decision: "auto_resume",
    action: checkpoint.requestedAction,
    provenanceFingerprint: checkpoint.provenance.fingerprint,
    reason: "Fresh authorized evidence permits the bounded downstream action."
  };
}

export function routeVerificationEvidence(checkpoints = []) {
  if (!Array.isArray(checkpoints)) {
    throw new TypeError("checkpoints must be an array");
  }

  const routed = checkpoints.map(routeCheckpoint);

  return {
    schema: "sauceapproved.hercules.verification-evidence-router",
    version: 1,
    checkpoints: routed,
    autoResume: routed
      .filter((item) => item.decision === "auto_resume")
      .map(({ id, action, provenanceFingerprint }) => ({ id, action, provenanceFingerprint })),
    ownerActions: routed
      .filter((item) => item.decision === "owner_action")
      .map((item) => item.id),
    holds: routed
      .filter((item) => item.decision === "hold")
      .map(({ id, reason }) => ({ id, reason }))
  };
}
