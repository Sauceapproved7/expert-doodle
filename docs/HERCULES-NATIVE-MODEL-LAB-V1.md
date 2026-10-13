# Hercules native model lab: isolated runtime and access-boundary evidence

The Hercules native model plane uses *owner-authored* Node.js modules in `hercules-models/`. A separate Render web service `hercules-native-model-plane-lab` was created on 2026-10-13 in the existing workspace, on the provider's `free` plan, at `https://hercules-native-model-plane-lab.onrender.com`. Its initial deploy was `dep-db731j2vcj2c738scp5g` pinned to canonical source SHA `e77e69f84705d9adaf9c8e8d8b8f992cab396725`. Render reports a successful live service, 8 active embedded runtimes loaded, candidate evaluation disabled, and auto-deploy off.

**Important:** This lab is not a general-purpose Ollama backend, and it is **not connected** to `hercules-mcp` or the public iPhone AI chat. Eight active slots include original classifiers/router/retrieval/safety; three experimental neural candidates remain disabled. There is no verified text-generation inference through the live public chat.

## Live external evidence (no credentials)

`python3 scripts/probe_hercules_native_model_lab.py` performs only three fixed public HTTPS GET requests:

- `/health`: require the correct service identity, 8 active native runtimes and candidate evaluation disabled; 75-second ceiling for a cold free instance.
- `/v1/models` and `/v1/candidates`: require HTTP 401 without authentication to show model/control surfaces were **not** inadvertently exposed. The script never obtains or transmits the generated token.

The output exposes only fixed status codes, sanitized reason labels and model counts; never internal URLs, model names, prompts, private error payloads or secrets. All requests reject redirects.

Only the *isolated lab's* existence and access boundary can pass. Regardless of results, `chat_inference_verified=false`, `production_connected=false` and `public_release_approved=false` are permanent output fields. Do not interpret lab liveness as a consumer application, native TestFlight build or commercial product.

## TDD and governance

Offline unit test: `python3 -m unittest discover -s tests -p 'test_probe_hercules_native_model_lab.py' -v`. CI: `.github/workflows/hercules-native-model-lab-smoke.yml`, plus owner-code, security-baseline and execution-contract tests. No new runtime dependency. Source from original SauceApproved/Hercules code, with AI assistance.

## Next real inference dependency

The production Hercules FastAPI service currently talks to an Ollama-compatible `HERCULES_MODEL_BASE_URL` and its configured default model. The lab uses its **own different protocol** and is not automatically a substitute. Further work would require separately proving a legitimate, resource-feasible text-generating model, a secured adapter on an isolated test branch, model-quality tests, authentication, and an approved staged rollout. Do not silently substitute one of the classification slots, buy a GPU host or change the existing production service configuration.

Existing iPhone static preview remains unchanged and no public marketing was authorized.
