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

## Current boundary

v0.1 creates the owned background deployment control plane and adapter contract.

It does not yet include a production target adapter for a specific public host/provider. Therefore v0.1 can queue/process deployments with configured adapters, but it does not by itself provision a new public server.

The next increment should add the first real target adapter while preserving this contract.
