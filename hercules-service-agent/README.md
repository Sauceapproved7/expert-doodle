# Hercules Service Agent v1

Defensive, customer-authorized computer-service orchestration for SauceApproved Hercules.

## Safety contract

- Explicit customer consent is required before a service session exists.
- Sessions start diagnostic/read-only.
- Private documents, messages, browser secrets, passwords and credentials are excluded by default.
- Machine mutation requires explicit repair approval.
- A verified Recovery Capsule is mandatory before a repair plan can be produced.
- Repair plans fail closed and require post-repair verification.
- The Service Agent is designed to reuse Hercules Cleaner, device identity, recovery capsules and existing Windows packaging rather than bypass operating-system security.

## v1 flow

Customer authorization → device identity → technical-health diagnosis → repair approval → verified Recovery Capsule → allow-listed repair module → post-repair verification → audit/report.

This initial slice establishes the authorization and recovery gates. OS-specific diagnostic adapters and allow-listed repair modules are added behind these gates.
