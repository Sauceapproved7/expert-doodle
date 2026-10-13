## Hercules Runtime Witness v1 — October 13, 2026

- Original first-party SauceApproved Node.js code, authored with AI assistance: hercules-runtime/runtime-witness.mjs, scripts/hercules-runtime-witness.mjs, tests/hercules-runtime-witness.test.mjs, and docs/HERCULES-RUNTIME-WITNESS-V1.md; attached to existing implementation-enforcement CI.
- No added dependencies, third-party code, binary files, secrets, customer data or model weights. Uses Node built-ins and unauthenticated read-only bounded public GET requests only upon an explicit CLI flag.
- Tests use synthetic responses and red-before-green failure/recovery scenarios. CI does not probe public sites. Public HTML availability cannot prove deployed SHA, authenticated functional health, commercial readiness, live payments, release approval or Codex Cloud environment publication.
- No provider credentials, billing, DNS, deployments, checkout, bank payouts, account privileges or permission changes.

## Codex Doctor cross-platform path and high-impact-file hardening — October 13, 2026

- Original first-party AI-assisted Hercules changes to `hercules-runtime/codex-readiness.mjs`, `tests/hercules-codex-doctor.test.mjs`, and the existing Doctor documentation. Node built-ins only; no dependencies, third-party code, model weights, downloaded binaries or secrets.
- Tested with RED-before-GREEN path-classification regressions. Adds conservative agent/config/runtime/infrastructure review advisories, rejects ambiguous path aliases, and flags additional private-key filename extensions without opening files.
- This tool is read-only, offline and advisory. No production permission, checkout change, deployment, Codex Cloud account publication, authentication, billing or credential access is added.

## Hercules Codex repository operator skill — October 13, 2026

- Original first-party AI-assisted SauceApproved agent instructions: `.agents/skills/hercules-codex-operator/SKILL.md`, verified by `tests/hercules-codex-operator-skill.test.mjs` in the existing implementation enforcement CI.
- Follows official repository skill metadata and discovery format, without copying external code. Node standard-library-only checks; no new third-party dependencies, licenses, or distribution obligations.
- Instruction-only skill: no new secrets, provider access, Codex environment publication authority, browser permissions, billing, DNS, Shopify, payout, or production deployment. Environment publication remains a separate account action.

## Hercules Codex Cloud repository handoff — October 13, 2026

- First-party, AI-assisted original SauceApproved source: `governance/hercules-codex-cloud-profile-v1.json`, `hercules-runtime/codex-cloud-profile.mjs`, `scripts/hercules-codex-cloud-handoff.mjs`, `tests/hercules-codex-cloud-handoff.test.mjs`, and `docs/HERCULES-CODEX-CLOUD-HANDOFF-V1.md`.
- Node.js built-ins only, no third-party dependency, network call, licensed code, secret, customer data, model file, binary or provider API. No external rights acquired or transferred.
- Commands are inert setup text. Reusable Codex Cloud publication still requires native web/desktop account action. No live store, payment, DNS, production deployment, external account creation, credential or access-grant changes.

## Hercules Codex Doctor v1 — October 13, 2026

- First-party SauceApproved source: `hercules-runtime/codex-readiness.mjs`, `scripts/hercules-codex-doctor.mjs`, `tests/hercules-codex-doctor.test.mjs`, and `docs/HERCULES-CODEX-DOCTOR-V1.md`; existing implementation enforcement CI adds the dedicated Node test.
- Authored with AI assistance using Node.js standard libraries and original Hercules policy semantics. No copied third-party code, packages, binaries, weights, user data, vendor secrets, or external runtime licenses added.
- The Doctor is read-only and offline. Local prerequisites do not prove cloud Codex registration, terminal/GitHub mount, check execution, deploy authority, checkout, payouts, or production readiness. Proposed-file risk reports are advisory and confer no authority. No service, provider, payment, DNS, customer enrollment, or live store state is changed.

## DA-45 Qwen cold-load cgroup memory audit — 2026-10-13

- Original SauceApproved first-party evidence: `scripts/hercules-qwen-cold-load.mjs`, `tests/hercules-qwen-cold-load.test.mjs`, `.github/workflows/hercules-qwen-cold-load.yml`, and `docs/HERCULES-QWEN-COLD-LOAD-V1.md`. AI-assisted authoring disclosed; original JavaScript and shell, no third-party code copied into the repository.
- Third-party disposable inputs: Qwen2.5-0.5B-Instruct Q3_K_S quantization (Apache-2.0; pinned immutable source revision `eadd1b868ae382c989d828189bdb8e5d34dc675c`, SHA256 `468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34`), pinned `ggml-org/llama.cpp` test build and digest-pinned official Ubuntu runner container. They are ephemeral lab dependencies, not original SauceApproved-trained weights.
- Security and ownership boundary: Free public GitHub standard runner only, cgroup-charged tmpfs, no-network, hard 512 MiB/0.1 CPU, no service deploy, paid provider, credential, model distribution, customer text, checkout or public-registration change. Zero public/commercial authority even for a passing resource test.
- A cgroup OOM or incomplete response is reported as negative/inconclusive evidence, not bypassed.

## Alternative small-model real inference experiment — DA-45, October 13, 2026

