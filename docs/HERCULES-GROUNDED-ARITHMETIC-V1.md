# Hercules Deterministic Arithmetic v1

## Why this exists

Verified 0.1-CPU CPU model testing showed that the small SmolLM2-360M generative model returned **2** for a fixed `2+2` request; a subsequent six-question diagnostic found number comparisons remained incorrect even after changing general system instructions. The existing language model therefore cannot be entrusted with basic calculations.

Rather than altering response grading or hallucinating a larger model, Hercules now includes **an original first-party deterministic arithmetic tool**. It makes no calls to model weights, hosted AI, API providers, networking, or `eval`.

## Interface, permission and semantics

`POST /v1/tools/arithmetic` on the existing owner-controlled Hercules model-plane service, protected by its existing Bearer token. JSON body: `{"question":"Which number is larger, 7 or 12?"}`. Return `answer:"12"` with `source:"hercules-deterministic-arithmetic"` and the flags `modelInferenceVerified:false`, `publicReleaseApproved:false`, `paidCommerceEnabled:false`.

Supported and deliberate narrow scope:
- Bounded integer addition, subtraction and multiplication; examples: `2+2`, `What is 2 plus 2?`, `5 minus 3`, `-4 * 5`.
- Explicit two-number larger/smaller comparisons; examples: `Which number is larger, 7 or 12?`, `Which is smaller, -3 or 5?`.
- Signed safe integers with up to nine decimal digits, no ambiguous comparisons, bounded result magnitude.
- Unsupported/ambiguous/overflowed input fails closed at HTTP 422 with `arithmetic_unsupported`. Division, floating point, precedence, arbitrary expressions, code execution and general claims are intentionally **not supported**.

## Release boundaries

This is a **tool**, not generative AI. The untouched `POST /v1/chat` remains fail-closed when there is no installed model. A successful arithmetic answer must never set Devbrain `ai_ok`, paid checkout, public registration or a production model-release flag. The new endpoint is not a customer feature rollout; adding source code alone does not deploy it to the current Render lab (auto-deploy off) and does not grant external users access.

The separate 360M model remains unqualified for reliable general reasoning or public chat, even when this bounded tool passes all tests. No new third-party libraries, paid provider infrastructure, or model weights are bundled.

## Verify

```sh
node --test tests/hercules-models-grounded-arithmetic.test.mjs
node --test tests/hercules-models-local-chat.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/security-baseline.mjs
```
