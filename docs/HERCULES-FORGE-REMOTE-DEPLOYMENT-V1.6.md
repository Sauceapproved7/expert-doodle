# Hercules Forge Remote Deployment v1.6

## Purpose

v1.6 adds a provider-neutral remote deployment bridge to Hercules Forge.

The bridge lets Forge publish an already verified artifact to a replaceable deployment service while keeping canonical project, revision, artifact, release, and rollback state inside Hercules.

No hosted deployment SDK or third-party runtime package is imported into the Forge owned core.

## Production configuration

Optional production settings:

- `FORGE_DEPLOYMENT_URL`: remote deployment endpoint
- `FORGE_DEPLOYMENT_TOKEN`: optional bearer credential injected at runtime
- `FORGE_DEPLOYMENT_MAX_BUNDLE_BYTES`: maximum verified raw artifact bytes transferred per publish; default 8 MiB

Remote deployment endpoints must use HTTPS.

Plain HTTP is accepted only for loopback endpoints.

Deployment endpoint URLs may not embed username/password credentials.

The safe production summary exposes only:

- whether remote deployment is configured
- the configured deployment bundle byte limit

It never exposes the deployment bearer credential.

## Verified deployment bundle

Forge creates a deployment bundle only after `verifyForgeArtifact()` succeeds.

Protocol:

```text
hercules-forge-deployment-bundle/0.1
```

The bundle contains:

- the verified artifact manifest
- the exact artifact files
- each file path
- SHA-256
- raw byte count
- base64-encoded content
- total raw bundle byte count

The bundle builder enforces:

- verified artifact integrity
- file-count limit
- total raw byte limit

An invalid or tampered artifact is rejected before the deployment transport is called.

## Remote transport

The owned transport protocol is:

```text
hercules-forge-deployment/0.1
```

### Publish

Forge sends:

```json
{
  "protocol": "hercules-forge-deployment/0.1",
  "action": "publish",
  "artifact": "<verified deployment bundle>"
}
```

The remote service returns a bounded response containing:

- `deploymentId`
- optional HTTPS deployment `url`

### Activate / rollback

For a rollback, Forge sends:

```json
{
  "protocol": "hercules-forge-deployment/0.1",
  "action": "activate",
  "projectId": "<project>",
  "revisionId": "<verified revision>",
  "artifactFingerprint": "<sha256>",
  "deploymentId": "<previous remote deployment>"
}
```

The remote service activates the previously published deployment and returns deployment identity.

## HTTP hardening

`HttpForgeDeploymentTransport`:

- disables redirects;
- uses `cache: no-store`;
- applies a bounded request timeout;
- bounds response size;
- rejects non-JSON responses;
- validates deployment IDs;
- validates returned deployment URLs;
- sends a bearer credential only in the Authorization header;
- never places the deployment credential in the artifact body.

## Canonical release ownership

`ForgeRemoteReleaseAdapter` wraps the local release ledger.

Publish order:

1. verify and package the Forge artifact;
2. publish through the remote transport;
3. record the verified release locally with remote deployment metadata.

A successful local release record contains:

- project/revision identity
- revision fingerprint
- artifact fingerprint
- `target: "remote-verified-deployment"`
- remote deployment ID
- optional deployment URL
- verified state

The hosting provider is transport/execution infrastructure only. It does not become the canonical source of the Forge project, revision, artifact, or release.

## Rollback

Rollback requires a previously recorded remote deployment ID.

Forge:

1. reads the verified historical release from the local ledger;
2. requests remote activation using the recorded deployment ID and artifact fingerprint;
3. updates the local active-release record only after remote activation succeeds.

The existing customer and owner API paths do not change:

- publish remains `POST .../publish`
- rollback remains `POST .../rollback`

The deployment adapter is an internal production boundary.

## Health

Forge v1.6 health reports:

- `remoteDeployment: true` when a release adapter is injected
- `remoteDeployment: false` for the default local release adapter

This does not by itself prove a public deployment is reachable.

## What v1.6 proves

A green v1.6 gate proves:

- only verified artifact bundles enter remote deployment;
- bundle transfer is bounded;
- the remote transport is HTTPS-bound outside loopback;
- redirects are disabled;
- deployment responses are bounded and validated;
- deployment credentials are not embedded in payloads or safe summaries;
- remote deployment metadata is recorded in the Hercules-local release ledger;
- rollback activates a previously recorded remote deployment before changing local active state;
- the existing publish/rollback API surface works through the injected remote adapter;
- local-only deployment remains the default fallback.

## Current launch boundary

v1.6 creates the production deployment bridge but does not claim that Hercules Forge is publicly live.

A public-production proof still requires an authorized deployment service to actually:

1. accept the v1.6 protocol;
2. run the verified artifact behind HTTPS;
3. expose the configured public origin;
4. keep `FORGE_ROOT` on durable storage;
5. inject runtime credentials;
6. pass an external health/restart/persistence verification.

That infrastructure can be the owner's own deployment service or a replaceable provider adapter.

## Ownership boundary

Repository-controlled Hercules source:

- `hercules-forge/deployment.mjs`
- release-ledger integration in `hercules-forge/releases.mjs`
- production adapter wiring in `hercules-forge/production.mjs`
- control-plane adapter injection in `hercules-forge/control-api.mjs`

External infrastructure remains external:

- Node.js runtime
- TLS termination
- DNS
- hosting platform
- process supervisor
- deployment endpoint implementation

No external deployment SDK becomes part of the Hercules owned runtime.
