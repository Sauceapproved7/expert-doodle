# DA-45 — Nine-question genuine Qwen ARM64 quality evidence

## Why this test

Existing production Hercules AI is not restored. The G4F Railway inference runtime has no active deployment, and the original Render Free model lab has no installed production generative model. Previous proof [#988](https://github.com/Sauceapproved7/expert-doodle/pull/988) verified real Qwen2.5-0.5B-Instruct model inference **3/3** on an ephemeral public GitHub-native ARM64 runner, but cannot establish production chatbot quality. The separate 0.1-CPU SmolLM2-360M lab [#965](https://github.com/Sauceapproved7/expert-doodle/pull/965) generated an incorrect 2+2 answer and was correctly rejected as a candidate.

This additional experiment compares the *same nine fixed noncustomer questions* already in `scripts/hercules-360m-quality-benchmark.mjs`, using real ARM64 Qwen inference and the existing original semantic/format scorer. Test categories: addition, capital, exact one-word instruction, subtraction, multiplication, numerical comparison, exact echo, an unknowable hypothetical future mayor, and a private password the model cannot know.

## Pinned external test inputs and ownership

- `bartowski/Qwen2.5-0.5B-Instruct-GGUF`, `Qwen2.5-0.5B-Instruct-Q3_K_S.gguf`, Apache-2.0, immutable upstream source revision `eadd1b868ae382c989d828189bdb8e5d34dc675c`, SHA-256 `468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34`.
- `ggml-org/llama.cpp` pinned original upstream commit `d81235049384534c167caea52b85a694f6103d14`.
- These **are not Hercules-authored model weights or vendor source**. This repository contains only original test logic, manifest and documentation. Upstream assets are downloaded/compiled into temporary GitHub runner workspace. No model license, ownership transfer or subscription is inferred.

## Execution and evaluation

CI uses a standard `ubuntu-24.04-arm` runner in the **public** Hercules repository, `contents: read` permissions, 20-minute cutoff, two CPU inference threads, loopback-only model server, and the exact checksum-pinned model. No deployment endpoints, customer conversations, customer passwords, private access or provider tokens are used. Responses are actual local `/v1/chat/completions` results.

The pure evaluator `scripts/hercules-arm64-nine-quality.mjs` verifies native ARM64 architecture, exactly two configured inference threads, unique complete nine-case evidence, exact serving model `hercules-arm-trial`, completed stop reasons, nonempty bounded responses, numeric per-case elapsed time and independently measured model-process peak RSS. It reuses `evaluate360mQuality` for comparable semantic, exact-format and appropriate-abstention counts.

**Experimental-quality pass** requires 9/9 semantic answers, both refusal/abstention checks, measured memory below 6 GiB and p95 response time within 15 seconds. This is intentionally a small screening threshold, **not proof of public chatbot safety or capabilities**. A GitHub ARM runner is not an Oracle Cloud VM, provider billing verification or capacity guarantee. Any wrong numerical answer, guessed password, fabricated unknown person, wrong model, truncated response or invalid resource evidence prevents even further-lab eligibility.

Evidence always includes `ociInstanceProvisioned:false`, `ociFreeAllowanceVerifiedForAccount:false`, `productionInferenceVerified:false`, `qualityApprovedForPublicChat:false`, `publicReleaseApproved:false`, `paidCommerceEnabled:false`. Even a high score does not authorize model deployment or Hercules public signup.

## Owner-controlled deployment boundary

Oracle Cloud Always Free A1 accounts, when eligible and available, may offer more RAM and CPU headroom than the Render Free 512 MiB service. No actual OCI account/host, identity verification, payment method, home-region free capacity or owner-approved Host Engine integration is proven here. Do not create paid services, request customer credit cards, restart Railway, change Render deployment, or move Shopify payments and public registration. Further work requires actual trusted owned host, bounded CPU/memory/cold-start tests, security, streaming and rate limiting, license notices, real quality evaluation, and independent provider-cost checks.

## Local tests

```sh
node --test tests/hercules-arm64-nine-quality.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

## Verified first nine-question baseline

An earlier **identical** four-file test on PR #995 produced nine valid genuine ARM64 Qwen answers, **8/9 semantic correctness**, **8/9 exact format**, both abstentions passed, peak process RSS **413,900,800 bytes**, and observed p95 latency **910 ms** on the GitHub runner. The model did not follow the exact HELLO instruction and instead returned a conversational greeting. Accordingly `furtherArmLabEligible=false`. This remains a test-runner result, not an OCI host benchmark. PR #995 was closed unmerged due concurrent main changes; this replacement must run its own checks.

The repository also fixed an unrelated Cleaner test false positive in merged PR #997 before this branch. Any real-model or CI success must not be construed as authorization to deploy, bill, or enable public Hercules registration.
