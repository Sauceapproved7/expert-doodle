# Hercules Guardian v0.1

Hercules Guardian is the SauceApproved-owned defensive runtime-verification layer.

## Contract

Guardian compares a declared known-good state with observed runtime evidence across four mandatory dimensions:

- artifact identity;
- configuration identity;
- workload/service identity;
- policy identity.

It fails closed. Missing baseline or observation is drift, not permission.

## Proof-of-State

Every evaluation returns a deterministic evidence envelope with a content-derived Guardian proof ID. The proof records the target, expected state, observed state, and exact drift without containing credentials.

## Blast-Radius Lock

A denied verdict creates a scoped containment plan for the affected target only. v0.1 does **not** execute network, process, deployment, or infrastructure mutations. That separation prevents detection logic from becoming an uncontrolled kill switch.

## Recovery

Denied evaluations request a handoff to Hercules Time Machine. Guardian identifies the affected target and evidence; the existing recovery layer remains responsible for restoring a separately verified known-good state.

## Safety boundaries

Guardian is defensive only. It does not exploit systems, evade controls, harvest credentials, scan third-party targets, or automatically mutate production. Any future containment executor must preserve authorization, least privilege, evidence, rollback, and fail-closed behavior.

## Verification

```sh
node --test tests/hercules-guardian.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```
