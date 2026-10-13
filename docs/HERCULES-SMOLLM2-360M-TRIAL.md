# Hercules 360M real-model second-trial evidence — DA-45

## Why another candidate
The prior pinned SmolLM2-135M-Instruct Q4_K_M model **generated text** using a real llama.cpp server, but failed all 3 basic response tests in the ephemeral CPU run. Measured peak RSS was 166,473,728 bytes (~159 MiB), but that is not evidence of useful conversational AI.

This second test qualifies a larger candidate, **not a production release**. SmolLM2-360M-Instruct may provide better results, but no presumption of quality is made. A strict answer test cannot measure all conversation capability; inspect both actual generated text and the pass/fail classification.

## Third-party model provenance, pinned inputs
- Underlying model: SmolLM2-360M-Instruct by HuggingFaceTB, Apache-2.0.
- Quantizer and file: `bartowski/SmolLM2-360M-Instruct-GGUF` (Apache-2.0), revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec`.
- Exact GGUF: `SmolLM2-360M-Instruct-Q4_K_M.gguf`, **270,590,880 bytes**, SHA-256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`.
- Ephemeral inference engine: `ggml-org/llama.cpp` release v0.6.0, commit `d81235049384534c167caea52b85a694f6103d14`.

The model and upstream inference engine **are not SauceApproved-authored source**. The repo commits only first-party evaluation logic, workflow and documentation. The upstream files live in an ephemeral runner, are checked by commit or checksum, and are not packaged, uploaded or claimed as owned weights.

## No-cost bounded read-only verification
`.github/workflows/hercules-smollm2-360m-trial.yml` runs only for relevant pull requests or explicit workflow dispatch. It uses a standard GitHub-hosted Ubuntu runner in the existing public repository (no new subscription), has a 20-minute timeout, and read-only repository permissions. It cannot touch paid billing, Railway, Render, Shopify, Supabase or secrets.

The runner compiles pinned CPU llama-server, validates GGUF size and SHA256, listens on local loopback only, and asks fixed non-customer questions:
1. 2+2 — one number.
2. Capital of France — one city.
3. Exact HELLO instruction.

For independent human audit, it prints a **bounded 180-character** excerpt of those preselected prompts' actual generated replies, then the pure deterministic score and measured Linux process peak resident memory. Strict exact normalized scoring is intentionally conservative; raw excerpts help tell genuine bad answers from mild wording differences.

## Real deployment is still blocked
A positive run demonstrates only tested quality/memory in a GitHub Actions runner, not throughput on the existing Render model lab's **512 MiB RAM / 0.15 CPU**. A failure, timeout or missing measurement is not an approval. The machine readout always says `chatInferenceVerifiedForProduction=false`, `publicReleaseApproved=false`, `paidCommerceEnabled=false`.

Production `hercules-ai`, `HERCULES_LOCAL_CHAT_ENABLED`, Shopify, domain, payment, public-registration and existing model lab remain unchanged. No weights or model server are deployed. A substantially larger/stronger owned or properly licensed model plus performance, instruction-following, reliability, security and business gating are needed before monetizable customer AI.

## End-to-end native Hercules chat path (DA-45)

The same ephemeral, checksum-pinned 360M CPU inference job now exercises the first-party `createLocalChatAdapter({protocol:"llama-cpp"})` **through the real authenticated `createModelPlaneService`** on loopback. The probe asserts that a public unauthenticated `POST /v1/chat` returns 401; authenticated readiness is explicit `inferenceVerified:false` before use; the authenticated request reaches the actual llama.cpp model and returns bounded, nonempty original generation; a returned success remains `publicReleaseApproved:false` and is not production-chat-quality evidence.

This uses a synthetic publicly safe prompt only, localhost ports on an ephemeral GitHub Actions runner, no new service, subscription, customer data, source upload or credentials. The existing Render model lab is unchanged and auto-deploy remains disabled. This is **integration evidence** for the original Hercules codepath only, not a claim of suitable answer quality, throughput, or affordability on a shared 0.15-CPU Render Free instance.

