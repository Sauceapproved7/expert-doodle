# Hercules real-model CPU qualification — DA-45

## Why this exists

Hercules' local chat code is **disabled by default** because it has no genuinely available production language model. The current Render lab has 512 MiB RAM and 0.15 CPU, and the legacy Railway G4F inference runtime is not deployed. Enabling the switch without a real model would only change a 503 error into another 503.

This isolated, reproducible trial answers a narrower question: does a real, legally licensed 135-million-parameter language model generate basic text, and how much peak resident memory does it use? It is not an automatic deployment or proof of general usefulness.

## Third-party candidate, explicitly separate from Hercules-owned code

- **Original weights:** `HuggingFaceTB/SmolLM2-135M-Instruct`, Apache-2.0.
- **Evaluation-only quantization:** `QuantFactory/SmolLM2-135M-Instruct-GGUF`, `SmolLM2-135M-Instruct.Q4_K_M.gguf`, pinned at commit `476854d00ede130660aba430d15f9347ad2e7d0e`.
- **Weight bytes:** 105,454,144.
- **Verified SHA-256:** `8030f04528538d47bda434f6f0bdf3952c40a58123e4d5e755332f23731a8684`.
- **Native inference engine:** `ggml-org/llama.cpp`, tagged v0.6.0, pinned source commit `d81235049384534c167caea52b85a694f6103d14`.

Model weights and upstream source are **not company-authored code** and are not added to the repository. They are downloaded into an ephemeral test runner, checksum-validated, executed only against fixed non-customer prompts, then discarded. Maintain upstream notices/license attribution whenever distributing weights or their derivatives.

## Test operation

`.github/workflows/hercules-real-model-trial.yml` uses a **standard** hosted Ubuntu 24.04 runner in the existing **public** repository. GitHub's published documentation states that standard hosted runners for public repositories are free. This workflow has read-only repository permissions and a 20-minute timeout; it does not create billed model hosting, upload CI artifacts or call production endpoints.

The workflow compiles the exact pinned engine, validates the downloaded GGUF checksum and byte count, starts a bound 127.0.0.1 chat endpoint, and performs these three real inference prompts:

1. 2+2 → exactly `4`.
2. France's capital → exactly `Paris`.
3. Follow a one-word instruction → `HELLO`.

It records **actual** generated responses through the OpenAI-compatible localhost API (not fabricated mock text) and the Linux process's peak resident memory from `/proc/$pid/status`. The evaluator refuses to qualify missing data, incorrect answers, blank output, memory over 512 MiB or absent RSS readings. Even a perfect 3/3 **never** flips `chatInferenceVerifiedForProduction`, `publicReleaseApproved` or `paidCommerceEnabled`. The CI report is not a quality benchmark for a generally capable assistant and does not replicate Render's extremely limited CPU allowance.

## Constraints and next gate

- No Railway restart, Render replacement, or commercial checkout mutation is part of this trial.
- No Hugging Face compute jobs are used; those jobs may require positive paid credit and are billed by the minute.
- Render's free lab remains deployed at its own existing commit with auto-deploy disabled; this trial does not install the model there.
- Model distribution requires respecting Apache-2.0 and upstream model notices.
- A CPU/RAM-compatible, independently qualified, safely hosted and **funded** runtime plus a bounded real chatbot evaluation are required before connecting Devbrain. The model's smaller download size alone is not proof that runtime RSS fits 512 MiB or that responses are useful.
- Keep Hercules public registration, launch admission, payments and existing commercial services unchanged.

## Local developer checks

```sh
node --test tests/hercules-real-model-trial.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```