- Owned first-party original source: `scripts/hercules-qwen-halfb-cpu-diagnostic.mjs`, `tests/hercules-qwen-halfb-cpu-diagnostic.test.mjs`, `.github/workflows/hercules-qwen-halfb-cpu-diagnostic.yml`, `docs/HERCULES-QWEN-HALFB-CPU-DIAGNOSTIC-V1.md`. Authored with AI assistance, following TDD. No third-party source, weights, binary or SDK packaged.
- Evaluation-only vendor weights: `bartowski/Qwen2.5-0.5B-Instruct-GGUF` Q3_K_S, immutable commit `eadd1b868ae382c989d828189bdb8e5d34dc675c`, published SHA-256 `468787b643ef9081a75c6e7bd98da987f46583250248e0a0a7aca173308e8d34`; based on Apache-2.0 `Qwen/Qwen2.5-0.5B-Instruct`. Ephemeral `ggml-org/llama.cpp` pinned at `d81235049384534c167caea52b85a694f6103d14`.
- All third-party files downloaded exclusively to a temporary, no-network standard GitHub-hosted test environment. Upstream copyrights/licenses remain third-party and are not represented as Hercules-owned pretraining.
- Fixed non-customer prompts, no account credentials; protected 0.1 CPU/512MiB, no Render/Railway/Shopify/Supabase updates, no billing/provider account changes, no live model deployment or public signup/payment authority.

## Hercules bounded grounded-arithmetic tool — DA-45, 2026-10-13

- Owned first-party, AI-assisted source: `hercules-models/grounded-arithmetic.mjs`, authenticated isolated route in `hercules-models/service.mjs`, `tests/hercules-models-grounded-arithmetic.test.mjs`, `docs/HERCULES-GROUNDED-ARITHMETIC-V1.md`.
- Node.js standard-library-only deterministic integer arithmetic and numeric comparisons. No third-party libraries, network calls, model weights, provider API keys or copied proprietary algorithms.
- Explicit separation of calculations from genuine model inference, source provenance, payment authority and production release approvals. `/v1/chat` remains disabled without the real independently qualified model.
- Security: existing Bearer control authorization enforced before `POST /v1/tools/arithmetic`, strict question grammar, upper bound, refusal for unsupported and ambiguous requests. No payments, registrations, Render/Railway deployments or live runtime changes.

## Math prompt sensitivity CPU lab — DA-45, 2026-10-13

- Original AI-assisted first-party Hercules code: `scripts/hercules-math-prompt-diagnostic.mjs`, an inlined, reviewed shell harness inside the governed workflow, `tests/hercules-math-prompt-diagnostic.test.mjs`, `.github/workflows/hercules-math-prompt-diagnostic.yml`, `docs/HERCULES-MATH-PROMPT-DIAGNOSTIC-V1.md`.
- Ephemeral third-party test-only model: `bartowski/SmolLM2-360M-Instruct-GGUF` Apache-2.0, immutable revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec`, Q4_K_M file SHA256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`. Pinned `ggml-org/llama.cpp` source and Ubuntu image are temporary runner dependencies, not copied or claimed as SauceApproved-owned code.
- Scope: six public fixed math questions/modes on disposable GitHub public runner, no user data, secrets, licensed weights checked into repository, paid subscriptions, cloud deployment, storefront or release authorization.
- Model responses are explicitly measured evidence, never fabricated, and their mathematical correctness is separate from a completed generative output and release approval.

## 0.1 CPU real model truth gate — DA-45, 2026-10-13

- Owned, AI-assisted first-party additions: scripts/hercules-render-free-model-budget.mjs, tests/hercules-render-free-model-budget.test.mjs, .github/workflows/hercules-render-free-model-budget.yml, docs/HERCULES-RENDER-FREE-BUDGET-V1.md.
- Source: a clean current-main branch of PR #963's 0.1-CPU evidence; new pure arithmetic-correctness regression. No vendor weights in the Git tree.
- Ephemeral third-party test assets: Apache-2.0 bartowski/SmolLM2-360M-Instruct-GGUF Q4_K_M (SHA256 2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2), ggml-org/llama.cpp pinned d81235049384534c167caea52b85a694f6103d14, and digest-pinned disposable Ubuntu container.
- Scope: CPU lab on existing standard public GitHub runner, no new subscriptions, customer prompts, Render/Railway deploy or commerce/public-release authorization. External weights remain externally licensed.
- Evidence correction: real assistant output 2 was incorrectly treated as eligible for the synthetic 2+2 prompt; corrected evaluator refuses wrong answers and keeps production flags false.

## Real-model authenticated Hercules chat integration trial — 2026-10-13

- Owned files: `scripts/hercules-real-modelplane-e2e.mjs`, `tests/hercules-real-modelplane-e2e.test.mjs`, updates to `.github/workflows/hercules-smollm2-360m-trial.yml` and `docs/HERCULES-SMOLLM2-360M-TRIAL.md`.
- Original first-party JavaScript instrumentation authored with AI assistance using Node built-ins and existing Hercules model-plane APIs. No copied third-party code or runtime dependencies.
- An existing pinned Apache-2.0 third-party quantized SmolLM2-360M model and pinned llama.cpp are used only inside an ephemeral public-GitHub standard runner. They are not bundled, claimed as SauceApproved-owned weights or deployed.
- No live service, account, billing, public registration, commerce, payment, credential or production route changes; the real generated reply proves a lab request, not verified consumer AI quality or launch approval.

## Constrained CPU model evidence — October 13, 2026

