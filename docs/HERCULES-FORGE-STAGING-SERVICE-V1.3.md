# Hercules Forge Staging Service v1.3

## Purpose

v1.3 proves the v1.2 Forge production service inside the existing Hercules self-hosted staging plane.

This milestone does not claim public production hosting. It verifies that the production entrypoint can run as a durable service behind an external infrastructure boundary, persist canonical Forge state across process/container restart, and preserve the repository owner-code policy.

## Staging service

The existing `staging-plane/compose.yml` now includes a `forge` service using the policy-approved `node:22.12.0-alpine` infrastructure image.

Forge runs:

```text
node /repo/hercules-forge/production-cli.mjs
```

The source mount is read-only:

```text
../hercules-forge:/repo/hercules-forge:ro
```

Canonical Forge service state is stored on a separate persistent named volume:

```text
hercules_forge_state:/forge-state
```

## Network boundary

The service binds only to host loopback:

```text
127.0.0.1:38700:38700
```

The staging public-origin metadata is intentionally non-routable:

```text
https://forge.staging.invalid
```

This satisfies the production runner's HTTPS-origin requirement without representing the isolated local staging endpoint as a real public deployment.

## Secrets

`scripts/staging-plane.mjs` now provisions:

```text
HERCULES_FORGE_STAGING_CONTROL_TOKEN
```

The token is random, local to the staging environment, stored only in the ignored staging `.env`, and injected into the container at runtime.

Secret provisioning is upgrade-safe. An older existing staging `.env` keeps all existing database/JWT values and receives only missing required variables.

## Restart and persistence drill

`scripts/forge-staging-drill.mjs` performs an explicit isolated-staging proof:

1. require `--confirm-isolated-staging`;
2. verify Forge health reports v1.2 production mode;
3. create a synthetic Forge project through the owner control API;
4. create a verified runtime-data snapshot;
5. restart only the Forge container;
6. wait for the Forge health endpoint to recover;
7. verify the project is still present;
8. verify the snapshot is still present;
9. write machine-readable evidence to:
   `benchmarks/performance/forge-staging-drill.json`.

The evidence records service version, mode, public origin, persistent project identity, persistent snapshot identity, and runtime-data capability. It never records the control token.

## CI gate

`.github/workflows/hercules-forge-staging.yml` runs on Forge/staging changes and:

- enforces the repository-wide owner-code-only policy;
- validates the staging boundary;
- starts isolated staging;
- executes the restart/persistence drill;
- uploads the drill evidence;
- captures Forge logs on failure;
- removes the isolated staging environment.

The existing global staging and SLO workflows also include Forge logs in failure diagnostics.

## Ownership boundary

The Forge product source remains under `hercules-forge/` and is mounted read-only.

Docker, Docker Compose, the Node.js image, networking, and the staging host remain declared external infrastructure. The new Docker invocation in `scripts/forge-staging-drill.mjs` is explicitly registered in `governance/owner-code-policy.json`.

No Dockerfile, package dependency, hosted builder, or third-party application runtime is added to the Hercules-owned source boundary.

## What this proves

A green v1.3 staging gate proves:

- the production Forge process starts under the declared external runtime;
- production-mode configuration is accepted;
- health is observable;
- canonical project state survives container restart;
- verified snapshot state survives container restart;
- source is mounted read-only;
- state is kept outside the source tree;
- owner-code/provenance controls remain intact.

It still does not prove Internet-edge TLS termination, public DNS, public account recovery/email verification, multi-node database failover, or hardened arbitrary-code isolation. Those remain separate launch milestones.
