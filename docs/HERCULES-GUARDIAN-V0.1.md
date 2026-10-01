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

## Containment executor

The executor is dry-run-first. A containment proposal remains non-executing even when its evidence and planning authorization are valid.

Live containment requires independently: a Guardian deny verdict with scoped drift evidence; an AUTHORIZED_PLAN from the containment gate; a second explicit execution authorization bound to the exact target and scope; a containment adapter implementing both isolation and rollback; and post-isolation evidence confirming the target was isolated.

DRY_RUN is the default mode and never calls the adapter mutation method. Guardian proof objects and containment plans remain evidence/planning objects rather than execution credentials.

## Post-containment verification

A successful adapter response is not sufficient to declare containment complete. Guardian requires a separate observation bound to the same target and scope. Only an observation confirming isolation produces VERIFIED_CONTAINED.

A failed or negative observation produces CONTAINMENT_UNVERIFIED plus a rollback proposal. The rollback proposal carries executionAuthority=false and requires separate approval; verification failure never silently triggers recovery or expands containment scope.

## Tamper-evident incident ledger

Guardian incidents can be recorded as an append-only logical event chain. Each event contains a validated evidence SHA-256 digest and the digest of the immediately preceding event. The event's own digest binds sequence, event type, evidence, previous event, and target.

Verification recomputes the chain from the beginning. Altered evidence, reordered events, broken predecessor links, unsupported lifecycle events, or invalid digests invalidate the ledger. The ledger is evidence only: it grants no execution authority and stores no credentials.
