# Hercules XR Foundation v1

Hercules XR Foundation is the owned spatial-state layer for SauceApproved Studio.

## Scope

- Persistent, scene-addressable spatial anchors.
- Owner-scoped read/write authorization with fail-closed scope checks.
- Portable scene bundles for later AR, VR, mixed-reality, training, Kids Studio, Commerce, and Studio clients.
- No camera permission, geolocation collection, biometric processing, payment behavior, or public deployment is introduced by this foundation.

## Hercules differentiators

1. **Portable Scene Capsule** — a provider-neutral scene bundle keeps spatial state separate from any single headset, AR SDK, or cloud vendor.
2. **Owner-Sovereign Spatial Boundary** — anchor access is isolated by owner identity and explicit XR scopes at the registry layer, so client rendering technology does not become the authorization authority.

These are Hercules differentiators, not claims that competing products lack comparable capabilities.

## Architecture

`SpatialRegistry` accepts validated anchors containing an ID, scene ID, owner ID, 3D position, quaternion rotation, and optional structured payload. Mutations require `xr:write`; reads require `xr:read`. Cross-owner reads return no object and cross-owner writes fail.

The initial registry is deliberately storage-adapter neutral. A later persistence adapter can connect Supabase/Postgres or another authorized service without changing scene semantics or trusting the client for authorization.

## Provenance

The implementation and tests are original SauceApproved/Hercules project code created with AI assistance for this repository. Runtime dependencies are Node.js platform facilities only. The TreeHacks 2020 XR challenge supplied product inspiration and historical examples; no TreeHacks source code, assets, SDK code, or third-party implementation was copied into this module. External XR platforms and device SDKs remain third-party infrastructure governed by their own terms.

## Verification

Focused test:

`node --test tests/hercules-xr-spatial-registry.test.mjs`

Repository execution contract:

`node scripts/verify-hercules-execution-contract.mjs`

Owner-code boundary:

`node scripts/verify-owner-code-only.mjs`
