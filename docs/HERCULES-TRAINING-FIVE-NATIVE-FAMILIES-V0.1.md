# Hercules Five Native Families v0.1

## Purpose

This increment adds from-scratch Hercules-native v0.1 checkpoints for the five canonical families that remained planned after Agent, Retrieval, and Guard were activated:

- Hercules Core
- Hercules Coder
- Hercules Vision
- Hercules Voice
- Hercules Research

## Architecture

All five use repository-owned JavaScript and original Hercules-authored training/evaluation examples. No third-party model weights, third-party datasets, or ML SDK dependency are used.

The v0.1 models are compact multinomial Naive Bayes classifiers with deterministic checkpoint serialization and SHA-256 identity.

## Capabilities

- **Core v0.1** routes general requests into explain, plan, transform, or compare modes.
- **Coder v0.1** routes software work into build, debug, test, or review modes.
- **Vision v0.1** routes visual requests into inspect, OCR, compare, or UI-analysis modes. It does not itself inspect pixels.
- **Voice v0.1** routes voice requests into transcribe, synthesize, translate, or summarize modes. It does not itself decode or synthesize audio.
- **Research v0.1** routes research work into current, primary-source, compare, or verify strategies.

These are real trained native control models, but they are intentionally narrower than the long-term flagship ambitions of the families.

## Reproducible build

Run:

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-five-native-families.mjs

Output:

    .hercules-training/five-native-families/

Each family receives:

- model.json
- training-evidence.json
- immutable checkpoint SHA-256
- held-out evaluation result
- activation decision

The combined output also includes summary.json.

## Activation gate

Each checkpoint must achieve:

- accuracy >= 0.80
- error rate <= 0.20

The catalog remains fail-closed until canonical CI evidence is verified and the exact checkpoint is separately promoted.
