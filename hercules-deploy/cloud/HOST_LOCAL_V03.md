# Hercules Cloud v0.3 — local proof vault and command boundary

**Status:** Source-only, stacked draft PR #948 on Stage-2 draft PR #945. Not merged into production main, not published through the static preview, and not connected to any Linux host.

## New original Hercules code

`host-local.mjs` contains two deliberately separate and fail-closed capabilities:

1. **Durable owner-grant replay vault:** `createDurableNonceStore({root})` opens a private (0700, same owner, non-symlink) absolute filesystem directory. It consumes signed permit nonces by an atomic *exclusive* 0600 marker, syncs the marker and containing directory before returning success, and refuses malformed nonces, missing owner rights or ambiguous filesystem states. Markers use a SHA-256 nonce digest and only contain basic expiry metadata; they never contain a signing key or raw permit. Markers are deliberately never automatically deleted: a crash, disk error or restart cannot make a consumed grant usable again. Disk capacity must be observed by an authorized operator.
2. **Strict rootless local-command adapter:** `createBoundedDockerRunner(plan,{execFileImpl})` verifies the existing Stage-2 canonical plan and only accepts exactly its precomputed `docker --host unix:///run/user/<uid>/docker.sock` create, start, inspect or rollback arguments, plus fixed rootless daemon introspection. It uses a fixed `/usr/bin/docker` executable, no shell, restricted environment, 10-second timeout and 64-KiB output bound. Subprocess errors produce redacted failure receipts.

**Mandatory security boundary:** There is **no** Node `child_process` import, automatic process runner, SSH, API server, Docker socket binding or production integration in v0.3. `execFileImpl` must be explicitly injected by a separately reviewed, authorized trusted-host operator. Without injection the runner refuses creation. This respects the canonical owner-code policy that prohibits undeclared subprocess boundaries. The source-level permit signer remains separate from the public Cloud preview.

## TDD and verification
```sh
node --test tests/hercules-cloud-host-local.test.mjs tests/hercules-cloud-host-agent.test.mjs tests/hercules-cloud-control-plane.test.mjs tests/hercules-cloud-original-ui.test.mjs
node scripts/verify-owner-code-only.mjs
```

Tests cover restart persistence, 24 concurrent grant attempts, file permissions, symlink rejection, unsafe nonce/expiry, exact command/Unix socket allowlist, rootful daemon refusal in Stage 2, fail-closed error output, and refusal to run without an explicitly injected subprocess adapter. GitHub Actions workflow `Hercules Cloud Local Grant Vault` runs the suite alongside repository security gates.

## Required before any real release

- Independently verify owned Linux host, rootless UID and socket, CPU/memory/disk availability, and actual **no-additional-charge** hosting situation; declaring `incrementalMonthlyCostUsd:0` in a registry is not an external billing attestation.
- Have the owner approve a narrowly scoped subprocess boundary with explicitly restricted local host/operator identity and durable isolated filesystem. Do **not** weaken the existing owner-code policy to force a passing check.
- Install and prove a true disposable pinned OCI image with no network, port, mount or privileged access; observe resource limits; verify restart/rollback and all host logs without exposing secrets.
- Bind this to the existing Hercules Deploy Plane *only after* that live sandbox proof, not to public account registration, production Render MCP/Smallz/Studio, Shopify checkout, DNS, payouts or existing Railway services.

Hercules' static [Origin preview](https://hercules-cloud-origin-preview.onrender.com) remains non-executing. Neither a source merge nor simulated Docker callbacks constitute live PaaS deployment.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
