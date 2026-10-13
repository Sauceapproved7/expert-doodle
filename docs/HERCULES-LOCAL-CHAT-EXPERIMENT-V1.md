# Hercules local chat experiment v1 — DA-45

**Scope:** An original, optionally enabled inference adapter for an operator-hosted Ollama-compatible model server **on the same machine** as the Hercules Native Model Plane. It does not contact Railway, OpenAI, or any third-party inference endpoint.

## Operational state

- **Default OFF.** `HERCULES_LOCAL_CHAT_ENABLED` must equal `true`; otherwise token-protected `POST /v1/chat` returns `503 local_chat_disabled`.
- The backend URL **must be numeric loopback** (`http://127.0.0.1:11434` by default, or IPv6 `::1`), with no username, password, remote host, path, query, fragment or HTTPS redirection. It never accepts caller-supplied backend URLs.
- `HERCULES_LOCAL_CHAT_MODEL` must be an exact configured model ID. Before each generation, the adapter checks its presence using `GET /api/tags`. It sends a bounded prompt to `POST /api/chat` with `stream:false` and `num_predict <= 128`.
- A successful response requires the correct model ID, assistant role, completed response, and nonempty bounded text. Failures do not silently switch to a paid model or fake a positive completion.
- The existing Hercules **Bearer control token** protects `GET /v1/chat/readiness` and `POST /v1/chat`. `/health` remains process-only and is **not** evidence of model availability or chat quality.
- A successful local reply is marked `inferenceVerified:true` for **that single transaction**. It **never** authorizes public registration, production release, customer commerce or Devbrain readiness. The lab's default-status endpoint reports `inferenceVerified:false`.

## Optional evaluation variables

```text
HERCULES_LOCAL_CHAT_ENABLED=true
HERCULES_LOCAL_CHAT_ENDPOINT=http://127.0.0.1:11434
HERCULES_LOCAL_CHAT_MODEL=<exact-model-name-in-local-server>
```

The adapter **does not install, run, download or provision** a model server or model weight. There is no supplied model and no inferred cost. A real experiment requires a separately verified **licensed open-weight GGUF** and a local Ollama-compatible server running within verified memory, CPU, storage, data-transfer and total workspace hour limits. Never imply the model or hardware has been installed solely because an API endpoint exists.

## Feasibility gate before even isolated deployment

1. Confirm existing Render service `hercules-native-model-plane-lab` and its **free** plan and **auto-deploy OFF**; do not change its current start command before a separate cold-start / memory check.
2. Render Free's 750 instance-hours **are shared across the workspace** and services sleep after inactivity; downloads, outbound bandwidth, and build minutes can exceed included limits. No claim of indefinite or zero-dollar use until verified with the workspace's actual metering.
3. Research candidate open-weight models and their licenses (e.g. Apache-2.0 small instruct weights), evaluate provenance and checksum, but do not commit vendor weights or external binaries.
4. Demonstrate a live generated reply and test factual/basic multi-turn behavior on the exact candidate; test failed/missing backend, remote URL rejection, wrong model and empty responses. Do **not** train to the single Devbrain probe phrase to manufacture green status.
5. Only then independently consider a controlled deployment, original Hercules branding, owner approval boundaries, and native-release checks. Keep production `hercules-ai` and public launch **unchanged** until proven.

## Hercules-specific engineering distinctions

1. **Network custody:** loopback-only generation prevents silently exporting prompts to a remote model gateway.
2. **Evidence separation:** server alive, model catalog present, actual local text output, quality benchmarks, and public release approval are separate explicit states.

## Verification

```sh
node --test tests/hercules-models-local-chat.test.mjs
node --test tests/hercules-models*.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

The local HTTP model-server simulator in unit tests proves protocol handling and failure behavior only; **it is not a proof of production AI inference**.

## Optional llama.cpp local compatibility (DA-45, October 13, 2026)

The original adapter continues to default to `ollama`. A second supported protocol, `llama-cpp`, is **explicitly opt-in** with `HERCULES_LOCAL_CHAT_PROTOCOL=llama-cpp`, while `HERCULES_LOCAL_CHAT_ENABLED` stays `false` unless independently authorized for a **separate lab**. Both use only numeric loopback addresses and require the existing Hercules control bearer token at the model-plane boundary. Remote URLs, credentials in endpoints, and unrecognized protocols remain prohibited.

The llama.cpp profile checks **`GET /v1/models`** for the exact configured model ID, then sends a bounded nonstreaming `POST /v1/chat/completions` with a deterministic temperature and token budget. Success requires a single `finish_reason:stop` assistant choice, the exact model ID, and nonempty generated text. Missing models, empty/partial/wrong replies or transport failures remain error states, never generated success.

The PR tests use an in-process simulated provider; the separate [PR #947](https://github.com/Sauceapproved7/expert-doodle/pull/947) contains the real 360M checkpoint CPU run and its observed outputs. **Neither test proves speed or reliable chat quality under the existing Render lab's 0.15 CPU limit**. No model weights are installed, no Render deployment is changed, and public launch remains fail-closed.

