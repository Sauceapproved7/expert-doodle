# Hercules Video v0.9 — Campaign Execution Service

## Purpose

v0.9 turns the deterministic v0.8 campaign plan into an executable, fail-closed local workflow.

The service does not replace the existing local runtime, Wan2.2 runner, tournament logic, or FFmpeg assembly runner. It coordinates those existing boundaries and records runtime evidence.

## Execution path

**validated campaign plan → local runtime health → render submission → render status evidence → evaluated rounds → tournament winners → post-audio assembly → final campaign evidence**

## Runtime guarantees

The execution service:

- requires a healthy configured adapter before submitting work,
- refuses requests that the runtime reports as unsupported,
- records every render submission and status transition,
- requires local `file://` artifacts,
- requires artifact byte size and SHA-256 evidence,
- fails closed if any render fails,
- fails closed if a completed render has no artifact evidence,
- uses a bounded polling loop instead of waiting forever,
- cryptographically fingerprints every execution-session state,
- rejects tampered execution sessions,
- preserves linkage to the canonical v0.8 execution-plan fingerprint.

## Evaluation and assembly boundary

Render quality evaluation remains injected through a narrow evaluator function. The execution service does not embed a provider SDK or claim that raw runtime completion is equivalent to acceptable quality.

Final assembly remains injected through the existing assembly-runner boundary. This allows the production path to use the Hercules-owned FFmpeg wrapper without coupling FFmpeg directly into orchestration logic.

A successful finalization links:

- execution-plan fingerprint,
- runtime render evidence,
- tournament winners,
- assembly-plan fingerprint,
- assembly-evidence fingerprint,
- final output SHA-256,
- campaign-evidence fingerprint.

## Fail-closed conditions

Execution stops rather than inventing progress when any of these are unavailable or invalid:

- runtime health,
- supported render request,
- remote job identifier,
- render status,
- local render artifact,
- artifact SHA-256 or byte size,
- acceptable evaluated render,
- required post-production audio evidence,
- assembly evidence,
- final campaign evidence.

## Ownership boundary

Hercules owns the execution state machine, evidence linkage, bounded polling, transition recording, artifact verification, and final orchestration contract.

Wan2.2 and FFmpeg remain replaceable execution dependencies behind their existing local runner boundaries.

## Next increment

The next useful increment is a launch command/entrypoint that loads the canonical Hercules launch preset, configured local runtime, approved checkpoint/audio inputs, and output path; then runs this service end to end while retaining the resulting evidence package.
