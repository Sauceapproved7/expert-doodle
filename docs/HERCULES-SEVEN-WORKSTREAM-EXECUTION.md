# Hercules Seven-Workstream Execution

This is the controlled implementation order for turning the existing Hercules components into a coherent customer-facing platform.

1. Trust Runtime — Proof Object, Consequence Envelope, evidence binding, Time Machine recovery, then authority/witness/simulation primitives.
2. Unified Execution — one fail-closed job lifecycle: intent -> authority -> consequence -> action boundary -> verification -> proof -> recovery record.
3. Command Surface — one Hercules-owned command contract that routes to owned capabilities without exposing provider-specific concerns.
4. Production Hardening — failure injection, integrity corruption, permission-boundary, concurrency, recovery, performance, dependency-failure, and security evidence.
5. Customer Foundation — workspace isolation, authentication boundary, onboarding, usage/metering contract, audit history, plan/billing adapter boundaries, and polished Hercules presentation.
6. Revenue Wedge — productize Revenue Recovery as the first complete customer workflow using the shared trust/execution foundation.
7. Trust Expansion — scoped authority leases, independent witness evidence, pre-action future simulation, and institutional decision memory.

## Release rule
Each workstream advances through small feature branches and exact-head verification. Later work may be designed while an earlier PR is under review, but canonical dependencies are not claimed complete until their required gates pass.

## Hercules quality rule
Every customer-visible surface follows the Hercules Build Standard. Every protected runtime component must provide executable acceptance evidence appropriate to its risk.
