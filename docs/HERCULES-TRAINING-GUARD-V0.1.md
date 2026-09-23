# Hercules Training: Guard v0.1

## Purpose

Hercules Guard v0.1 is a from-scratch native action-policy classifier.

It classifies proposed actions into:

- `allow` — routine read, test, validation, local-build, and inspection work
- `review` — authorized but consequential operations that require explicit owner approval or a controlled release boundary
- `deny` — unauthorized access, credential theft, evidence tampering, provenance bypass, destructive concealment, or other prohibited operations

## Architecture

Guard v0.1 uses a repository-owned multinomial Naive Bayes classifier implemented in JavaScript. It has no third-party model weights, external policy model, or ML SDK dependency.

## Data

- `hercules-training/bootstrap/guard-actions-train.jsonl`
- `hercules-training/bootstrap/guard-actions-eval.jsonl`

Both corpora are original Hercules project material. Evaluation examples are held out from training.

## Reproducible build

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-guard.mjs

Outputs:

- `.hercules-training/bootstrap-guard/model.json`
- `.hercules-training/bootstrap-guard/training-evidence.json`

## Activation gate

Guard v0.1 must achieve:

- accuracy >= 0.90
- error rate <= 0.10

The model plane remains unchanged until a checkpoint produced by canonical `main` is independently verified and promoted.
