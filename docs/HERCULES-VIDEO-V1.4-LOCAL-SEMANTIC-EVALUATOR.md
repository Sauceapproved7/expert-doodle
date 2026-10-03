# Hercules Video v1.4 — Local Semantic Evaluator

## Decision

First self-hosted semantic evaluator backend: **Qwen3-VL-4B-Instruct**.

Qwen3-VL is used only as a replaceable open-weight evaluator backend. It is not a Hercules-native checkpoint and it is not eligible for native-only production routing.

## Why this model

- native video understanding and grounding support,
- local Transformers execution,
- smaller 4B footprint than the larger Qwen3-VL variants,
- Apache 2.0 upstream project license,
- Apache 2.0 model-repository license.

## Quality path

**technical media gate → local Qwen semantic evaluator → Hercules normalization → tournament → launch evidence**

The Qwen-specific implementation lives under `hercules-video/evaluators/`. Qwen dependencies do not enter the Hercules core, storyboard, render bridge, campaign coordinator, or execution service.

## Offline-only model integrity

The evaluator requires an absolute local model directory and a local manifest containing exact model ID, revision, declared license, per-file byte sizes, and per-file SHA-256 hashes.

Every declared model file is verified before the evaluator is considered ready.

The worker sets `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` and loads the model with `local_files_only=True`. It does not download weights.

## Semantic rubric

The evaluator returns strict 0–1 scores for:

- prompt adherence,
- temporal consistency,
- visual quality,
- brand consistency,
- artifact freedom,
- reliability.

Hercules validates every score before use. Native audio is intentionally excluded because launch audio is staged separately.

## Evidence chain

Each semantic evaluation records evaluator ID, Qwen model ID, pinned model revision, verified model-manifest fingerprint, evaluated video SHA-256, shot ID, sample FPS, bounded evidence notes, semantic scores, and a deterministic evidence fingerprint.

The canonical Hercules render-quality gate preserves that semantic evidence. The canonical launch-evidence layer already fingerprints the complete accepted quality result against the exact render SHA-256, so Qwen provenance becomes part of the final launch receipt.

## Hercules Model Plane rule

After local model verification, Qwen may be represented in the Hercules Model Plane only as:

- state: `candidate`,
- origin: `open-weight`,
- task: `vision`,
- runtime: `embedded`,
- mode: evaluation/development only when native-only routing is explicitly disabled.

The default native-only router rejects Qwen. This prevents an open-weight evaluator from being mistaken for a Hercules-native production model.

## Ownership boundary

Hercules owns the model-integrity policy, evaluator orchestration, rubric, score validation, evidence schema, quality gate, model-plane classification, and activation/routing rules.

Qwen code and weights remain third-party Apache-2.0 components.

## Next increment

Wire the verified Qwen evaluator into the canonical launch bootstrap as the default local semantic evaluator when Qwen model paths and a valid Hercules model manifest are configured. Keep an explicit override path for a future Hercules-native vision evaluator.
