# Hercules Coder Neural v0.2

## Purpose

Hercules Coder Neural v0.2 is the first generative software-language candidate for the Hercules Coder family.

It does **not** replace active Coder v0.1, which remains the production software-work classifier.

## Architecture

Coder v0.2 reuses Hercules-owned language infrastructure:

- tokenizer v0.2,
- learned token embeddings,
- three-token context,
- learned softmax next-token output,
- deterministic seeded SGD,
- deterministic greedy generation.

The training and evaluation corpora contain only Hercules-authored JavaScript patterns covering validation, registries, HTTP services, hashing, tests, routing, runtime checks, and evidence handling.

No third-party source-code dataset, model weights, tokenizer package, or ML SDK is packaged.

## Candidate gates

The held-out software corpus must satisfy:

- overall next-token Top-1 accuracy >= 0.42
- non-whitespace/content Top-1 accuracy >= 0.08
- cross-entropy improvement over unigram >= 8%
- cross-entropy <= 1.45x the code backoff baseline
- held-out token coverage >= 0.80

Passing these thresholds produces a candidate checkpoint only.

## Reproducible build

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-coder-neural-v0.2.mjs

Outputs:

- `.hercules-training/coder-neural-v0.2/checkpoint.json`
- `.hercules-training/coder-neural-v0.2/training-evidence.json`

## Promotion boundary

Coder v0.2 must first pass canonical `main` training and receive a permanent candidate attestation before any evaluation runtime or production-promotion work.
