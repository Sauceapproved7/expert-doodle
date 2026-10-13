# Hercules real-model authenticated chat proof — DA-45

## Objective

The 360M SmolLM2 model produced real fixed-prompt text in GitHub Actions [#947](https://github.com/Sauceapproved7/expert-doodle/pull/947). The original first-party Hercules model-plane now supports llama.cpp over numeric loopback with an optional disabled-by-default protocol switch ([#951](https://github.com/Sauceapproved7/expert-doodle/pull/951)). Those proofs were separate. This PR checks them **together, end-to-end**, using an actual model and the original token-protected Hercules `POST /v1/chat` endpoint.

## Scope and boundaries

- `.github/workflows/hercules-live-model-plane-proof.yml` runs on a **standard public GitHub-hosted Ubuntu 24.04 runner**, with read-only repo permissions and 20-minute timeout. It compiles pinned llama.cpp source in the runner only.
- The third-party Apache-2.0 quantization `bartowski/SmolLM2-360M-Instruct-GGUF` is fetched **only into /tmp**, at revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec` with exact byte size **270,590,880** and SHA256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`. No copyrighted model weights or other third-party executable assets are committed.
- `scripts/hercules-live-model-plane-proof.mjs` connects only to `127.0.0.1:18773`, starts the real Hercules model-plane API on another ephemeral loopback port, and generates a random temporary Bearer token without logging it. It first proves an unauthorized chat POST is rejected with HTTP 401, then checks authenticated readiness truthfully reports **not yet verified**, and only then asks the actual 360M model a fixed noncustomer prompt through `POST /v1/chat`.
- The resulting proof must contain **complete, non-empty real text** from the exact loaded model. It logs only a bounded 180-character answer excerpt, elapsed milliseconds and explicit no-launch values.
- The pure local HTTP provider simulator in the unit tests verifies error handling but is **not** sufficient for a real result. The CI step against pinned llama.cpp provides the genuine independent run.

## What passing does not mean

Passing proves one real prompt traversed the native authenticated proxy, not that general intelligence, privacy guarantees, rate limits, streaming, conversational memory or commercial readiness have been qualified. A 360M model's actual answers were `2 + 2 = 4`, `The capital of France is Paris.`, and `Hello`; strict exact-format scoring of 1/3 did not qualify the model as production-ready. A hosted Github runner's CPU latency does not predict performance on Render's 0.15 CPU limit.

No Render deploy, Railway restart, third-party hosting subscription, live Supabase function, Shopify checkout, paid entitlement, customer records or public-registration approval is changed. Existing live Render `hercules-native-model-plane-lab` stays on its previous commit with auto-deploy disabled. A real deployment requires independent capacity/availability/latency and owner-authorized launch evidence.

## Verification

```sh
node --test tests/hercules-live-model-plane-proof.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/security-baseline.mjs
```

The laboratory test is fail-closed: unavailable weights/server, missing Bearer enforcement, mismatched model, incomplete output or zero text cannot produce a positive proof. No production release flag is ever returned.
