# Hercules IP Provenance & Canonical Source

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
