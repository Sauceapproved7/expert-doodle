# Hercules Video v1.4 — Persistent Launch Resume

## Purpose

v1.4 adds persistent launch-run state and safe restart/resume support to the canonical Hercules Video launcher.

It preserves all existing boundaries:

**launch preset → Wan2.2 local runner → Hercules runtime → enforced quality gate → campaign execution service → FFmpeg assembly → launch evidence**

No second launcher, remote fallback, or parallel quality system is introduced.

## Persistent state

The launcher stores a machine-readable state file identified by `statePath`.

If `statePath` is omitted, the launcher derives it from the evidence path:

```text
<evidenceOutputPath>.state.json
```

Every state record is deterministically fingerprinted and binds to:

- execution-plan fingerprint,
- pinned Wan2.2 upstream commit,
- checkpoint SHA-256,
- runtime ID,
- render-output directory,
- final-output path,
- evidence-output path,
- execution-service session,
- accepted evaluation bindings,
- launch stage.

The supported launch stages are:

- `rendering`
- `finalizing`
- `completed`
- `failed`

## Atomic persistence

State is written using a temporary file in the same directory followed by rename.

This avoids exposing a partially serialized state file as the current launch state.

State is persisted:

1. immediately after render submission or resume,
2. after every render-status refresh,
3. before finalization,
4. after each newly accepted quality evaluation,
5. after final evidence is successfully written.

## Resume policy

A launch resumes only when `resume: true` is set in the launch configuration.

A fresh launch refuses to start if a state file already exists.

A resume validates the state fingerprint and exact launch identity before reuse.

### Completed render reuse

Before a completed render is reused, Hercules verifies:

- the artifact URI is local,
- the file still exists,
- the stored SHA-256 is valid,
- the actual file SHA-256 still matches.

Completed verified jobs are not submitted again.

### Incomplete job recovery

Queued, running, or failed jobs are treated as abandoned after process restart because the in-memory local runtime cannot guarantee their old job identity.

Those jobs receive fresh submissions through the existing self-hosted adapter.

This prevents stale in-memory job IDs from being trusted after restart.

## Evaluation reuse

Stored quality results may be reused only when:

- the launch-state fingerprint is valid,
- the evaluation record fingerprint is valid,
- the associated shot has a verified completed artifact,
- the evaluation artifact SHA-256 exactly matches that completed artifact.

If a shot has no stored evaluation, the enforced Hercules render-quality gate runs normally.

A stored evaluation is never applied to a different artifact.

## Finalization safety

A launch state marked `completed` is closed.

Resume refuses to finalize it again.

For an incomplete resume, pre-existing final-output or evidence-output files are treated as a conflict and block finalization.

This prevents ambiguous double-finalization and accidental overwrite.

## Execution-service resume boundary

`HerculesCampaignExecutionService.resume()` verifies:

- session fingerprint,
- execution-plan fingerprint,
- job count,
- shot identity,
- per-shot request fingerprint.

Completed jobs with artifact evidence are preserved.

All other jobs are reset and resubmitted.

## Fail-closed conditions

Resume stops on:

- launch-state fingerprint mismatch,
- plan/model/checkpoint/runtime/path identity drift,
- completed artifact missing from disk,
- completed artifact checksum mismatch,
- duplicated or malformed evaluation records,
- evaluation-to-artifact mismatch,
- changed per-shot render request,
- conflicting final/evidence output files,
- already-completed state,
- failed fresh resubmission,
- failed render refresh,
- final-output evidence mismatch.

## Canonical source

The canonical files remain:

- `hercules-video/launch-bootstrap.mjs`
- `hercules-video/campaign-execution-service.mjs`
- `hercules-video/render-quality-gate.mjs`

v1.4 adds:

- `hercules-video/launch-state.mjs`

## Next useful increment

After v1.4, the next useful step is a small operator-facing run-status command that reads and verifies the persistent state without mutating it, reporting which shots are reusable, which require resubmission, and whether the run is closed.
