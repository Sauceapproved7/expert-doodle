# Hercules Qwen Cold-load Memory Proof — DA-45

## Problem

The original Qwen2.5-0.5B Q3_K_S run answered three factual prompts correctly under a 0.1-CPU, 512-MiB Docker cgroup. Its process peak RSS (~544 MiB) was far larger than the observed cgroup memory peak (~215 MiB), so the original conservative evaluator declined eligibility. That difference might reflect mapped model pages cached outside the cgroup. It cannot be interpreted as a proof of production readiness or as an independently validated inability to run.

## No-cost independent cold-charge experiment

The first-party [Hercules cold-load workflow](../.github/workflows/hercules-qwen-cold-load.yml) uses an existing public GitHub repository's standard Ubuntu runner; no cloud service is provisioned. It compiles the pinned upstream llama.cpp engine and verifies the exact SHA-256 of the Apache-2.0 Qwen2.5-0.5B-Instruct-Q3_K_S GGUF (revision `eadd1b868ae382c989d828189bdb8e5d34dc675c`; SHA256 `468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34`) in ephemeral scratch space.

Inside a no-network, read-only, unprivileged Docker container with 0.10 CPU and hard 512-MiB memory/no swap, the test **copies the entire GGUF into an internal, cgroup-charged tmpfs** before loading it. This prevents assuming that mapped weights pre-cached by the host outside the cgroup are free when deploying cold on a new machine. The workflow verifies kernel `cpu.max`, `memory.max`, and charged `memory.current`, attempts one real HTTP arithmetic answer through the pinned local llama-server, reads kernel `memory.peak`, and checks the fixed answer. If the container is OOM-killed, its recorded `OOMKilled` status produces a fail-closed negative diagnostic instead of a fabricated green response.

A genuine qualified observation requires a successful container exit, the model's charged copy, the exact 0.10 CPU/512MiB cgroup, a complete nonempty response saying 4 to 2+2 within 15 seconds, and **at least 128 MiB** unused memory. Any error, timeout, failed model start, wrong answer, or OOM has `eligibleForMoreLab=false` and never opens production approval.

This is not an actual Render Free cold start, uptime or billing benchmark. The test does not install model weights in Hercules' live Render lab, restart Railway, alter Shopify or payouts, activate public registration, or declare general model quality. **A green GitHub workflow means only that the evidence procedure ran, not that the model passed.** Read its structured verdict and see the separate owner/provider launch gates.

The GGUF/llama.cpp/Ubuntu image are externally licensed, downloaded only to temporary runner storage, and never claimed as SauceApproved-created intellectual property.

## Focused checks

```sh
node --test tests/hercules-qwen-cold-load.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```
