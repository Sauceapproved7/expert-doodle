# Hercules Research Neural v0.2

## Purpose

Hercules Research Neural v0.2 is the first generative evidence-language candidate for the Hercules Research family.

It does **not** replace active Research v0.1, which remains the production research-strategy classifier.

## Training focus

The owner-authored corpus teaches recurring research language around:

- identifying the exact claim,
- preferring official and primary sources,
- checking recency for changing facts,
- corroborating important claims,
- matching citations to supported statements,
- comparing sources using the same criteria,
- separating facts from interpretation,
- stating uncertainty when evidence is incomplete.

No third-party text corpus, model weights, tokenizer package, or ML SDK is packaged.

## Architecture

Research v0.2 reuses the Hercules-owned neural language stack:

- tokenizer v0.2,
- three-token context,
- 12-dimensional learned embeddings,
- learned softmax next-token output,
- 32 deterministic SGD epochs,
- learning rate 0.065,
- seed 47.

## Candidate gates

The held-out research corpus must satisfy:

- overall next-token Top-1 accuracy >= 0.40
- content-token Top-1 accuracy >= 0.10
- cross-entropy improvement over unigram >= 10%
- cross-entropy <= 1.40x the research backoff baseline
- held-out token coverage >= 0.85

Passing these thresholds creates a candidate checkpoint only.

## Reproducible build

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-research-neural-v0.2.mjs

Outputs:

- `.hercules-training/research-neural-v0.2/checkpoint.json`
- `.hercules-training/research-neural-v0.2/training-evidence.json`

## Promotion boundary

Research v0.2 must pass canonical `main` training and receive a permanent candidate attestation before any evaluation-runtime or production-promotion work.