- New owner-code paths: `scripts/hercules-360m-constrained-cpu.mjs`, `tests/hercules-360m-constrained-cpu.test.mjs`, `.github/workflows/hercules-360m-constrained-cpu.yml` and `docs/HERCULES-360M-CONSTRAINED-CPU-LAB.md`; original implementation with AI assistance.
- Third-party pinned model: SmolLM2-360M-Instruct GGUF / Apache-2.0, immutable revision, exact size and SHA as documented. Ephemeral pinned upstream llama.cpp and Ubuntu 24.04 container are **not** claimed as SauceApproved-owned IP or redistributed.
- Resource intent: Docker CPU quota 15% of one core, 512 MiB memory and swap, restricted privileges, no owner/customer data, no provider credentials. Fail-closed measurements and no launch authority.
- Release: no chat connection, Render build, commerce, public registration, paid host or storefront mutation; no production model weights in the repository.

## Real model-plane authentication proof — DA-45, 2026-10-13

- Original AI-assisted SauceApproved source: `scripts/hercules-live-model-plane-proof.mjs`, `tests/hercules-live-model-plane-proof.test.mjs`, `.github/workflows/hercules-live-model-plane-proof.yml`, and `docs/HERCULES-REAL-MODEL-AUTH-PROOF.md`.
- Runtime ownership: uses Hercules' existing original bearer-authenticated model-plane service and local-chat adapter, with Node built-ins and no third-party JavaScript dependencies.
- Temporary evaluation inputs: Apache-2.0 SmolLM2-360M-Instruct model quantized by `bartowski` (GGUF at exact revision/SHA256 documented in the lab workflow), `ggml-org/llama.cpp` pinned upstream C++ source. Both are third-party **external** infrastructure; neither is committed, copied or claimed as SauceApproved-created weights/code.
- Security/commerce: temporary loopback runner only; no credentials/real customer text, vendor model API, production deploy, payment, public registration or checkout state changes.
- Verification: real model input-output evidence through an authorized Hercules chat request, plus an explicit negative authorization probe, with a separate fail-closed declaration that commercial and production AI qualification remain false.

## Local llama.cpp protocol adapter — DA-45, October 13, 2026

- Scope: existing original Hercules `hercules-models/local-chat.mjs` plus `hercules-models/control-cli.mjs`, `tests/hercules-models-local-chat.test.mjs` and `docs/HERCULES-LOCAL-CHAT-EXPERIMENT-V1.md`.
- Origin: original first-party protocol adapter and Node built-in HTTP tests developed with AI assistance; no vendor source code, hosted inference keys or model weights copied.
- Third-party interaction: generic llama.cpp OpenAI-compatible local HTTP shapes are used only over numeric loopback; vendor engine and separately licensed weights are NOT packaged or claimed as company-owned artifacts.
- Isolation: explicit protocol selection, opt-in flag remains disabled by default, strict exact model ID and completed assistant text checks, protected bearer token, no deployment, AI release approvals or commerce changes.

## Second open-weight CPU model evaluation — 2026-10-13

- Owned paths: `scripts/hercules-smollm2-360m-trial.mjs`, `tests/hercules-smollm2-360m-trial.test.mjs`, `.github/workflows/hercules-smollm2-360m-trial.yml`, and `docs/HERCULES-SMOLLM2-360M-TRIAL.md`.
- Source: first-party evaluation wrapper, read-only CI orchestration and safety tests authored with AI assistance, using the existing original Hercules real-model evaluator and Node built-ins.
- Evaluation-only external model: `bartowski/SmolLM2-360M-Instruct-GGUF` Apache-2.0, revision `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec`, file `SmolLM2-360M-Instruct-Q4_K_M.gguf` (270,590,880 bytes, SHA256 `2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2`). Inference engine pinned to `ggml-org/llama.cpp` commit `d81235049384534c167caea52b85a694f6103d14`. These upstream binaries/model weights are not original SauceApproved intellectual property.
- No model weights, vendor libraries, training corpora, user prompts, customer data, subscription API calls or downloaded third-party code are committed. Ephemeral public GitHub standard runner only; no production deployment and no launch approval.

## External open-weight model evaluation — 2026-10-13

- Files: `scripts/hercules-real-model-trial.mjs`, `tests/hercules-real-model-trial.test.mjs`, `.github/workflows/hercules-real-model-trial.yml`, `docs/HERCULES-REAL-MODEL-TRIAL.md`.
- Origin: original Hercules pure response-and-memory evaluator, CI orchestration and tests authored with AI assistance. Node.js standard library and repository-owned tests only.
- Third-party laboratory inputs: `HuggingFaceTB/SmolLM2-135M-Instruct` original weights, `QuantFactory/SmolLM2-135M-Instruct-GGUF` quantization (Apache-2.0), and `ggml-org/llama.cpp` ephemeral pinned engine. The exact model GGUF is external, 105,454,144 bytes, SHA-256 `8030f04528538d47bda434f6f0bdf3952c40a58123e4d5e755332f23731a8684`.
- No model weights, vendor source trees, pretrained checkpoint, public customer data or dependency bundles are committed or distributed as SauceApproved-owned IP; upstream licenses must be retained if separately distributing these assets.
- Scope: bounded standard hosted public-repo CI test of genuine CPU inference, not paid hosting, customer chatbot, sale authorization, or deployment. Quality and production approval remain fail-closed even if small smoke prompts pass.

## DA-45 isolated native local-chat adapter — 2026-10-13

