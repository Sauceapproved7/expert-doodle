# Hercules Time Machine v0.1

Hercules Time Machine records an evidence-bound restore point around a consequential action and produces a fail-closed recovery plan.

## Restore point
A restore point binds:
- proposed action and target
- authorization evidence SHA-256
- before-state evidence
- after-state evidence
- declared dependencies
- recovery classification and target
- deterministic integrity digest

## Recovery classes
- ROLLBACK — the recorded prior state can be restored.
- COMPENSATE — the external effect is not truthfully reversible; a compensating operation is required.
- MANUAL_ONLY — automated recovery is unsafe or unsupported.

Unverified recovery information degrades to MANUAL_ONLY.

## Safety boundary
Time Machine v0.1 never executes recovery. Every plan requires approval and has executionAuthority=false. A restore point is evidence, not permission. It does not prove that every dependency was discovered or that the declared recovery target will succeed.

Irreversible external actions must never be represented as rollback merely to make a workflow appear recoverable.
