# Hercules Candidate Evaluation Lane v0.4

## Purpose

Hercules candidate evaluation now supports both evidence-backed neural language candidates:

- Core Neural v0.3
- Coder Neural v0.2

Neither candidate replaces an active production model.

## Safety boundary

Candidate execution remains **disabled by default**.

The model-plane launcher loads candidate runtimes only when:

    HERCULES_MODEL_ENABLE_CANDIDATES=true

Production and evaluation remain separate:

- `POST /v1/route` selects only the active model catalog.
- `POST /v1/infer` executes only active production models.
- `POST /v1/candidates/infer` is the explicit candidate-only lane.

Coder v0.1 remains the active production model for the `code` task.

## Coder checkpoint verification

When candidate evaluation is enabled, Hercules reconstructs Coder Neural v0.2 from:

- the Hercules tokenizer,
- the owner-authored Coder software corpus,
- context length 3,
- embedding dimension 10,
- 28 deterministic SGD epochs,
- learning rate 0.06,
- seed 41.

The runtime hashes the reconstructed checkpoint and refuses to load unless it equals:

    7ffb1ec7f2fa70349db6711f101d45fedd5b6440fb9d9e0d72a559fe7ebf2bae

## Coder evaluation request

    POST /v1/candidates/infer

    {
      "candidateId": "hercules-coder-neural-v02",
      "task": "code",
      "input": {
        "prompt": "export function ",
        "maxTokens": 24
      }
    }

## Production isolation

Loading Coder Neural v0.2 for evaluation does not alter:

- the active Coder v0.1 catalog entry,
- the production Coder checkpoint,
- production `code` routing,
- production `/v1/infer` behavior.

Promotion requires a separate repository change and the full training, model-plane, provenance, owner-code, security, and CodeQL gates.