- Paths: `hercules-models/local-chat.mjs`, changes to `hercules-models/service.mjs` and `control-cli.mjs`, `tests/hercules-models-local-chat.test.mjs`, and `docs/HERCULES-LOCAL-CHAT-EXPERIMENT-V1.md`.
- Origin: original first-party Hercules JavaScript code and tests prepared with AI assistance. Built on the repository's existing owner-controlled model-plane HTTP server using only Node built-ins.
- External interfaces: optional on-host Ollama-compatible JSON endpoints (`/api/tags`, `/api/chat`); no vendor library or weights are copied, downloaded or packaged. The protocol implementation is original and the endpoint is restricted to numeric loopback.
- Ownership: SauceApproved controls the adapter and security envelope; **future** imported model weights would retain their own upstream licenses and must not be misrepresented as SauceApproved-owned training work.
- Scope: authenticated, bounded, default-off laboratory capability. Not automatically enabled, deployed, billable, or evidence of actual model-generated chat. No customer checkout, registration or provider configuration changes.

# Hercules IP Provenance & Canonical Source

## Independent diff triage — 2026-10-13

- Paths: `scripts/hercules-independent-review.mjs`, `tests/hercules-independent-review.test.mjs`, `.github/workflows/hercules-independent-review.yml`, and `docs/HERCULES-INDEPENDENT-REVIEW.md`.
- Origin: original Hercules static diff review implementation prepared with AI assistance and Node.js built-in modules only; no copied external source, model weights, or provider SDKs.
- Scope: bounded read-only diff review on GitHub pull requests. No provider access, no source upload, no customer data, no production authority. Not a substitute for existing security, ownership, or approval gates.

## Shopify webhook runtime repair — 2026-10-13

- Paths: Shopify webhook and bulk-reconciliation Edge Functions, runtime regression tests, reconciliation CI, and runtime repair documentation.
- Origin: original Hercules repair with AI assistance using existing Supabase infrastructure and Node built-ins; no new runtime package or third-party source.
- Scope: preserve the global URL parser, support the platform's legacy and modern API-key bindings, and read the existing provider credential column. Native HMAC, signed-bridge freshness/nonce checks, owner authorization, and paid-entitlement gates remain in place.

## Standalone browser owner handoff and context capacity — 2026-10-13

- Paths: standalone browser server/client, owner-handoff and context-capacity regression tests, and browser workflow/runbook.
- Origin: original Hercules repair with AI assistance, using existing browser infrastructure and Node built-ins; no new runtime dependency or third-party source.
- Scope: coalesce concurrent owner-context creation, bound Chromium context allocation, preserve active owner/worker requests, and reopen an approved handoff destination when the authenticated browser is blank. Provider login, verification, owner-field controls, and private-network restrictions are preserved.

## Studio post-activation handoff — 2026-10-13

- Paths: Studio access module, workspace-handoff tests, and hosted activation rollout documentation.
- Origin: original Hercules repair with AI assistance; no new runtime dependency or packaged third-party code.
- Scope: replace the obsolete raw Edge preview destination with the existing owned hosted Studio URL. Buyer/session checks and protected execution gates are preserved; navigation success does not certify a paid buyer's complete session flow.

## Studio hosted activation relay — 2026-10-13

- Paths: hercules-video/studio-activation.mjs, Studio server routing, hosted activation tests, Studio access callback, and rollout documentation.
- Origin: original Hercules repair with AI assistance; Node built-ins and existing Hercules endpoints only, with no new packaged runtime dependency.
- Scope: render the fixed Studio activation page on the owned host, relay two bounded actions, and use a fixed hosted sign-in callback. Supabase Auth and paid-entitlement checks remain authoritative; no payment, publication, pricing, or Titan gate is changed.

**Status:** Active governance record  
**Effective date:** 2026-09-22  
**Repository:** `Sauceapproved7/expert-doodle`  
**Declared project rights holder:** Sauceapproved7, subject to third-party rights and any later documented assignment.

## Purpose

This file records the minimum ownership, provenance, and canonical-source rules Hercules must carry forward. It is intentionally limited to IP/provenance governance and does not duplicate deployment, control-plane, sentinel, DevBrain, validation, continuity, or operator-runbook procedures.

## Current baseline

Before this file was added, the repository baseline was commit `8f029282acdcf37bc6c79b76cc32a90fbc1975e3` ("Initial commit"), containing `.gitignore`, `README.md`, and `LICENSE`.

The repository `LICENSE` at that baseline is Apache License 2.0.

**This file does not change, revoke, or reinterpret rights already granted under Apache-2.0.** Any future licensing transition must be made by an explicit repository commit and must preserve the historical licensing record.

## Ownership rule

Original Hercules material may be identified as proprietary only when the project has a documented basis to claim or control the applicable rights.

Do not claim ownership of third-party, open-source, externally supplied, or otherwise separately licensed material. Those components remain governed by their own licenses and notices.

If project ownership is later assigned to an LLC, corporation, or other entity, record the transfer separately and update ownership notices prospectively.

### Repository-wide owner-code-only runtime boundary

The owner-code-only boundary applies to the complete canonical Hercules runtime surface, not only Forge. The enforced runtime roots are declared in `governance/owner-code-policy.json` and currently cover Forge, Deploy, Chat, Hercules Base, Model Plane, Training, Video, HURC, observability policy data, operator scripts, and the staging plane.

Within those roots:

- third-party package/runtime module imports are prohibited;
- vendored dependency trees and copied dependency bundles are prohibited;
- committed third-party binaries, archives, model weights, and native libraries are prohibited;
- child-process and shell execution boundaries must be explicitly declared;
- external container images must be pinned and declared;
- external CI actions must be allowlisted;
- runtime source may import only repository-owned runtime source or Node built-ins.

