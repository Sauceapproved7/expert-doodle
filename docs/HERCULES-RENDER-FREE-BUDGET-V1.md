# DA-45 — Real CPU inference under Render Free resource limits

## Purpose
The official Render compute plans list new Free web services at **0.1 CPU and 512 MiB RAM**. Read-only metrics on Hercules' existing Render lab currently show a distinct 0.15 CPU quota; testing 0.1 CPU is a deliberately more conservative compatibility check. See https://render.com/docs/compute-plans . Hercules' SmolLM2-360M lab model previously passed authenticated end-to-end generation (PR #955) on much faster GitHub hosted CPU, but it failed one basic semantic check in nine prompts and five of nine strict format checks.

This laboratory benchmark tests a **lower-bound hosting constraint** without deploying anything to Render or changing the production app.

## Reproducible, isolated external-input test
`.github/workflows/hercules-render-free-model-budget.yml` runs only on relevant PRs or explicit workflow dispatch, on a standard GitHub-hosted Ubuntu runner in Hercules' public repository with `contents: read` and a strict 20-minute job timeout. It:

1. Compiles the fixed upstream `llama.cpp` revision `d81235049384534c167caea52b85a694f6103d14` as a CPU-only CLI (with OpenMP disabled).
2. Downloads only the third-party Apache-2.0 `bartowski/SmolLM2-360M-Instruct-GGUF` Q4_K_M evaluation checkpoint to `/tmp`, immutable revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec`, exact 270,590,880 bytes and SHA-256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`.
3. Launches the pinned disposable official Ubuntu 24.04 Docker image (`sha256:2e863c44b718727c860746568e1d54afd13b2fa71b160f5cd9058fc436217b30`) using Docker CFS CPU quota `--cpus 0.10` and cgroup memory + no swap `--memory 512m --memory-swap 512m`. It explicitly reads and validates `/sys/fs/cgroup/cpu.max` and `memory.max` before the model starts.
4. Sets `--network none`, read-only filesystem, caps dropped, non-root user, PID limit, temporary bounded scratch, read-only model and binary mounts. No listening services, public ports, API keys, or user/customer data.
5. Starts the pinned CPU **llama-server** on container loopback, checks `/health`, and submits a fixed synthetic chat request over raw localhost HTTP. It captures a structured HTTP 200 JSON response with exact model ID, one stopped assistant completion, and real nonempty content; a CLI startup banner is explicitly rejected. Records elapsed wall clock and Linux cgroup `memory.peak` under the same quota.
6. Evaluates whether that observation leaves **at least 128 MiB memory headroom** and produces one response within **15 seconds**. These are deliberately strict screening criteria and must never count as production qualification.

## Interpretation and release restrictions
- A timeout, missing runtime library, cgroup quota mismatch, OOM kill, incomplete HTTP reply, model ID mismatch, or poor output is useful negative evidence; do not suppress it, grant customer release, or automatically retry on paid hosting.
- One generated output plus 0.1 CPU and 512 MiB proves only a *limited, resource-controlled Linux simulation*. It does not emulate Render's free instance startup, sleep behavior, network restrictions, billing quotas, other co-resident Hercules Node processes, or actual customer-scale quality.
- Even if `furtherLabEligible=true`, `productionInferenceVerified=false`, `customerChatApproved=false`, `publicReleaseApproved=false`, and `paidCommerceEnabled=false` remain hardcoded.
- Neither external GGUF weights nor the third-party inference engine or test container are committed or relabeled as SauceApproved-owned training work. Their individual licenses and future distribution notices must be preserved.
- Do **not** deploy to the currently live `hercules-native-model-plane-lab`, reactivate Railway G4F, subscribe to new paid infrastructure, reconfigure checkout, or open public registration based on this benchmark.

## Focused verification
```sh
node --test tests/hercules-render-free-model-budget.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/security-baseline.mjs
```
