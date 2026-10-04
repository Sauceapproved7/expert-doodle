# Hercules Deploy Plane v0.1

## Purpose

Hercules Deploy Plane is the SauceApproved-owned background deployment runtime.

It exists separately from Hercules Forge:

- Forge owns app specs, generated source, revisions, verified artifacts, and release state.
- Deploy Plane owns deployment jobs, target handoff, deployment verification state, retry state, and rollback execution.
- External hosts/providers remain behind target adapters.

This is the runtime that can stay active in the background while a deployment is being processed.

## Owned runtime

The canonical runtime root is:

```text
hercules-deploy/
```

It is registered in `governance/owner-code-policy.json` as:

```text
deployment-runtime
```

The runtime imports only owned local modules and Node.js built-ins.

## Deployment request

Every deployment request is normalized to version `0.1`.

Required fields:

- `serviceId`
- `releaseId`
- `sourceCommit` — exact 40-character git SHA
- `artifactFingerprint` — exact SHA-256 hex digest
- `publicOrigin` — credential-free HTTPS origin
- `target.kind`
- `target.reference`

Optional metadata must be JSON-compatible and secret-free.

Secret-shaped metadata keys are rejected, including password, token, secret, authorization, cookie, CSRF, private-key, and API-key forms.

Deployment target references may identify a provider resource or host target, but may not embed URL credentials.

## Persistent job store

`HerculesDeployStore` persists:

```text
<deploy-root>/deployments/<deploymentId>/request.json
<deploy-root>/deployments/<deploymentId>/state.json
```

Request/state files are created with mode `0600`.

The request is immutable after creation.

State changes use atomic temp-file + rename writes.

Supported lifecycle:

```text
queued
  -> running
  -> verifying
  -> verified
  -> rolling_back
  -> rolled_back
```

Failure transitions:

```text
running -> failed
verifying -> failed
rolling_back -> failed
failed -> queued
```

The store records bounded state history, attempt count, safe error codes, and secret-free deploy/verification/rollback evidence.

## Background worker

`HerculesDeployWorker` processes queued jobs continuously.

For each job it:

1. resolves the adapter by `target.kind`;
2. marks the job running;
3. calls the target adapter deploy operation;
4. persists deploy evidence;
5. marks the job verifying;
6. calls adapter verification;
7. persists verification evidence;
8. marks the job verified.

Rollback:

1. requires a verified deployment;
2. marks it rolling back;
3. invokes the same target adapter rollback operation;
4. persists rollback evidence;
5. marks it rolled back.

Raw adapter error messages are not persisted as deployment evidence. The worker stores bounded error codes.

## Target adapter contract

Deploy Plane exports:

- `HerculesDeployTargetAdapter`
- `MemoryHerculesDeployTargetAdapter` for tests/fixtures

A real target adapter must implement:

- `deploy(deployment)`
- `verify(deployment)`
- `rollback(deployment)`

Provider or host credentials belong inside the configured adapter boundary and must not be copied into deployment requests/state.

## Control service

Background service entrypoint:

```sh
node hercules-deploy/service-cli.mjs
```

Required production configuration:

- `HERCULES_DEPLOY_ROOT`
- `HERCULES_DEPLOY_CONTROL_TOKEN` — minimum 32 characters

Optional:

- `HERCULES_DEPLOY_HOST` — default `127.0.0.1`
- `HERCULES_DEPLOY_PORT` — default `38800`
- `HERCULES_DEPLOY_POLL_MS` — default `1000`

The safe startup summary never prints the control token.

## HTTP API

Public operational endpoints:

- `GET /health`
- `GET /ready`

`GET /ready` fails closed with HTTP 503 unless both conditions are true:

- the background worker is running;
- a production `https_container` target adapter is configured.

Its response is intentionally secret-free and reports only readiness booleans plus configured adapter kinds.

Control-token endpoints:

