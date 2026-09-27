# Hercules Unified Execution v0.1

The unified execution lifecycle is the shared fail-closed control path for consequential Hercules work.

## Lifecycle

Intent -> authorization evidence -> consequence evidence -> proof/consequence binding -> restore point -> approval gate -> authorized execution boundary -> later verification/proof updates.

v0.1 stops before execution. It decides only whether the evidence package is internally consistent enough to be presented for authorized execution.

## Requirements

A lifecycle must bind the same authorization evidence SHA-256 across:
- Proof Object
- Consequence Envelope
- Proof/Consequence Binding
- Time Machine restore point

Each source object must independently verify.

If the consequence disposition requires human review, if any integrity check fails, if recovery evidence is invalid, or if authorization evidence differs, the lifecycle fails closed.

## States

- READY_FOR_AUTHORIZED_EXECUTION
- HUMAN_REVIEW

Both states have executionAuthority=false. READY is not permission. It means the recorded evidence package is internally consistent and still requires an external authorized execution boundary.

## Non-goals

v0.1 does not:
- execute tools or provider actions
- create or expand authority
- choose credentials
- bypass provider permissions
- claim that declared consequences are complete
- claim that recovery will succeed
- replace independent post-action verification
