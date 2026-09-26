# Hercules Candidate Evaluation Lane v0.5

## Purpose

Hercules candidate evaluation now supports three evidence-backed neural language candidates:

- Core Neural v0.3
- Coder Neural v0.2
- Research Neural v0.2

None of these candidates replaces an active production model.

## Safety boundary

Candidate execution remains **disabled by default**.

The model-plane launcher loads candidate runtimes only when:

    HERCULES_MODEL_ENABLE_CANDIDATES=true

Production and evaluation remain separate:

- `POST /v1/route` selects only the active model catalog.
- `POST /v1/infer` executes only active production models.
- `POST /v1/candidates/infer` is the explicit candidate-only lane.

Research v0.1 remains the active production model for the `research` task.

## Research checkpoint verification

When candidate evaluation is enabled, Hercules reconstructs Research Neural v0.2 from:

- the Hercules tokenizer,
- the owner-authored Research evidence corpus,
- context length 3,
- embedding dimension 12,
- 32 deterministic SGD epochs,
- learning rate 0.065,
- seed 47.

The runtime hashes the reconstructed checkpoint and refuses to load unless it equals:

    afd55d86f5c5d01b16cf36eb5e425ce556a2f35d3a2dc92c6b48b9849cdca203

## Research evaluation request

    POST /v1/candidates/infer

    {
      "candidateId": "hercules-research-neural-v02",
      "task": "research",
      "input": {
        "prompt": "Use the primary source ",
        "maxTokens": 24
      }
    }

## Production isolation

Loading Research Neural v0.2 for evaluation does not alter:

- the active Research v0.1 catalog entry,
- the production Research checkpoint,
- production `research` routing,
- production `/v1/infer` behavior.

Promotion requires a separate repository change and the full training, model-plane, provenance, owner-code, security, and CodeQL gates.
