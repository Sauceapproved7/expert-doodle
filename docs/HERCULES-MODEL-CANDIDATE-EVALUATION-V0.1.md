# Hercules Model Candidate Evaluation v0.1

## Purpose

The candidate-evaluation lane lets Hercules execute an evidence-backed model candidate for controlled testing **without changing production routing**.

Supported candidates are `hercules-core-neural-v03` and `hercules-coder-neural-v02`.

## Production isolation

Production behavior remains unchanged:

- `POST /v1/route` uses only the active model catalog.
- `POST /v1/infer` uses only active model runtimes.
- Core production traffic continues to resolve to active `hercules-core` v0.1.
- Code production traffic continues to resolve to active `hercules-coder` v0.1.
- Candidate entries remain in `state: "candidate"` with `runtime: null` in the candidate registry.
- A candidate cannot become active through the evaluation endpoint.

## Default-deny switch

Candidate execution is disabled unless the model-plane process is started with:

    HERCULES_MODEL_ENABLE_CANDIDATES=true

When the switch is absent or false, `POST /v1/candidates/infer` returns HTTP 403.

Only candidate runtimes explicitly loaded by the launcher are executable.

## Authenticated evaluation endpoint

Endpoint:

    POST /v1/candidates/infer

The endpoint requires the same bearer control token as the rest of the authenticated model-plane API.

Example request body:

    {
      "candidateId": "hercules-core-neural-v03",
      "task": "general",
      "input": {
        "prompt": "Hercules ",
        "maxTokens": 24
      }
    }

The response identifies the candidate separately from active models and includes its immutable checkpoint hash.

Coder example:

    {
      "candidateId": "hercules-coder-neural-v02",
      "task": "code",
      "input": {
        "prompt": "export function ",
        "maxTokens": 24
      }
    }

## Core Neural v0.3 reconstruction

The embedded candidate runtime:

1. reads the canonical Hercules-owned language training corpus,
2. rebuilds tokenizer v0.2,
3. retrains the v0.3 neural next-token architecture with fixed hyperparameters and seed,
4. computes the deterministic checkpoint SHA-256,
5. refuses to load if the reconstructed checkpoint differs from the attested candidate hash.

Canonical checkpoint:

    sha256:223aebb35f003ff5e144e29bfd8a613206802b7cdc70da35be31f067c0b08b9f

## Coder Neural v0.2 reconstruction

The Coder candidate runtime follows the same fail-closed pattern using the canonical Hercules-owned software corpus and fixed v0.2 hyperparameters.

Canonical checkpoint:

    sha256:7ffb1ec7f2fa70349db6711f101d45fedd5b6440fb9d9e0d72a559fe7ebf2bae

The runtime accepts only the `code` task.

## Control-token handling

If `HERCULES_MODEL_TOKEN` is supplied, the launcher uses it.

If no token is supplied, the launcher creates an in-memory session token. The token value is **not printed to startup output**.

For an externally operated service, supply the control token through an authorized secret/environment boundary.

## Promotion boundary

Candidate evaluation is not promotion.

Promoting either neural candidate requires a separate change that updates the corresponding active catalog/runtime and passes the applicable training, model-plane, provenance, owner-code, security, and code-scanning gates. Candidate evaluation cannot perform promotion.
