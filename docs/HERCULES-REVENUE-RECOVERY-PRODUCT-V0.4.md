# Hercules Revenue Recovery Product v0.4

v0.4 composes the existing recovery assessment, verified relationship graph, and route planner into one customer-facing recovery case.

The product case exposes:
- current invoice state
- balance and days overdue
- priority score
- confidence
- safe-to-contact state
- recommended route
- approval requirement
- evidence/reason codes
- assessment and graph SHA-256 bindings

## Safety boundary

The product case does not send communications, perform escalation, predict recovery, or create a credit/collectability score. It preserves the underlying v0.1-v0.3 guardrails.

Routes remain:
- NO_ACTION
- HUMAN_REVIEW
- OWNER_REVIEW_BEFORE_CONTACT
- OWNER_APPROVED_FOLLOW_UP

`executionAuthority` is always false. A customer-approved follow-up still has to pass customer entitlement, command, unified execution, authority, provider, and post-action proof boundaries before any external action occurs.
