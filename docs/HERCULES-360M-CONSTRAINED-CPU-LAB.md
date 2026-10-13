# Hercules 360M under a 0.15-vCPU / 512-MiB lab quota

This is a resource-constrained **GitHub Actions experiment**, not an actual measurement of Hercules' Render instance. It builds the pinned upstream llama.cpp CPU server on a standard GitHub Ubuntu runner, downloads a checksum-verified licensed SmolLM2-360M GGUF, and runs the server inside a Docker cgroup with `--cpus 0.15`, `--memory 512m` and `--memory-swap 512m`.

## What is verified

Before accepting any evidence, the experiment reads `/sys/fs/cgroup/cpu.max` and `/sys/fs/cgroup/memory.max` from the active model container and requires exactly `15000 100000` and `536870912`. It measures real nine-question response times, cgroup `memory.peak`, and `memory.events` OOM kills. Missing information, an unavailable model, an unverified quota, an OOM event, malformed results or an incomplete prompt is a **failed resource trial**. Results include only sanitized sample IDs and pass/fail metrics, not completion texts, credentials or customer questions.

Docker runs as an unprivileged user, with read-only filesystem, bounded process count, no additional capabilities and a localhost-bound endpoint. The host loopback network is needed only for synthetic requests by the GitHub Actions runner. The container image is an externally maintained Ubuntu base and is not SauceApproved property.

## What cannot be inferred

A cgroup-limited GitHub runner is **not the same hardware, noisy-neighbor scheduling, cold start or network** as Render's free service. Matching 0.15 CPU quota and 512 MiB does not verify actual Render performance, cost, service reliability, real user concurrency or model quality. Even a successful resource trial returns `runtimeMeasuredOnRealRender:false`, `qualityApprovedForPublicChat:false` and `publicReleaseApproved:false`.

The earlier unconstrained nine-prompt experiment scored 8/9 limited semantic answers, 4/9 exact formats, 2/2 abstentions and approximately 357 MiB peak RSS at 428ms p95 **on GitHub**. The constrained trial is designed to measure the effect of resource limits, not to change safety policy.

## External IP and charges

The original test evaluator and harness are Hercules-owned source authored with AI assistance. The model is externally licensed Apache-2.0 `bartowski/SmolLM2-360M-Instruct-GGUF` at immutable revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec`, size `270590880` and SHA-256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`. The inference engine is pinned `ggml-org/llama.cpp` commit `d81235049384534c167caea52b85a694f6103d14`. External components are downloaded only within GitHub Actions and not packaged or claimed as owner-developed weights.

Workflow is an isolated public-repository standard runner, with read-only repository permissions and a 30-minute maximum run. GitHub's public-repository minute policy applies; no hosting, GPU, Render, Shopify, Stripe, DNS, app distribution or marketing change is authorized. The user has not approved a paid model deployment.

## Release gate

The protected local llama.cpp adapter from #951 is still default-off; the experiment is separate from the existing live Hercules API. The full public AI launch remains blocked by missing provider-specific performance proof, broader model evaluation, authenticated production deployment and real-device chat verification. See launch issue #909.

## Memory-accounting correction

The first real Docker-quota execution (GitHub Actions run `38424274981`) enforced the CPU/memory caps and answered nine synthetic questions, but `memory.peak` read approximately 106 MiB even though a previous process-RSS measurement of this same quantized model was about 357 MiB. Linux memory-mapped GGUF file pages may be charged to the runner cgroup that originally cached the downloaded file, so **container cgroup memory.peak alone can understate the model process's real resident memory**. Do not treat the 106-MiB counter as the GGUF's actual RAM requirement.

The improved CI also measures the running llama-server PID 1 `VmHWM` from `/proc/1/status` and requires that independent process peak RSS to be available, positive and at most 512 MiB. A missing, excessive, or contradictory measurement blocks resource-completion evidence. The test remains a GitHub resource approximation, not Render production certification.
