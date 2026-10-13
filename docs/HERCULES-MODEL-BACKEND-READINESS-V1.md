# Hercules model-backend readiness, separated from process health

On October 13, 2026 the public Hercules AI process served the web UI and HTTP `/health`, but its public `/v1/models` responded 502 to an independent GitHub-hosted probe. The production Render service remained on an older SHA than GitHub main. This source change does not deploy production or provision a model host.

## Endpoint contracts

- `GET /health` remains an inexpensive process-level check and is intentionally unchanged.
- `GET /ready` makes one bounded, credential-free, no-redirect request to the configured Ollama-compatible backend at `HERCULES_MODEL_BASE_URL/api/tags`. The backend URL is a deployment setting, **not caller input**.
- It returns HTTP 503 on an unreachable backend, malformed inventory, or missing *exact configured default model*. Only a valid registry containing the configured model returns HTTP 200.
- Every public response contains `chat_inference_verified:false` and `public_release_approved:false`. Successful model listing alone does not demonstrate a working chat request, protected login, or production readiness.
- Response bodies contain only fixed status/reason codes, never configured model names, backend URLs, private tokens, account IDs, provider exceptions, or request data.

## TDD and acceptance

Offline: `python3 -m unittest discover -s tests -p 'test_hercules_model_readiness.py' -v`.

GitHub workflow: `.github/workflows/hercules-model-backend-readiness.yml` checks tests, Hercules execution contract, original-owner code policy, and security baseline. No new runtime dependency; uses the existing pinned Python FastAPI + httpx stack.

Follow-on rollout still requires provider-confirmed exact SHA, a legitimately authorized running Ollama-compatible model service, and a bounded real chat smoke test in controlled staging. Do not assign production success to this source merge or trigger a broad Render deployment while other unrelated commits remain unreviewed.

The model service cannot be manufactured by returning dummy model records or reusing Hercules embedded classifiers as an unproven general chatbot. No billable service or credentials are granted by this change.

## Provenance

Original SauceApproved/Hercules implementation, with AI assistance; no third-party source, model checkpoints, keys or assets added. Existing licenses and owner-controlled release gate preserved.

## Provider-safe verification sequence

After an authorized deployment, compare the Render deployment SHA with the intended reviewed commit, then check `GET /health`, `GET /ready` and `GET /v1/models` in that order. `/health` is process-only; `/ready` is exact-default-model inventory; `/v1/models` contains model names and should not be included in public audit logs. All three are necessary but still insufficient for proving a real model-generated chat response. Do not start paid inference or public promotion from the model list alone.
