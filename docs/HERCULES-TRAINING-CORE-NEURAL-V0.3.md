# Hercules Core Neural Baseline v0.3

## Purpose

Core Neural Baseline v0.3 is the first owner-code neural next-token candidate in the Hercules model program.

It is intentionally small. It is not a transformer, not a frontier LLM, and it does not replace the active Core model.

## Architecture

The model is implemented entirely in repository-owned JavaScript:

- trainable token embeddings,
- one-step contextual hidden representation,
- trainable softmax output weights and bias,
- cross-entropy objective,
- deterministic seeded initialization,
- deterministic SGD training.

No ML framework, external model weights, or external language corpus is packaged.

## Training

The v0.3 candidate reuses the owner-authored language corpus and tokenizer contract established by Language Foundation v0.2.

Hyperparameters:

- vocabulary limit: 256
- embedding dimension: 12
- epochs: 10
- learning rate: 0.04
- gradient clipping: 5

## Candidate gate

The neural candidate must satisfy:

- Top-1 next-token accuracy >= 0.30
- Cross-entropy ratio versus unigram baseline <= 0.95
- Token coverage >= 0.80
- Training loss reduction >= 0.20

Passing means the neural checkpoint is a valid candidate for further work. It does not automatically replace the active Core runtime.

## Next step

A later model can extend this substrate with multi-token context, deeper hidden layers, attention, and eventually a transformer-style architecture while preserving the same owner-code, provenance, checkpoint, evaluation, and promotion controls.
