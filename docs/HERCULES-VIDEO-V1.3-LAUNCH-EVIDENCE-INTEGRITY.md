# Hercules Video v1.3 — Launch Evidence Integrity

## Purpose

v1.3 hardens evidence around the canonical Hercules Video launch path after v1.2 made the render-quality gate mandatory.

It does not add a new launcher or a new quality-scoring system.

The canonical path remains:

**launch preset → Wan2.2 runner → local runtime → self-hosted adapter → enforced Hercules render-quality gate → campaign execution service → FFmpeg assembly → launch evidence bundle**

## Added guarantees

### Approved audio is verified before rendering

Each configured audio track must:

- use a local `file://` URI,
- provide a valid SHA-256 value,
- exist locally,
- hash exactly to the declared SHA-256.

Audio verification happens before hardware probing and render execution.

### Final artifact paths are exclusive

The final video path and launch-evidence path must not already exist.

The evidence writer uses exclusive-create mode.

A new run therefore cannot silently overwrite a prior final video or evidence receipt.

### Accepted quality results are bound to the exact render

The v1.2 render-quality gate remains responsible for technical and semantic acceptance.

v1.3 wraps that already-verified evaluator and records, for every storyboard shot:

- shot ID,
- exact completed render artifact SHA-256,
- the accepted Hercules quality-gate result,
- a deterministic evaluation-record fingerprint.

A successful launch requires evaluation evidence for every storyboard shot.

### Final output is independently re-hashed

After assembly, Hercules re-hashes the actual final video file on disk.

That hash must match the final-output SHA-256 carried by campaign evidence.

If the file is missing or the hashes differ, the launch fails before the evidence bundle is written.

The independently verified hash is stored as `finalOutputSha256`.

## Boundaries unchanged

v1.3 does not:

- create a second launch entrypoint,
- bypass or replace the v1.2 render-quality gate,
- add a commercial render fallback,
- download model weights,
- install CUDA, FFmpeg, or ffprobe,
- add provider SDKs to Hercules-owned orchestration,
- invent semantic scores,
- change the existing campaign execution state machine.

## Canonical source

The canonical launcher remains:

`hercules-video/launch-bootstrap.mjs`

The enforced quality gate remains:

`hercules-video/render-quality-gate.mjs`

## Next useful increment

The next useful increment is persistent launch-run state and safe restart/resume support. Any resume path should preserve the v1.2 quality-gate result, v1.3 artifact binding, and final-output verification rather than trusting stale intermediate files.
