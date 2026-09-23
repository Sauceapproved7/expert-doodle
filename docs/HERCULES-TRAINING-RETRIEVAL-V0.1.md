# Hercules Training: Retrieval v0.1

## Purpose

Hercules Retrieval v0.1 is the second from-scratch Hercules-native model pipeline.

It learns a sparse text representation from an original Hercules document corpus and uses that representation for document embedding and reranking.

## Architecture

The model is implemented in repository-owned JavaScript with no third-party model weights and no ML SDK dependency.

Training learns inverse-document-frequency weights over:

- normalized word features
- character trigrams derived from words

Inference builds L2-normalized TF-IDF sparse vectors and scores query/document similarity with cosine similarity.

This is a compact retrieval model, not a neural language model.

## Training data

Canonical source files:

- `hercules-training/bootstrap/retrieval-documents.jsonl`
- `hercules-training/bootstrap/retrieval-eval.jsonl`

The document corpus trains IDF weights. Evaluation queries are held out from training.

## Reproducible build

Run:

    HERCULES_SOURCE_COMMIT=$(git rev-parse HEAD) \
      node hercules-training/bootstrap-retrieval.mjs

Output:

- `.hercules-training/bootstrap-retrieval/model.json`
- `.hercules-training/bootstrap-retrieval/training-evidence.json`

## Activation gate

The checkpoint must achieve:

- Top-1 ranking accuracy >= 0.80
- Mean reciprocal rank >= 0.90

The bootstrap records dataset fingerprints, training job fingerprint, checkpoint SHA-256, evaluation evidence, and activation decision.

The model plane remains unchanged until a checkpoint produced from canonical `main` is verified and separately promoted.
