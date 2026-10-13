# Hercules DA-45 — Does prompting fix small-model numeracy?

## Why this experiment

SmolLM2-360M's **real** 0.1-CPU model chat returned an incorrect `2` for the fixed `2+2` question, even though it was a correctly structured model completion with a measured ~10.88-second latency. The corrected gate in merged [PR #965](https://github.com/Sauceapproved7/expert-doodle/pull/965) rejects that answer rather than treating any generated text as proof of readiness.

This experiment tests whether the failure comes from prompting rather than entirely from model ability, without tuning for a single known answer. It runs three distinct questions, each in two modes: original user-only question, and the same user question with a general arithmetic/careful-calculation system instruction (not supplying any answers). Real outputs and elapsed time are logged separately.

| ID | Question | Expected number |
|---|---|---|
| addition | What is 2 plus 2? | 4 |
| compare | Larger of 7 and 12? | 12 |
| subtraction | What is 5 minus 3? | 2 |

The strict pure evaluator reports completion and correctness separately for baseline and system modes. All six model responses must come from exact model `hercules-trial`, stopped normally, and satisfy latency and resource evidence constraints; incomplete or duplicated cases invalidate the report. It logs bounded excerpts of only those synthetic test replies. It cannot approve public AI, registration, checkout or paid commercial use under any score.

## Provenance and cost controls

- First-party original evaluation code, shell runner and regression tests; developed with AI assistance.
- Apache-2.0 third-party SmolLM2-360M-Instruct Q4_K_M GGUF at pinned revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec`, exactly **270,590,880 bytes**, SHA256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`. The checkpoint is external and not SauceApproved-owned training work.
- Pinned external `ggml-org/llama.cpp` inference engine commit `d81235049384534c167caea52b85a694f6103d14` compiled in the ephemeral runner.
- Standard free public GitHub Actions Ubuntu 24.04 runner. All model requests are through loopback inside a separate disposable, read-only nonroot Ubuntu container with **0.10 CPU, 512 MiB, no swap, no external network, dropped Linux capabilities and a strict timeout**. No user messages, payment credentials, third-party model subscriptions, permanent files or model artifacts are involved.
- The existing Render lab (auto-deploy OFF), Railway service, live Hercules AI, DNS, Shopify, payout configuration and launch approvals remain untouched.

## Interpretation

A model that follows better prompts on three arithmetic cases is *not* necessarily safe, capable or reliable. A model that fails again is strong evidence the small architecture is unsuitable for uncapped mathematics in public chat. GitHub's CPU emulation is not a guarantee of Render uptime or performance.

The result may guide choosing a stronger properly licensed model, adding first-party deterministic tools for arithmetic while keeping generated responses explicitly separate, or reevaluating hosting cost. **No live cutover or new spending is authorized by this test.**
