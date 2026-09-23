# Hercules Video v1.1 — Launch Trust Hardening

## Purpose

v1.1 hardens the canonical v1.0 local launch bootstrap without creating a second launcher or changing the existing Hercules runtime architecture.

The canonical path remains:

**launch preset → Wan2.2 runner → local runtime → self-hosted adapter → campaign execution service → evaluated renders → FFmpeg assembly → launch evidence bundle**

This increment strengthens the evidence and overwrite boundaries around that path.

## Added guarantees

### Local audio integrity

Every configured audio track must:

- use a local `file://` URI,
- declare one of the supported audio kinds,
- provide a valid SHA-256 value,
- exist as a local file,
- hash exactly to the declared SHA-256 before rendering begins.

The launch fails before GPU work if an audio input is missing or mismatched.

### Exclusive final artifacts

The final video path and launch-evidence path must not already exist.

This prevents a launch from silently overwriting a previous final artifact or evidence record.

The evidence writer also uses exclusive-create mode.

### Render-bound evaluation evidence

The quality evaluator must return:

- `artifactSha256`,
- `method`,
- `evaluatorId`,
- all seven Hercules quality dimensions.

The returned artifact hash must match the exact completed render being evaluated.

Each normalized evaluation record receives its own deterministic fingerprint and is included in the final launch bundle.

This prevents scores from being reused against unrelated renders and prevents incomplete quality evidence from passing as a full evaluation.

### Complete evaluation coverage

A successful launch requires exactly one recorded evaluation for every storyboard shot.

Missing shot evaluation evidence causes the launch to fail closed.

### Final output re-verification

After assembly, Hercules re-hashes the actual final video file from disk.

That SHA-256 must match the checksum claimed by the campaign evidence.

The verified final file hash is stored separately in the launch evidence bundle.

This catches stale output paths, incorrect assembly evidence, or unexpected file replacement before the final receipt is written.

## What v1.1 does not change

v1.1 does not:

- add another launcher,
- add a commercial rendering fallback,
- download model weights,
- install CUDA or FFmpeg,
- add provider SDKs to Hercules-owned orchestration,
- invent evaluator scores,
- weaken the v1.0 hardware checks,
- alter Wan2.2 or FFmpeg execution boundaries.

## Canonical source

The canonical launcher remains:

`hercules-video/launch-bootstrap.mjs`

The earlier experimental v0.10 launcher branch is intentionally not canonical because v1.0 already established the launch bootstrap before that work could merge.

## Next useful increment

After v1.1 is canonical, the next useful increment is persistent launch-run state and restart/resume support. That work should preserve the same artifact hashes, evaluation bindings, and final-output verification rather than creating a parallel execution path.