Hercules Base is project-owned control-plane source that orchestrates declared external infrastructure; its ownership claim does not extend to PostgreSQL, PostgREST, Docker, or other separately licensed infrastructure. External infrastructure remains external. Node.js, GitHub Actions, Supabase, Docker, PostgreSQL/PostgREST, FFmpeg/ffprobe, NVIDIA/CUDA tooling, Python, and Wan2.2 are not claimed as Hercules-owned code. Supabase is external infrastructure even when Hercules-owned SQL, Edge Function source, RLS policies, and routing logic run on it. Where used, they must remain behind an explicit boundary recorded in the policy and must not be packaged or represented as SauceApproved-owned source.

The repository-wide verifier is `scripts/verify-owner-code-only.mjs`. Hercules build/test workflows must execute it before subsystem work. A violation is a failed build condition.

This policy does not rewrite historical license grants or convert third-party infrastructure into project-owned intellectual property.

## Canonical-source rules

1. **Shipped source authority:** Source code, configuration, schemas, workflows, and repository documentation intended to define Hercules are canonical only when committed to this GitHub repository and identified by commit SHA.
2. **Default-branch authority:** For the current project state, committed content on `main` is the canonical implementation unless a release tag or explicitly designated commit is being referenced.
3. **Drafts are not implementation:** Chat transcripts, Google Drive documents, vault notes, generated drafts, local files, screenshots, and external workspaces may provide requirements or provenance evidence, but they do not become canonical implementation merely by existing.
4. **Governance versus implementation:** An approved governance record may define what should change; the repository commit records what actually changed. Do not represent an uncommitted governance instruction as implemented code.
5. **Immutable history:** Preserve commit history and release tags as provenance evidence. Do not rewrite history to conceal origin, authorship, licensing, or prior release terms.
6. **Artifact traceability:** Any authoritative build or release must be traceable to the source commit that produced it.

## Provenance rule

Do not merge material code, assets, models, datasets, binaries, media, fonts, vendored files, or other project inputs whose origin or licensing is uncertain.

For every material component added after this baseline, retain enough evidence to answer:

- component or file path
- creation or acquisition date
- repository commit or artifact identifier
- human author or authorized source, when known
- whether AI assistance was used
- third-party source, if any
- applicable license or usage terms
- material modifications made
- approval or merge record
- first release or version containing it

This evidence may live in Git history, pull requests, release records, dependency metadata, third-party notices, or a dedicated provenance ledger; it does not have to be duplicated here when the repository already preserves it reliably.

## Minimum merge gate

Before incorporating a material component:

- origin is known or documented
- contributor/source is authorized to provide it
- third-party licensing is identified and compatible
- required attribution or notices are preserved
- AI assistance, if material to provenance, is recorded
- the resulting change is committed so it can be tied to a SHA

If any of these cannot be established, do not merge the component until the provenance issue is resolved.

## Baseline provenance record

| Item | Baseline identifier | Provenance / rights note |
| --- | --- | --- |
| Repository initial state | `8f029282acdcf37bc6c79b76cc32a90fbc1975e3` | Historical baseline; authorship is not newly asserted by this file. |
| `LICENSE` | blob `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64` | Apache License 2.0 text; remains the repository's current license unless changed by a later explicit commit. |
| `README.md` | blob `b50bd647d852ca148b67666dd8b46d025b192529` | Existing repository content from the initial baseline. |
| `.gitignore` | blob `e5cbb6414259863df3d89124e0c51f73aef6f01c` | Existing repository content from the initial baseline. |

## Governing source for this record

This artifact implements the narrow ownership/provenance/canonical-source portion of the September 22, 2026 governance record `HERCULES_IP_OWNERSHIP_AND_PROVENANCE_CONTROL_20260922`.

Future edits to this file must be committed so the governing rule and its implementation remain traceable.

## Enterprise ownership transition — 2026-09-27

SauceApproved enterprise LLC is the target legal entity for software intended to be held as a company asset. The enterprise intake rule and current asset status are recorded in `governance/sauceapproved-enterprise-software-ownership-v1.json` and `docs/SAUCEAPPROVED-ENTERPRISE-SOFTWARE-IP-REGISTER.md`.

This transition record does **not** itself transfer intellectual property. The current repository declarations that identify `Sauceapproved7` as rights holder remain unchanged until an executed assignment or other legally sufficient chain-of-title record supports the change.

A non-executed assignment draft is maintained at `docs/legal/SAUCEAPPROVED-ENTERPRISE-IP-ASSIGNMENT-DRAFT.md`. Do not treat that draft as proof of transfer and do not commit signatures or sensitive execution material to this public repository.

After execution of a valid assignment, update the declared rights holder, owner-code policy, intentional ownership constants/tests, and applicable notices in a dedicated chain-of-title commit while preserving third-party rights and all prior valid license grants.


## Hercules SmokeScreen Sentinel v1 provenance — 2026-09-28

- Component paths: `hercules-runtime/smokescreen-agent.mjs`, `tests/hercules-smokescreen-agent.test.mjs`, `docs/HERCULES-SMOKESCREEN-SENTINEL-V1.md`, and command-surface integration.
- Origin: project-authored Hercules implementation created for SauceApproved with AI assistance under the repository's existing contribution and ownership controls.
- Runtime dependencies: Node.js built-ins only; no vendored or third-party runtime source added.
- Third-party infrastructure: Node.js and GitHub Actions remain external infrastructure governed by their own terms and are not claimed as SauceApproved-owned code.
- Security scope: defensive detection, deception, throttling, quarantine, session isolation guidance, honeytokens, and evidence capture only inside authorized infrastructure; no hack-back capability.


