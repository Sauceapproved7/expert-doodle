# DA-45 — Stronger Qwen 1.5B native ARM64 comparative quality experiment

## Purpose
Compare **real** Qwen2.5-1.5B-Instruct Q4_K_M ARM64 responses against the exact original nine core questions and separately the eighteen generic-system-instruction questions, previously tested on Qwen2.5-0.5B. Total: 27 fixed noncustomer questions.

## Fixed third-party assets / ownership
- GGUF `bartowski/Qwen2.5-1.5B-Instruct-GGUF` pinned revision `ec7a7a1a4d6ff0f562a01d41672912bacd9a56b3`; file `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` (~986 MB); pinned published SHA256 `1adf0b11065d8ad2e8123ea110d1ec956dab4ab038eab665614adba04b6c3370`.
- Source is upstream Qwen2.5-1.5B-Instruct. Both upstream/quantized model licenced Apache-2.0 (verify model card); third-party weights are NOT Hercules-owned.
- llama.cpp engine fixed at `d81235049384534c167caea52b85a694f6103d14`; compiled only in ephemeral public GitHub ARM64 runner.
- First-party JavaScript eval logic and workflow only, with AI assistance acknowledged; no vendor weights or code committed.

## Measurements and limitations
- `ubuntu-24.04-arm` standard **public-repository GitHub CI** (16 GB RAM, 4 vCPU per official runner documentation); two inference threads, 1024 context and actual localhost `/v1/chat/completions` outputs.
- Download uses immutable revision and SHA256 verification. Prints sanitized excerpts, per-answer elapsedMs, model-process peak RSS, observed p95 and strict output/abstention diagnostics.
- No trusted host, OCI tenancy, zero-cost billing guarantee, hardware SLA or machine persistence. The 1.5B model is almost 1 GB before inference and unsuitable to deploy on existing 512 MiB Render Free service.
- Original nine baseline and eighteen extended prompts are evaluated separately. The matrix reuses the existing rule set **only after enforcing** exact Qwen1.5 alias and pinned file hash.
- A job that completes successfully proves **evidence collection**, not correct model answers. The experimental candidate flag is conservative; public/commerce/production/hosting approval fields remain false even for perfect answers.

## Isolation
This PR is stacked on experimental #1005, not live main. No Render/Railway rebuild, new provider plan/card, OCI signup, commercial settings, storefront/DNS, production AI route, customer prompts or public release. Multiple live services auto-deploy main changes, so no merge to main before separately managing that risk.

## Test commands
`node --test tests/hercules-arm64-qwen15-comparison.test.mjs tests/hercules-arm64-system-quality-matrix.test.mjs`
`node scripts/verify-hercules-execution-contract.mjs`
`node scripts/verify-owner-code-only.mjs`
`node scripts/security-baseline.mjs`
