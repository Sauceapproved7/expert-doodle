# Hercules DA-45 — Alternative open-weight CPU inference benchmark

## Purpose
A genuine 0.10 CPU / 512 MiB test of the previously evaluated external SmolLM2-360M-Instruct model returned the wrong answer `2` for `2+2` even after prompting changes. Rather than repeatedly re-testing an unqualified model or enabling an unverified provider, this run compares a **different** Apache-2.0 licensed instruct model, Qwen2.5-0.5B.

The original Hercules service, business approvals, owner AI lab, model registry and first-party math tool are left untouched.

## External model (not company-authored)
- Source `Qwen/Qwen2.5-0.5B-Instruct`, Apache-2.0.
- Quantized by `bartowski` as `Qwen2.5-0.5B-Instruct-Q3_K_S.gguf`, revision `eadd1b868ae382c989d828189bdb8e5d34dc675c`.
- Hugging Face published exact SHA-256: `468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34`.
- Published download size approximately **338 MB**; download is bounded to 300–360 million bytes and admitted **only** after validating the exact SHA-256. The bounds are not substituted for cryptographic verification.
- External `ggml-org/llama.cpp` inference source is pinned at `d81235049384534c167caea52b85a694f6103d14`.
- Vendor weights remain licensed to their respective creators and are downloaded only to disposable CI scratch space. Neither model nor upstream engine source is committed or represented as owned weights.

## Experimental constraints and evidence
- Public Hercules GitHub repository; standard hosted Ubuntu runner; permissions `contents:read`; no API keys, model SaaS, new subscription or production endpoints. `timeout-minutes:20`.
- The real model is loaded only inside an isolated Docker cgroup: `--cpus 0.10`, `--memory 512m`, no swap, `--network none`, root filesystem read-only, non-root, privileges dropped, temporary scratch, process limit 64.
- Direct loopback `/v1/chat/completions`, **three independently generated** non-customer requests: `2 + 2`, larger of 7 and 12, and capital of France. All require exact model ID, HTTP 200, assistant role, completed `finish_reason:stop`, nonempty text and correct semantic answer; no banners or fake provider replies count.
- Report peak `/proc` process RSS and Docker cgroup memory peak; use the more conservative figure, requiring at least 128 MiB headroom. Each reply must finish within 15 seconds to screen for a further isolated lab.
- Even 3/3 answers with sufficient resources produces `qualityCandidateForFurtherLab=true` **only**, never production qualification. Free GitHub runner conditions are not an actual Render free-service cold-start, memory sharing or live SLA test.
- On timeout, OOM, malformed response, mismatch, wrong response or insufficient headroom, preserve the negative result; no automatic migration to paid compute or production model switch.

## Other unresolved launch work
This test cannot open public Hercules signup, resolve Railway G4F offline status, prove full chat quality, fix Supabase's native password warning, demonstrate payment capture or enable Shopify paid software fulfillment. Each remains independently gated.

## Tests
```sh
node --test tests/hercules-qwen-halfb-cpu-diagnostic.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/security-baseline.mjs
```

## Actual completed isolated CPU result — October 13, 2026

GitHub job `115433320527` completed successfully as an **experiment**, not a production qualification. The exact checksum-pinned Qwen2.5-0.5B Q3_K_S model returned three correct real assistant completions under the measured Docker 0.10-CPU quota and 512-MiB cgroup memory limit:

| Prompt | Actual response | Elapsed |
| --- | --- | ---: |
| 2 + 2 | `4` | 4,102 ms |
| Larger: 7 or 12 | `12` | 3,500 ms |
| Capital of France | `Paris` | 2,202 ms |

**Critical failure:** The model process peak RSS was **570,011,648 bytes (~543.6 MiB)**, exceeding the cgroup's 536,870,912-byte (512-MiB) limit and leaving no 128-MiB headroom. The separately observed cgroup peak was 225,280,000 bytes, but the evaluator deliberately uses the more conservative **max(process RSS, cgroup peak)**. Memory readings can differ because of memory mapping and accounting; this lab cannot establish that the full live Hercules model+Node workload fits. The observed diagnosis is `qualityCandidateForFurtherLab=false`, `memoryWithinLimit=false`, `memoryHeadroomOk=false` despite `correctAnswers=3`.

Thus **do not install this Q3_K_S candidate on Render Free or activate public chat**. Do not weaken the memory threshold to accommodate the model. A smaller pinned quantization or a separately verified larger no-extra-cost authorized host needs its own independent measurement. The workflow success means the evidence procedure completed, not that the candidate passed.
