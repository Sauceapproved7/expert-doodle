# Hercules Cloud — Isolated Host Agent v0.2

**Status:** Developer implementation on a stacked draft GitHub branch. **No Linux host or provider-connected executor is deployed.** No service is being migrated; this release does not replace Railway yet.

This original Hercules-owned module in `hercules-deploy/cloud/host-agent.mjs` extends the v0.1 Cloud preflight engine from draft PR #941. It does not import Coolify/Dokploy code or branding.

## What is implemented
- An exact manifest and registered, owner-attested `owned_linux` host must pass the existing preflight policy. The target must be `sandbox`, `verified:true`, `incrementalMonthlyCostUsd:0` (numeric exact), `runtime:'rootless_docker'`, `runtimeUid` between 1000 and 65535, and have a `verifiedAt` timestamp no older than 15 minutes. This is an **operator assertion**, not external provider proof of ownership or a provider billing guarantee.
- Container images must be exact allowlisted OCI registry references pinned by SHA-256 digest. `docker --host unix:///run/user/<uid>/docker.sock` is specified explicitly; no remote Docker context is used by the generated commands.
- The synthetic container runs in a restricted sandbox: network disabled, image pulling forbidden, no ports, volumes or devices, read-only filesystem, all capabilities dropped, `no-new-privileges`, unprivileged UID/GID, strict memory/CPU/PID limits, and a fixed read-only log driver.
- An independently configured 32+ character operator signing secret seals the *entire* immutable plan digest, action, unique 128-bit nonce and short expiry (five-minute maximum). Action `start` and `rollback` are separate permits. A provided durable `consumeNonce(nonce,expiresAt)` callback must atomically refuse duplicate permits.
- Prior to any container action the agent inspects the explicitly selected local Docker daemon and requires `name=rootless` among its security options. It then consumes the permit nonce and invokes the injected command adapter to create/start/inspect. Successful operation requires explicit `true` from Docker inspect, not merely a successful process exit.
- If start or running verification fails after creation, the executor attempts a bounded removal of only the generated container. No credential, raw stdout or stderr is included in returned receipt.
- Rollback requires its own signed short-lived permit and targets only the immutable derived container name.

## Deliberate fail-closed boundary
**There is no real `runCommand` implementation, owner permit issuing API, Linux login, SSH connection, Docker socket mount, or durable nonce store in this release.** The existing public Hercules Cloud preview is static only, with no call to this module. Unit/integration tests inject a synthetic command runner and ephemeral fake replay store.

To make this an actually operating private PaaS, a further owner-authorized change must connect a verified owned Linux server with an independent Docker rootless installation, an isolated filesystem, atomic durable replay database, secrets from the owner's vault, resource billing/hosting evidence, health checks, and verified rollback. **Do not deploy the runner in any currently serving Hercules/Smallz/Studio/Shopify process.** No real container is launched by this PR.

## Verification
```sh
node --test tests/hercules-cloud-host-agent.test.mjs tests/hercules-cloud-control-plane.test.mjs tests/hercules-cloud-original-ui.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

Tested behaviors cover missing/malformed target attestation, stale host, unverified or positive cost, wrong/unsigned OCI images, improper source fingerprint, unsafe metadata, denied privileged/remote access, short-lived grants, tampered plan, permit replay, rootful daemon denial, verified create/start/inspect, bounded cleanup and separately authorized rollback.

**Safety principle:** Infrastructure cost cannot be proven $0 merely by declaring it. Owner control of the software does not establish a free host or working AI inference capability.
