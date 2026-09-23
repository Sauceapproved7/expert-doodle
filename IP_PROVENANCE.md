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

The owner-code-only boundary applies to the complete canonical Hercules runtime surface, not only Forge. The enforced runtime roots are declared in `governance/owner-code-policy.json` and currently cover Forge, Model Plane, Training, Video, observability policy data, operator scripts, and the staging plane.

Within those roots:

- third-party package/runtime module imports are prohibited;
- vendored dependency trees and copied dependency bundles are prohibited;
- committed third-party binaries, archives, model weights, and native libraries are prohibited;
- child-process and shell execution boundaries must be explicitly declared;
- external container images must be pinned and declared;
- external CI actions must be allowlisted;
- runtime source may import only repository-owned runtime source or Node built-ins.

External infrastructure remains external. Node.js, GitHub Actions, Docker, PostgreSQL/PostgREST, FFmpeg/ffprobe, NVIDIA/CUDA tooling, Python, and Wan2.2 are not claimed as Hercules-owned code. Where used, they must remain behind an explicit boundary recorded in the policy and must not be packaged or represented as SauceApproved-owned source.

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
