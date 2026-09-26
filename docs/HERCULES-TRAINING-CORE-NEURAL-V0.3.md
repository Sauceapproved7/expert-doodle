# Hercules Core Neural v0.3

## Purpose

Hercules Core Neural v0.3 is the first **trainable neural next-token candidate** in the Hercules-owned model stack.

It does not replace the active Core control classifier, and it is not represented as a frontier-scale language model.

## Architecture

The candidate is implemented entirely in repository-owned JavaScript:

- Hercules tokenizer v0.2
- two-token context window
- learned token embeddings
- learned softmax output layer
- cross-entropy training
- deterministic seeded SGD
- deterministic greedy generation

No third-party ML framework, tokenizer package, model weights, or external language corpus is packaged.

## Evaluation

The candidate is evaluated on the same held-out Hercules-authored language set used by the v0.2 foundation.

It must:

- achieve overall next-token Top-1 accuracy >= 0.30
- achieve non-whitespace/content Top-1 accuracy >= 0.08
- improve cross entropy over a unigram baseline by at least 5%
- remain within 1.35x of the v0.2 backoff model cross entropy
- preserve held-out token coverage >= 0.80

These are candidate gates. Passing does not automatically promote the neural model into the active Core runtime.

## Reproducible build

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-core-neural-v0.3.mjs

Outputs:

- `.hercules-training/core-neural-v0.3/checkpoint.json`
- `.hercules-training/core-neural-v0.3/training-evidence.json`

## Why this matters

v0.2 proved Hercules could own tokenization and deterministic next-token generation.

v0.3 adds actual learned numeric parameters trained by gradient descent. That creates a native neural checkpoint format that can later grow in embedding size, context length, hidden layers, attention, and corpus scale without changing the existing provenance and activation contracts.
