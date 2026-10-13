# Hercules Cloud Owner Public-Key Sandbox Grants (V1)

This is an owner-controlled, **source-only stacked draft** extension of Hercules Cloud Host Engine. No server is provisioned, no rootless Docker machine is registered, and no production release is authorized.

## Separation of authority

- The **owner signing environment** holds an Ed25519 private key and uses `createOwnerSignedPermit(plan,{ownerPrivateKey,action,now,ttlMs})` to sign one digest-bound, exact-action grant with a random 128-bit nonce and at most five minutes' life.
- The **host operator** holds only the Ed25519 **public key**. `host-engine-cli.mjs` reads `HERCULES_HOST_ENGINE_OWNER_PUBLIC_KEY_FILE` from an owner-approved private local file. It never accepts an owner private or HMAC key.
- The operator still checks Ubuntu ARM64, same-user rootless Docker socket, non-root UID, immutable zero-network image, durable one-time nonce consumption, bounded start/inspect and independent rollback authorization. Shared-secret legacy HMAC permits are **explicitly rejected** by the Host Engine and CLI.
- The older host-agent library retains its HMAC flow for existing isolated legacy unit consumers, but it cannot authorize the new owner-facing Host Engine. Caller-supplied Ed25519 public keys are insufficient to mint new permits.

## No false machine verification

Passing crypto and filesystem tests does not demonstrate a live OCI/owned Linux server, provider-verified cost, a new connected SSH device, or a production rollout. The prior CI disposable Docker job runs on a temporary GitHub-owned runner and remains independently labeled as such.

This draft is stacked on [Hercules OCI + Host Engine development](https://github.com/Sauceapproved7/expert-doodle/pull/975) and does not change a public service, payment provider, DNS or any existing production branch.

## Source provenance

Original Node standard-library implementation using built-in Ed25519 primitives, no third-party cryptography package, payment or secret data. AI assisted. Keep owner private keys out of GitHub, GitHub Actions and Hercules host filesystem; never send raw key material in chat.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
