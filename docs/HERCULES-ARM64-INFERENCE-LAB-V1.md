# Hercules Native ARM64 Language-Model Laboratory — DA-45

## Goal

Hercules requires real local text inference without adding a paid third-party AI subscription. The current Render Free service is **0.1 CPU, 512 MiB**; the measured SmolLM2-360M model gave incorrect basic math in a strict 0.1-CPU test, and Qwen2.5-0.5B Q3_K_S gave three correct answers but failed the 512 MiB cold-load ceiling.

This CI-only native ARM64 experiment checks whether the **same** Qwen model can generate genuine text and stay within a conservative memory footprint on an ARM machine. The long-term candidate is a separately owner-authorized ARM compute host. No such host is represented as created or controlled by this test.

## Provider and hardware facts

- Oracle's current Always Free Compute documentation says qualifying tenancies include up to **1,500 Arm OCPU-hours** and **9,000 GB-hours** monthly, equivalent to **2 OCPUs and 12 GB of RAM** for an Always Free account. Registration, identity checks, availability, actual account credit/spend settings and a provisioned instance remain **unverified**. Never imply a free instance exists merely because a plan is advertised.
- Native GitHub Actions `ubuntu-24.04-arm` standard runner is included at no runner charge in public repositories. It uses different Arm CPU hardware and available capacity than Oracle A1, so this experiment is **not** an exact OCI throughput or availability test.
- The llama.cpp CPU engine is pinned to commit `d81235049384534c167caea52b85a694f6103d14` and compiled for arm64; inference is limited to `--threads 2`. This restricts inference threads but **does not** enforce a 2-OCPU Linux cgroup or prove cloud provider quota.
- Apache-2.0 Qwen2.5-0.5B-Instruct external GGUF quantization is from `bartowski/Qwen2.5-0.5B-Instruct-GGUF` immutable revision `eadd1b868ae382c989d828189bdb8e5d34dc675c`, expected SHA256 `468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34`. It is **not company-owned model training work**.

## Evaluation

The workflow downloads test-only model weights to an ephemeral GitHub runner after verifying source revision, size and exact checksum, starts a server bound to numeric loopback `127.0.0.1`, then generates three public fixed answers: 2+2, the larger number (7/12), and France's capital. It records the exact model ID, completed response, elapsed milliseconds and `VmHWM` resident peak. Wrong/missing responses, wrong architecture, duplicate answers, excessive RAM or timeout force `armLabEligible=false`.

A good lab result still prints `ociInstanceProvisioned=false`, `ociFreeAllowanceVerifiedForAccount=false`, `productionInferenceVerified=false`, `publicReleaseApproved=false` and `paidCommerceEnabled=false`. This is not a first-sale or general chat quality test.

## Owner and commerce boundaries

No OCI tenancy provisioning, cloud credentials, card, billing plan, network firewall opening, public endpoint, Render or Railway deployment, Shopify store configuration, payment/payout activity, model-provider charge, private chat transcript, or production registration approval is part of this work.

The current Hercules model plane's real local-chat adapter already passed Bearer-token-protected local inference in isolated CI. The model has not been deployed on a verified owner-operated ARM host. Resource availability and independent operating control must be evidenced before moving from CI to owner-host deployment.

## Local checks

```sh
node --test tests/hercules-arm64-inference-lab.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```