- `POST /v1/deployments`
- `GET /v1/deployments`
- `GET /v1/deployments/:deploymentId`
- `POST /v1/deployments/:deploymentId/retry`
- `POST /v1/deployments/:deploymentId/rollback`
- `POST /v1/worker/run-once`

The control API uses constant-time bearer-token comparison and a 256 KiB request-body limit.

## Forge bridge

`deploymentRequestFromActiveForgeRelease()` reads the real Forge active release:

```text
<forge-root>/releases/<projectId>/active.json
```

It refuses an unverified release.

The bridge takes the active release's:

- project ID
- revision ID
- artifact fingerprint
- release target metadata

and combines them with:

- exact Hercules source commit
- app public origin
- deployment target

to create a normalized Deploy Plane request.

## Internal client

`HttpHerculesDeployClient` connects Forge/operator tooling to the Deploy Plane.

Remote endpoints must use HTTPS. Plain HTTP is permitted only for loopback.

The client:

- rejects URL credentials/query/fragment;
- disables redirects;
- uses a bounded timeout;
- bounds response size;
- carries the control credential only in the Authorization header.

## Forge handoff CLI

A verified active Forge release can be handed to Deploy Plane with:

```sh
node scripts/hercules-deploy-forge-release.mjs
```

Required environment:

- `FORGE_ROOT`
- `FORGE_PROJECT_ID`
- `FORGE_SOURCE_COMMIT`
- `FORGE_APP_PUBLIC_ORIGIN`
- `HERCULES_DEPLOY_TARGET_KIND`
- `HERCULES_DEPLOY_TARGET_REFERENCE`
- `HERCULES_DEPLOY_URL`
- `HERCULES_DEPLOY_CONTROL_TOKEN`

Optional:

- `HERCULES_DEPLOYMENT_ID`

The command prints deployment identity/status but never the Deploy Plane control token.

## Render production target

The Deploy Plane now includes a bounded Render provider adapter behind the generic `https_container` target contract.

Runtime configuration is fail-closed:

- `HERCULES_RENDER_API_TOKEN` and `HERCULES_RENDER_SERVICE_IDS` must be provided together;
- configured Render service IDs are allowlisted before any provider call;
- exact 40-character source commits are required;
- credentials are carried only in the provider Authorization header and are not persisted in deployment jobs or evidence;
- deployment verification requires the public `/health` contract and requires unauthenticated `/mcp` access to remain protected;
- rollback requires a previously recorded provider deployment identifier.

Render remains third-party infrastructure and is not claimed as SauceApproved-owned technology.

## Vault-backed cloud execution broker

When no authorized desktop/runtime machine is attached, Hercules can use the server-side Vault-backed broker as an alternative execution surface without moving provider credentials into deployment jobs.

- provider credentials remain in Supabase Vault and are retrieved only server-side;
- deployment requests carry only target code, exact commit SHA, and bounded provider deployment identity;
- production targets resolve through the service-role-only `hercules_deploy_targets` allowlist;
- Render deploys require exact 40-character commit SHAs;
- verification requires Render to report that same exact commit as `live`, then requires the Hercules `/health` contract and protected unauthenticated `/mcp` behavior (401/403);
- rollback accepts only a bounded Render deployment ID for an allowlisted service;
- broker responses are credential-free.

The broker does not create or infer provider credentials. If the `render-deployer` Vault secret or `deploy-broker-control` internal service key is unavailable, it fails closed.

Two Hercules differentiators in this increment are: provider credentials never transit deployment job state, and deployment completion is bound to exact-commit plus application-health and MCP-auth evidence rather than provider status alone.

## Current boundary

v0.1 now includes the first production provider path and can drive an allowlisted Render service through the owned Deploy Plane when the runtime has the required owner-authorized provider credential.

Repository readiness does not prove runtime connectivity. A production cutover is complete only after the Deploy Plane is running on an authorized runtime, its secret-free `/ready` endpoint reports production readiness, an exact deployment is processed through the Deploy Plane, and the resulting runtime verification evidence passes.
