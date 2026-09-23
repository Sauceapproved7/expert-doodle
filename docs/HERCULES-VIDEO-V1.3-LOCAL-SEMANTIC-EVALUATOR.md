# Hercules Video v1.3 — Local Semantic Evaluator

## Decision

First self-hosted semantic evaluator backend: **Qwen3-VL-4B-Instruct**.

The choice is based on native video understanding/grounding, local Transformers execution, a smaller 4B footprint than the larger Qwen3-VL variants, and Apache 2.0 licensing for the upstream project and model repository.

Qwen is an evaluator backend, not the Hercules quality policy.

## Architecture

**Hercules technical gate → local Qwen semantic evaluator → Hercules score normalization → tournament**

The Qwen-specific implementation lives under `hercules-video/evaluators/`. No Qwen dependency is added to the Hercules core, storyboard, render bridge, campaign coordinator, or execution service.

## Offline-only model policy

The evaluator requires an absolute local model directory plus a local model manifest containing:

- exact model ID,
- model revision,
- declared license,
- per-file byte sizes,
- per-file SHA-256 hashes.

Every declared file is verified before the evaluator becomes ready. The worker runs with `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, and `local_files_only=True`; it does not download checkpoints.

## Semantic rubric

The evaluator returns strict 0–1 scores for prompt adherence, temporal consistency, visual quality, brand consistency, artifact freedom, and reliability. Hercules validates every score before use.

Audio is not scored here because the current launch pipeline stages audio separately.

## Evidence

Each semantic evaluation records evaluator ID, Qwen model ID, pinned model revision, verified model-manifest fingerprint, evaluated video SHA-256, shot ID, sample FPS, bounded evidence notes, semantic scores, and a deterministic evidence fingerprint.

The Hercules quality gate preserves this semantic evidence alongside technical media evidence.

## Ownership boundary

Hercules owns the evaluator orchestration, local model-integrity policy, rubric, validation, evidence schema, and quality decision path. Qwen model code and weights remain third-party Apache-2.0 components behind the evaluator boundary.

## Next increment

Wire this evaluator into the v1.2 launch bootstrap as the default local semantic evaluator when a valid Qwen model manifest is configured.