## Hercules Cleaner v1 provenance — 2026-09-28

- Component paths: `hercules-cleaner/*.mjs`, `tests/hercules-cleaner*.test.mjs`, `docs/HERCULES-CLEANER-V1.md`, command-surface routing, and the dedicated CI workflow.
- Origin: project-authored Hercules implementation created for SauceApproved with AI assistance under the repository's existing contribution and ownership controls.
- Runtime dependencies: Node.js built-ins only. No vendored or third-party runtime source is included.
- External operating-system infrastructure: Windows Task Scheduler, Apple launchd, and systemd user services are adapters only and remain third-party OS infrastructure.
- Safety scope: user-scoped cleanup roots, explicit protected paths, dry-run plans, bounded scans, loopback-only dashboard control, transactional Recovery Capsules, integrity verification, and fail-closed restore semantics.
- Market-research note: scheduled cleanup is common in Windows Storage Sense, CCleaner, BleachBit, Wise Disk Cleaner and CleanMyMac. Session Clean and Recovery Capsules are Hercules differentiators based on the reviewed mainstream feature sets; no absolute market-first claim is made.


## Hercules Cleaner v1.0.0 release packaging provenance — 2026-09-28

- Package paths: `releases/hercules-cleaner-v1.0.0/`, `scripts/package-hercules-cleaner-release.mjs`, `.github/workflows/hercules-cleaner-release-package.yml`, Forge package registration, and release-package tests.
- Origin: original SauceApproved/Hercules packaging implementation created with AI assistance around the canonical Cleaner runtime.
- Runtime/package dependencies: Node.js built-ins plus GitHub Actions infrastructure; no vendored third-party runtime source is added.
- Distribution evidence: exact 40-character source commit identity, per-file SHA-256 hashes, deterministic archive checksum, and GitHub artifact attestation on main pushes.
- Commercial boundary: Early Access package only; checkout remains disabled and candidate pricing remains owner-approval required.

## SauceApproved Content Multiplier v1 provenance — 2026-09-28

- Component paths: `sauceapproved-studio/content-multiplier/*.mjs`, `tests/sauceapproved-content-multiplier.test.mjs`, `docs/HERCULES-CONTENT-MULTIPLIER-V1.md`, and the dedicated CI workflow.
- Origin: project-authored SauceApproved/Hercules implementation created with AI assistance under the repository's existing contribution and ownership controls.
- Runtime dependencies: Node.js built-ins only; no vendored or third-party runtime source added.
- Third-party infrastructure: any future model, social-publishing, analytics, storage or messaging provider remains external infrastructure governed by its own terms and is not claimed as SauceApproved-owned code.
- Trust scope: generation fails closed without an injected provider; locked facts and banned phrases are validated before generated assets are accepted.
- Market-position note: Content DNA, Variation Tree, Content Opportunity Radar and Variant Fatigue Guard are SauceApproved differentiators. No absolute market-first claim is made without separate current verification.


## SauceApproved AI Sales Agent v1 provenance — 2026-09-28

- Component paths: `sauceapproved-studio/ai-sales-agent/*.mjs`, `tests/sauceapproved-ai-sales-agent.test.mjs`, `docs/HERCULES-AI-SALES-AGENT-V1.md`, and the dedicated CI workflow.
- Origin: project-authored SauceApproved/Hercules implementation created with AI assistance under the repository's existing contribution and ownership controls.
- Runtime dependencies: Node.js built-ins only; no vendored or third-party runtime source added.
- Third-party infrastructure: any future CRM, helpdesk, messaging, email, SMS, voice, booking, checkout, model, or analytics provider remains external infrastructure governed by its own terms and is not claimed as SauceApproved-owned code.
- Trust scope: recommendations are grounded in approved active product data; unsupported recommendations fail safely; lead capture is consent-gated; sensitive profiling is excluded from Adaptive Pitch Memory; business actions require explicit allowlisting plus a configured adapter.
- Differentiators: Objection Intelligence Map, Adaptive Pitch Memory, Confidence-to-Handoff Governor, and Objection-to-Asset Bridge. No absolute market-first claim is made without separate current verification.


## Hercules Cleaner catalog integration provenance — 2026-09-28

- Component paths: `supabase/migrations/20260928120000_hercules_cleaner_software_catalog_v1.sql`, `hercules-forge/offers/hercules-cleaner/index.html`, Cleaner commercial-control registration, legal candidate disclosures, and `tests/hercules-forge-cleaner-commerce.test.mjs`.
- Origin: SauceApproved/Hercules-owned catalog and Early Access integration created with AI assistance around the existing Cleaner v1.0.0 runtime and release package.
- External infrastructure: Supabase Data API/database/Edge Functions and browser runtime remain third-party infrastructure; they are not represented as SauceApproved-owned source.
- Commercial boundary: product status is Early Access, candidate pricing remains owner-approval required, and checkout remains disabled. This integration does not approve pricing, Terms, Privacy, provider readiness, or the paid checkout path.
- Privacy boundary: the public access-request surface does not require local file inventory or Recovery Capsule contents; Cleaner filesystem authority remains local to the authorized device.


## SauceApproved Brand Brain v1 provenance — 2026-09-28

