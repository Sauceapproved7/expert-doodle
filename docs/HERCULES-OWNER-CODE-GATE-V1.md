# Hercules Repository-Wide Owner-Code Gate v1

## Status

The Hercules owner-code-only rule applies to the complete canonical runtime surface.

Canonical policy:

`governance/owner-code-policy.json`

Verifier:

`scripts/verify-owner-code-only.mjs`

Dedicated CI:

`.github/workflows/hercules-owner-code.yml`

## Runtime roots covered

- `hercules-forge/`
- `hercules-models/`
- `hercules-training/`
- `hercules-video/`
- `observability/`
- `scripts/`
- `staging-plane/`

## What the gate rejects

The gate fails when the canonical runtime contains:

- bare third-party package/module imports
- vendored dependency directories
- runtime dependency manifests inside the owned roots
- committed binary libraries, archives, model checkpoints, or model-weight formats
- undeclared child-process execution boundaries
- undeclared shell command boundaries
- undeclared container images
- undeclared external GitHub Actions
- external GitHub Actions referenced by movable tags instead of approved immutable commit SHAs
- runtime imports that escape the declared Hercules-owned runtime roots
- git submodules

## External infrastructure boundary

External infrastructure is allowed only as an explicitly declared dependency outside the Hercules-owned-code claim. External GitHub Actions are additionally pinned to approved immutable commit SHAs so CI behavior cannot change through a moving version tag.

Current declarations include Node.js, GitHub Actions, Docker, PostgreSQL/PostgREST, FFmpeg/ffprobe, NVIDIA/CUDA tooling, Python, POSIX shell/PostgreSQL client tooling, and the Wan2.2 external video model runtime/weights.

Those dependencies are not packaged or represented as Hercules-owned source code.

## Fail-closed integration

The repository-wide verifier runs:

- on every pull request
- on every push to `main`
- inside Forge CI
- inside Model Plane CI
- inside Training CI
- inside Video CI
- inside staging benchmark/recovery CI
- inside SLO evidence CI
- inside the provenance attestation gate

A policy violation therefore blocks the corresponding Hercules validation/build path.

## Legal and licensing boundary

This engineering control establishes a source/build boundary. It does not alter prior license grants and does not convert third-party infrastructure into SauceApproved-owned intellectual property.

The repository remains subject to its recorded Apache-2.0 licensing history unless a separate lawful licensing change is made.
