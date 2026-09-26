# Hercules Revenue Recovery v0.3 — Recovery Route Planner

The Route Planner binds the v0.1 current-invoice assessment to the v0.2 relationship graph and proposes the smallest safe next route.

## Why this layer exists

A reminder engine starts with a schedule. Hercules starts with evidence. The planner makes current invoice state authoritative, uses verified relationship history only as context, and produces an inspectable route rather than executing contact.

## Routes

- `NO_ACTION` — current evidence says no recovery contact is appropriate.
- `HUMAN_REVIEW` — current or historical integrity/safety state blocks routine contact.
- `OWNER_REVIEW_BEFORE_CONTACT` — contact may be possible, but relationship evidence requires explicit review.
- `OWNER_APPROVED_FOLLOW_UP` — current assessment permits contact and graph history adds no blocking evidence.

Every route has `executionAllowed=false`. v0.3 cannot send communications or escalate.

## Evidence binding

The route records the SHA-256 bindings from both the current assessment and Recovery Graph. Invalid bindings fail closed.

## Non-goals

No communication provider, collections agency, credit reporting, payment processing, recovery prediction, autonomous escalation, or production deployment.