- Component paths: `sauceapproved-studio/brand-brain/*.mjs`, `tests/sauceapproved-brand-brain.test.mjs`, `docs/HERCULES-BRAND-BRAIN-V1.md`, and the dedicated CI workflow.
- Origin: project-authored SauceApproved/Hercules implementation created with AI assistance under the repository's existing contribution and ownership controls.
- Runtime dependencies: Node.js built-ins only; no vendored or third-party runtime source added.
- Third-party infrastructure: any future DAM, CMS, design, Figma, website, document, knowledge-base, model, or analytics provider remains external infrastructure governed by its own terms and is not claimed as SauceApproved-owned code.
- Trust scope: approved facts preserve source provenance; locked facts do not auto-overwrite; Constitution conflicts are rejected; fact changes remain review-required; cross-channel simulation never silently rewrites approved facts.
- Differentiators: Brand Constitution, Cross-Channel Consistency Simulator, Rule Blast Radius Preview, and Brand Drift Time Machine. No absolute market-first claim is made without separate current verification.


## SauceApproved Studios Market v1 provenance — 2026-09-28

- Component paths: `sauceapproved-studio/market/*.mjs`, Studio market routing/rendering in `hercules-video/studio-*.mjs`, Studio integration tests, and `docs/SAUCEAPPROVED-STUDIOS-MARKET-V1.md`.
- Origin: project-authored SauceApproved/Hercules implementation created with AI assistance under the repository's existing contribution and ownership controls.
- Runtime dependencies: Node.js built-ins only; no vendored or third-party runtime source added.
- External infrastructure: founding-access CTAs navigate to the existing protected Hercules launch/pilot intake hosted on the existing Supabase project; Supabase is external infrastructure and is not claimed as SauceApproved-owned code.
- Commercial boundary: public discovery and applications are open, while paid checkout remains disabled pending explicit pricing/legal/payment-path gates. No charge or subscription is created by the Market surface.
- Claims boundary: no fabricated testimonial, guaranteed ROI, unverified certification, or falsely connected integration is included.

## SauceApproved Vintage Camera v1 provenance — 2026-09-28

- Component paths: `sauceapproved-studio/vintage-camera/`, Studio route/manifest integration, focused Studio tests, and `docs/SAUCEAPPROVED-VINTAGE-CAMERA-V1.md`.
- Origin: original SauceApproved/Hercules implementation created with AI assistance at the founder's request for an old-school camera experience.
- Runtime dependencies: browser-standard camera/canvas/MediaRecorder APIs and Node.js built-ins; no copied third-party filters, assets, binaries, or vendored runtime source.
- Scope: local-first capture and WebM export where supported; no server upload or unverified AI execution. Split-frame proof and portable look recipe are Hercules differentiators, not claims of global uniqueness.

## SauceApproved Kids Studio v1 provenance — 2026-09-28

- Component paths: `sauceapproved-studio/kids/`, Studio route and manifest integration, focused tests, and `docs/SAUCEAPPROVED-KIDS-STUDIO-V1.md`.
- Origin: original SauceApproved/Hercules implementation created with AI assistance for parent-operated family storytelling.
- Runtime dependencies: browser-standard JavaScript and Node.js built-ins; no copied third-party templates, artwork, binaries, or vendor source.
- Scope: local browser-memory planning and explicit text download. No child account, server upload, public posting, AI media generation, or automatic video linkage. The six planning additions are Hercules differentiators, with no exclusivity claim about competitors.


## Hercules Cleaner device activation v1 provenance — 2026-09-29

- Component paths: `hercules-cleaner/device-identity.mjs`, Cleaner CLI device commands, `supabase/functions/hercules-cleaner-device/index.ts`, `supabase/migrations/20260929122000_hercules_cleaner_device_activation_v1.sql`, and focused device-activation tests.
- Origin: original SauceApproved/Hercules implementation created with AI assistance under the repository's existing ownership/provenance controls.
- Runtime dependencies: Node.js built-ins for local Ed25519 identity and Supabase Edge Functions/Postgres as external infrastructure; no vendored third-party runtime source is added.
- Privacy boundary: activation transmits opaque device identity, platform family, Cleaner version, public key, one-time activation code, and signed challenge proof only. Hostname, hardware identifiers, usernames, filenames, paths, cleanup inventory, Recovery Capsule contents, and the private key are excluded.
- Secret-storage boundary: activation codes and returned device credentials are stored server-side only as SHA-256 hashes; the private key and plaintext device credential remain local to the activated device.
- Commercial boundary: device activation does not approve or enable pricing, checkout, Terms, Privacy, payment-provider readiness, or paid-path verification.


## SauceApproved Studio completion pass v1 provenance — 2026-09-30

- Component paths: `hercules-video/studio-server.mjs`, `hercules-video/studio-commercial.mjs`, `sauceapproved-studio/{scene-forge,sound-world,actor-lab,integrations,completion}/`, `tests/hercules-video-studio-completion.test.mjs`, and `docs/SAUCEAPPROVED-STUDIO-COMPLETION-PASS-V1.md`.
- Origin: project-authored SauceApproved/Hercules implementation created with AI assistance from the founder-directed Studio completeness audit.
- Runtime dependencies: repository-owned runtime modules and Node.js platform facilities only; no vendored third-party runtime source, model weights, binaries, fonts, copied UI assets, or credentials were added.
- External services remain external: deployment, commerce, identity, model, and publishing providers are represented as authorization-sensitive integration classes and are not claimed as SauceApproved-owned technology.
- Trust scope: hidden owned modules are promoted to customer-facing routes without weakening consent, likeness, execution, provider, physical-device, payment, or publication gates.
- Evidence scope: Vintage Camera physical-device/full-quality export proof and post-first-real-order payment observation remain explicitly unverified until real evidence exists.


