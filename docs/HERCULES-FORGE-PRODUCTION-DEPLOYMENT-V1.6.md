# Hercules Forge Production Deployment v1.6

## Purpose

v1.6 closes the repository-side deployment gap between a production-capable Forge process and a verifiable self-hosted production service.

It adds:

- fail-closed persistent-storage preflight;
- a production readiness endpoint;
- public HTTPS deployment verification;
- machine-readable deployment evidence;
- a hardened systemd unit generator;
- operator CLIs for unit generation and public verification.

v1.6 does **not** claim that a permanent public Hercules Forge host is already running. A deployment is only considered verified after the public verification command succeeds against the real HTTPS origin.

## Production storage preflight

Production startup now calls `preflightForgeProduction()` before binding the service.

The preflight validates configuration and proves that `FORGE_ROOT`:

1. exists as a directory or can be created;
2. resolves to a canonical filesystem path;
3. accepts an exclusive write;
4. creates the probe with mode `0600`;
5. has at least the configured free-space floor;
6. can remove the probe after the check.

The probe file is temporary and is deleted in a `finally` path.

New configuration:

- `FORGE_MIN_FREE_BYTES`
- default: 268435456 bytes (256 MiB)
- minimum configurable value: 1048576 bytes (1 MiB)

Production startup fails closed when the storage probe or free-space requirement fails.

## Readiness

Forge now exposes:

```text
GET /ready
```

A successful readiness response requires:

- the audit hash chain to verify;
- the injected production storage probe to succeed.

The response includes only non-secret operational state:

- `ready`
- Forge version
- service mode
- public origin
- audit verification state
- storage writable state
- free-space evidence
- configured minimum free bytes

`/health` remains a lightweight process/capability endpoint. `/ready` is the stronger deployment traffic-admission signal.

## Public deployment verification

Forge exports:

- `verifyForgePublicDeployment()`

It requires an HTTPS origin and probes:

- `/health`
- `/ready`

Verification rejects:

- non-HTTPS public origins;
- redirects;
- non-JSON responses;
- non-production mode;
- Forge version mismatch;
- public-origin mismatch;
- failed audit verification;
- non-writable storage.

Successful verification returns machine-readable evidence with schema:

```text
sauceapproved.hercules.forge.public-deployment-evidence
```

The evidence contains no control token, session token, notification credential, interpreter credential, or customer data.

## Verification CLI

Run against the configured public origin:

```sh
FORGE_PUBLIC_ORIGIN=https://forge.example.com \
  node scripts/forge-production-verify.mjs
```

A successful run prints JSON deployment evidence.

This command is the repository-level proof that an external host, TLS route, Forge process, audit store, and persistent storage are working together at the advertised public origin.

## Restart-safe systemd service

Forge exports:

- `renderForgeSystemdUnit()`

Operator CLI:

```sh
FORGE_DEPLOY_WORKDIR=/opt/hercules \
FORGE_ROOT=/var/lib/hercules-forge \
  node scripts/forge-systemd-unit.mjs
```

The generated unit includes:

- `Restart=on-failure`
- `RestartSec=5`
- `TimeoutStopSec=30`
- `UMask=0077`
- `NoNewPrivileges=true`
- `PrivateTmp=true`
- `ProtectSystem=strict`
- `ProtectHome=true`
- kernel/control-group hardening
- empty capability bounding set
- explicit `ReadWritePaths` limited to `FORGE_ROOT`

The unit references an external environment file instead of embedding secrets.

Default environment-file path:

```text
/etc/hercules-forge.env
```

That file must be created by the deployment environment with restrictive permissions and is not committed to the repository.

## Required external infrastructure

Hercules product source remains repository-controlled, but a permanent self-hosted deployment still requires replaceable infrastructure:

1. supported Node.js runtime;
2. persistent filesystem for `FORGE_ROOT`;
3. systemd or another process supervisor;
4. HTTPS/TLS termination;
5. DNS/routing to the host;
6. secret injection for Forge credentials;
7. optional interpreter and notification endpoints.

The owner-code policy now explicitly records systemd as third-party infrastructure. Hercules does not represent systemd, Node.js, the operating system, TLS software, DNS, or the host as SauceApproved-owned source.

## Secret boundary

The systemd unit contains no Forge secrets.

Secrets stay in the deployment environment, including:

- `FORGE_CONTROL_TOKEN`
- optional `FORGE_INTERPRETER_TOKEN`
- optional `FORGE_NOTIFICATION_TOKEN`

The public verification CLI does not require the control token because it checks only the public health/readiness boundary.

## Launch criterion

A Forge deployment may be described as publicly verified only when all of these are true:

- exact production commit is deployed;
- persistent `FORGE_ROOT` passes preflight;
- the process is supervised/restartable;
- HTTPS public routing is active;
- `/health` reports production mode and the expected public origin;
- `/ready` verifies the audit chain and persistent storage;
- `scripts/forge-production-verify.mjs` succeeds against the real public origin.

Until then, Hercules Forge remains production-capable and staging-verified, but not publicly deployed.

## Ownership boundary

v1.6 owned source includes:

- `hercules-forge/deployment.mjs`
- production storage preflight in `hercules-forge/production.mjs`
- readiness integration in `hercules-forge/control-api.mjs`
- `scripts/forge-production-verify.mjs`
- `scripts/forge-systemd-unit.mjs`

No new package-manager dependency or hosted builder is introduced.
