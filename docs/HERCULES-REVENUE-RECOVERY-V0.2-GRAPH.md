# Hercules Revenue Recovery v0.2 — Recovery Graph

The Recovery Graph is a deterministic relationship-history layer over verified receivables events.

It does **not** create a credit score, collectability score, recovery probability, or autonomous escalation decision. It records and summarizes evidence that can inform the existing per-invoice recovery assessment while preserving human approval and current-invoice safeguards.

## Owned facts

The graph can summarize verified payment timing, broken promises, dispute state, response history, and unverified observations. Unverified observations remain visible but cannot count toward adverse behavior metrics.

Every graph includes a SHA-256 evidence binding over the normalized relationship timeline.

## Guardrails

- duplicate event identities fail closed;
- unsupported event types fail closed;
- unverified events cannot drive adverse action;
- graph history alone never authorizes escalation;
- current invoice assessment remains required;
- no credit reporting or consumer scoring;
- no prediction that an invoice will be recovered.

## Verification

`node --test tests/hercules-recovery*.test.mjs`