## Hercules Vault-backed Deploy Broker v1 provenance — 2026-10-04

- Component paths: `supabase/functions/hercules-deploy-broker/index.ts`, `supabase/migrations/20261004111500_hercules_deploy_vault_broker_v1.sql`, `tests/hercules-deploy-vault-broker.test.mjs`, and `docs/HERCULES-DEPLOY-PLANE-V0.1.md`.
- Origin: original SauceApproved/Hercules implementation created with AI assistance under the repository's existing implementation-enforcement and ownership controls.
- Runtime dependencies: Supabase Edge Functions/Postgres/Vault and the Render HTTPS API are external infrastructure; no provider SDK, vendored runtime source, binary, model weight, credential, or copied third-party code is packaged.
- Secret boundary: the Hercules-owned broker control key is generated server-side inside Supabase Vault; the external Render credential remains owner-authorized and server-side in Vault. Neither secret enters deployment request bodies, persisted deploy evidence, GitHub source, or broker responses.
- Verification boundary: successful deployment evidence requires exact-commit `live` status plus Hercules `/health` and protected unauthenticated `/mcp` behavior.
- Differentiators: Vault-isolated provider custody and evidence-bound exact-commit deployment verification. These are Hercules differentiators, not claims that competitors lack equivalent capabilities.

## Hercules security registry reader v1 provenance — 2026-10-04

- Component paths: `hercules-runtime/security-registry/`, Forge operator API integration, reader/API tests, documentation, and CI workflow.
- Origin: original Hercules implementation created with AI assistance; reused the previously validated Hercules Registry Reader v1.0.0 and normalized security registry v1.3.3 metadata.
- Dependencies: Node.js built-ins and existing repository-owned modules only; no vendored dependencies, third-party executable code, archives, exploit artifacts, or malware samples.
- Metadata provenance: source names, public URLs, original Hercules classifications, and verification observations; third-party documents and datasets are not copied or claimed as project-owned content.
- Boundary: authenticated, checksum-gated local catalog search only; no remote retrieval, source mutation, execution, or authority expansion. Production connection requires separate exact-commit deployment evidence.

## Hercules Binary Inspector v1 provenance — 2026-10-04

- Component paths: `hercules-binary-inspector/*.mjs`, `hercules-binary-inspector/*.md`, `tests/hercules-binary-inspector.test.mjs`, and the dedicated CI workflow.
- Origin: project-authored Hercules defensive static-analysis implementation forward-ported from stale PR #741 and hardened with AI assistance under the repository contribution controls.
- Runtime dependencies: Node.js built-ins only; no vendored binaries, disassemblers, model weights, third-party plugins, or external runtime packages are included.
- Security scope: explicit authorization input, bounded in-memory static inspection, deterministic SHA-256 evidence, bounded printable-string extraction, and explicit no-execution/no-mutation reporting.
- IDA is documented only as an optional future adapter boundary. IDA and any third-party plugin/runtime remain external and are not claimed as SauceApproved-owned code.


## Smallz password access v1 provenance — 2026-10-12

- Paths: hercules-bot/index.html, Smallz access/runtime tests, docs/SMALLZ-PASSWORD-ACCESS-V1.md.
- Origin: original project-authored implementation with AI assistance.
- Dependencies: existing externally hosted Supabase Auth client; no new packaged runtime dependency.
- Scope: existing-account password sign-in and credential cleanup; server owner, external-stop, provider, and launch authority boundaries remain in force.

## Spaceship OAuth discovery compatibility — 2026-10-12

- Paths: private-bridge/spaceship-mcp.ts and focused discovery tests.
- Original Hercules integration repair with AI assistance; no new runtime dependency.
- Exact trusted registration endpoint updated to the currently advertised Spaceship issuer endpoint. Issuer, authorization, token, and registration validation remain fixed and fail closed. Existing Vault credential custody, PKCE, owner consent, and DNS authorization remain enforced.

## Smallz secure setup rendering — 2026-10-12

- Paths: hercules-bot/credential-setup.mjs, Smallz server route, focused tests, and setup documentation.
- Origin: original Hercules code created with AI assistance. Node built-ins and the existing private bridge are used; no new packaged dependency.
- Scope: render the existing expiring credential-drop form on the owned Smallz host, forwarding only bounded key/secret fields to a fixed Hercules backend. Provider validation, Vault storage, and DNS authorization remain enforced by that backend.

## Smallz permanent access page — 2026-10-12

- Paths: hercules-bot/launch.html, /launch route, focused route test and documentation.
- Origin: original project-authored page with AI assistance; Node/browser built-ins only. The existing product photo is loaded from the user's Shopify CDN, not packaged as software or claimed as new original media.
- Scope: a script-free public navigation page linking the current Shopify storefront, authenticated Smallz console, and Studio. It adds no payment flow, registrar authority, release approval, or new service.

## Titan hosted delivery continuity — 2026-10-13

- Paths: Studio activation relay/server, Hercules Studio/Titan access modules, focused tests, and delivery documentation.
- Original project-authored repair with AI assistance; Node/browser built-ins and existing externally hosted Supabase client only. No packaged third-party code.
- Reuses the canonical Hercules workspace and existing product-isolated claim RPCs. Auth, tenant, public-registration, commercial, payment, and legal controls remain authoritative in their existing backends.
