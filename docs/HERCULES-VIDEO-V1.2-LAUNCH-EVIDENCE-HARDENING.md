# Hercules Video v1.2 — Launch Evidence Hardening

## Purpose

v1.2 strengthens the canonical v1.0 launch bootstrap after the v1.1 render-quality gate was added.

It does not introduce another launcher or another quality-scoring system.

The canonical path remains:

**launch preset → Wan2.2 runner → local runtime → self-hosted adapter → v1.1 render-quality gate → campaign execution service → FFmpeg assembly → launch evidence bundle**

## Added guarantees

### Local audio integrity

Every configured audio track must use a local `file://` URI and declare a SHA-256 value.

Before GPU work begins, the bootstrap:

1. resolves the local file,
2. requires the file to exist,
3. computes its actual SHA-256,
4. requires the computed hash to match the declared value.

A missing or mismatched audio asset stops the launch before rendering.

### Output overwrite protection

The final video path and evidence-export path must not already exist.

The evidence writer uses exclusive-create mode.

This prevents a new run from silently replacing a prior final artifact or launch receipt.

### Evaluation-to-artifact binding

v1.1 remains responsible for deciding whether a render passes technical and semantic quality requirements.

v1.2 records the accepted evaluator result together with the exact render artifact SHA-256 supplied to that evaluator.

Each record contains:

- storyboard shot ID,
- completed render artifact SHA-256,
- the accepted evaluator result,
- a deterministic record fingerprint.

A successful launch requires one evaluation record for every storyboard shot.

This preserves evidence of **which exact render was evaluated** without duplicating v1.1 score normalization or technical probing.

### Final video re-verification

After assembly, the bootstrap hashes the actual final video file from disk.

That SHA-256 must equal the checksum in the final campaign evidence.

If the file is missing or the hashes differ, Hercules does not write the launch evidence bundle.

The independently verified hash is stored as `finalOutputSha256` in the bundle.

## Boundaries unchanged

v1.2 does not:

- create another launch entrypoint,
- replace the v1.1 render-quality gate,
- add a commercial rendering fallback,
- download Wan2.2 or model weights,
- install CUDA, FFmpeg, or ffprobe,
- add provider SDKs to Hercules-owned orchestration,
- invent semantic scores,
- change the existing campaign execution state machine.

## Canonical source

The canonical local launcher remains:

`hercules-video/launch-bootstrap.mjs`

The canonical render acceptance layer remains:

`hercules-video/render-quality-gate.mjs`

## Next useful increment

The next useful increment is persistent launch-run state and safe restart/resume support. Any resume path should preserve the v1.1 quality-gate evidence and the v1.2 artifact/hash bindings instead of reusing unverified intermediate files.
