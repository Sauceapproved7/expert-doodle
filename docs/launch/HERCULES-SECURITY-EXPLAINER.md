# Hercules Security — Customer Explainer

Hercules is designed around controlled execution rather than hidden autonomy.

## Customer controls

- Workspace access is scoped to authenticated membership and role.
- Customer actions are checked against plan/usage boundaries.
- Consequential work is represented by evidence before execution.
- Declared consequences are checked against authority ceilings.
- Recovery is classified as rollback, compensation, or manual-only rather than pretending every external action can be undone.
- Proof records bind important execution and verification evidence.
- Provider credentials stay outside customer-visible payloads and must remain in trusted server/runtime boundaries.

## What Hercules does not claim

Hercules does not claim that a SHA-256 digest makes upstream information true. Integrity proves that recorded evidence has not changed; independent verification still matters.

Hercules does not treat staging tests as production uptime.

Hercules does not grant itself external provider permissions.

## Reporting

Security issues should have a documented intake path before public launch. The launch operator must configure a monitored support/security contact and incident process before unrestricted customer registration.
