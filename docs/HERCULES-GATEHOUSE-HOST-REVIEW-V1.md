# Hercules Gatehouse ↔ Host Engine sandbox review V1

## Security boundary

Hercules Gatehouse is and remains a **read-only command center**. It does not possess owner private signing material, approve production, create, sign or issue permits, run Docker, make provider changes, or change live launch/commerce policy.

`hercules/gatehouse/host-review.mjs` accepts a canonical Hercules Host Engine sandbox plan and proposed `start` or `rollback` action. It validates exact plan syntax and digest with existing Host Engine code, then prepares a narrowly sanitized review containing plan identity and **unverified** independent-provider cost, VM ownership, host runtime, owner signature, nonce consumption and approval fields. Passing syntax **never** sets `readyForSandboxExecution` or `ownerApprovalGranted` to true. The caller may present provider or approval-looking flags; those fields are ignored.

## Owner approval and execution separation

1. Hercules Cloud can prepare a source-verified immutable sandbox plan in its *separate* preflight.
2. Gatehouse can display or export this **read-only** assessment; any web/API integration would require separate authentication/security review and is not added here.
3. A separately controlled **owner signer** must explicitly authorize and sign the exact plan/action with an Ed25519 private key kept off the execution host.
4. On an actual authorized owner host, the default-off Host Engine verifies the signed permit against its root-managed installed public key, its one-use replay store and actual rootless Docker UID/socket. Gatehouse supplies no signature or executable instruction.
5. The existence, provider identity and incremental cost of any real VM remain blocked until independently evidenced. A GitHub CI runner or Render preview does **not** establish ownership or hosting capacity.

This milestone is an isolated source-only draft stacked on Hercules Cloud development. It **does not** change the live Gatehouse service, provide a host machine, start anything, provision OCI/DigitalOcean, affect payment/DNS, or approve any public Hercules product.

Provenance: original Hercules Node standard library source with AI assistance; no proprietary third-party source copied.

SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.
