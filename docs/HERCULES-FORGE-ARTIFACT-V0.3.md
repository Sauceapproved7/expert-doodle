# Hercules Forge Artifact Integrity v0.3

## Scope

v0.3 closes the gap between a Forge revision and a publishable release.

Forge now builds a deployable artifact directly from a recorded revision, verifies every generated source file against the revision hashes, and computes an artifact fingerprint before a release adapter may publish it.

## Integrity chain

    Forge spec
      -> deterministic compiler fingerprint
      -> immutable workspace revision
      -> per-file SHA-256 hashes
      -> verified artifact bundle
      -> artifact fingerprint
      -> release record

A release is rejected if the artifact project, revision, revision fingerprint, file hashes, or artifact fingerprint do not match.

## Artifact layout

    artifacts/<project-id>/<revision-id>/artifact.json
    artifacts/<project-id>/<revision-id>/bundle/...

The bundle contains the exact generated source recorded by the workspace revision.

## Release policy

ForgeLocalReleaseAdapter now requires a verified artifact directory. The release record stores both the revision fingerprint and artifact fingerprint.

Rollback can activate only a release that was previously recorded as verified.

## Ownership boundary

The artifact builder, manifest format, verification logic, and release admission rule are Hercules Forge source code in the canonical repository.

A future hosting adapter may upload the verified bundle to another runtime, but it must not replace the Forge manifest or bypass the integrity chain.
