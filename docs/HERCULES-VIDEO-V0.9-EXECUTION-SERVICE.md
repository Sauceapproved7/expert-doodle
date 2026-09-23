# Hercules Video v0.9 — Execution Service

## Purpose

v0.9 turns the deterministic v0.8 campaign plan into an executable, fail-closed local workflow while preserving the existing Hercules ownership boundaries.

Pipeline:

**validated campaign plan → adapter health → render submission → bounded polling → artifact inspection → Hercules quality evaluation → tournament winners → post-audio assembly → final campaign evidence**

## Runtime guarantees

The execution service:

- requires a healthy configured self-hosted adapter before work is submitted,
- resolves each tournament entrant through its matching adapter,
- uses the exact Hercules render request already fingerprinted by v0.8,
- bounds render polling by both interval and maximum poll count,
- rejects failed, unknown, or indefinitely non-terminal render jobs,
- requires a completed render artifact before quality evaluation,
- requires an injected Hercules quality evaluator rather than treating raw completion as quality,
- resolves winners through the existing Hercules tournament logic,
- requires post-production audio evidence where the storyboard uses post audio,
- requires assembly evidence linked to the exact assembly-plan fingerprint,
- produces the existing final Hercules campaign-evidence package.

## Hash-chained execution journal

Every meaningful transition is recorded:

1. execution started,
2. adapter healthy,
3. render submitting,
4. render submitted,
5. render polled,
6. render evaluated,
7. tournament resolved,
8. assembly planned,
9. assembly completed,
10. execution completed.

Each entry includes the previous entry fingerprint. The journal stores a head fingerprint and a final journal fingerprint. Verification recomputes every entry and rejects changed events, payloads, order, links, head state, or final fingerprint.

## Fail-closed conditions

Execution stops rather than inventing progress when any of these are unavailable or invalid:

- adapter registration,
- adapter health,
- remote job identifier,
- recognized render status,
- terminal render completion,
- render artifact,
- quality evidence,
- acceptable tournament winner,
- required post-production audio evidence,
- assembly evidence,
- final campaign evidence.

## Separation

The service uses dependency injection.

- Wan2.2 remains behind the Hercules self-hosted render adapter.
- FFmpeg remains behind the Hercules assembly executor.
- The execution service contains no vendor SDK or provider-specific request format.
- Commercial fallback remains disabled by the v0.8 execution plan.

## Next increment

Build the host bootstrap/launch entrypoint that binds together:

- CUDA hardware probe,
- pinned Wan2.2 checkout identity,
- required checkpoint SHA-256,
- local output directories,
- Hercules local runtime,
- self-hosted adapter registration,
- approved soundtrack/SFX/narration inputs,
- FFmpeg assembly executor,
- v0.9 execution service,
- final evidence export.

Actual launch-video rendering still requires a compatible local CUDA host, a separately installed pinned Wan2.2 checkout/checkpoint, FFmpeg, and approved local audio inputs.
