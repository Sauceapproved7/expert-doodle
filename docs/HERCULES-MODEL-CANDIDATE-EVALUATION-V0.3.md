# Hercules Candidate Evaluation Lane v0.3

## Purpose

Hercules can now execute an evidence-backed candidate checkpoint without making it a production model.

Core Neural v0.3 is the first model to use this lane.

## Safety boundary

Candidate evaluation is **disabled by default**.

The model-plane launcher enables it only when:

    HERCULES_MODEL_ENABLE_CANDIDATES=true

Production routes remain separate:

- `POST /v1/route` selects only the active model registry.
- `POST /v1/infer` executes only active routed models.
- `POST /v1/candidates/infer` is the explicit candidate-only lane.

A candidate cannot enter production routing merely because its evaluation runtime is loaded.

## Checkpoint verification

When candidate evaluation is enabled, Hercules reconstructs Core Neural v0.3 from:

- the canonical Hercules tokenizer,
- the owner-authored language corpus,
- the fixed v0.3 neural architecture and hyperparameters.

The runtime calculates the reconstructed checkpoint SHA-256 and refuses to load unless it equals:

    223aebb35f003ff5e144e29bfd8a613206802b7cdc70da35be31f067c0b08b9f

## API

Authenticated candidate inventory:

    GET /v1/candidates

Explicit evaluation inference:

    POST /v1/candidates/infer

Example body:

    {
      "candidateId": "hercules-core-neural-v03",
      "task": "general",
      "input": {
        "prompt": "Hercules ",
        "maxTokens": 24
      }
    }

## Control token handling

The model-plane launcher no longer prints generated control-token values to startup output. It reports only whether the token came from the environment or was generated for the current process.

## Promotion rule

Evaluation availability is not promotion.

Core v0.1 remains the active production model for the `general` task. Promoting Core Neural v0.3 requires a separate repository change and its own training, model-plane, provenance, owner-code, security, and CodeQL gates.
