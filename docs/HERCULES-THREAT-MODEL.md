# Hercules Threat Model

Status: security hardening baseline
Date: 2026-09-24

## Assets

Hercules must protect:

- canonical source and release provenance;
- Forge control credentials, sessions, customer workspace authorization and runtime data;
- HURC signing keys and testnet transaction authority;
- model/training checkpoints, activation evidence and datasets;
- video execution artifacts and external-process boundaries;
- audit history, backups and recovery evidence.

## Trust boundaries

1. **Browser/customer -> Forge**: untrusted HTTP input crosses authentication, CSRF, role and schema boundaries.
2. **Forge -> interpreter/model plane**: remote interpreters are external services even when Hercules-controlled.
3. **Forge preview -> host**: preview processes are controlled child processes, not a hardened sandbox for arbitrary hostile server code.
4. **HURC signer -> Vault/database/RPC**: signing authority is high impact; testnet-only restrictions are mandatory.
5. **Training/video -> external runtime**: Python, Wan2.2, FFmpeg, CUDA and other external infrastructure remain outside the owned-core trust boundary.
6. **CI -> repository/release artifacts**: workflow permissions, action pinning and provenance determine supply-chain trust.
7. **Staging -> production**: isolated fixture evidence must never be represented as production operating history.
8. **Forge -> notification transport**: invite/recovery delivery is an external service boundary; one-time lifecycle links are the only credential material intentionally sent to that provider.
9. **Forge -> deployment transport**: verified artifact bundles may cross into replaceable hosting infrastructure, but canonical source, revision, artifact, release, and rollback state remain inside Hercules.

## Primary threats and required controls

### Authentication and session compromise
Controls: memory-hard salted password hashing with explicit parameters, secure HttpOnly cookies, SameSite=Strict, CSRF tokens, login throttling, constant-time secret comparison, bounded sessions, audit events, hashed one-time invite/recovery tokens, generic recovery responses, recovery throttling, and revocation of existing sessions after password recovery.

### Broken tenant authorization
Controls: server-side workspace membership checks, role allowlists, project/workspace binding, no trust in client-supplied ownership.

### Secret disclosure
Controls: no committed secrets, no secret-shaped audit fields, Vault custody for signer keys, no private-key return paths, no logging of bearer tokens, lifecycle tokens stored only by hash, and invite/recovery tokens carried in URL fragments so they are not sent in the initial HTTP request or referrer.

### Remote-code and process escape
Controls: generated-template constraints, restrictive preview environment, bounded request bodies, explicit child-process allowlist. Hercules does not claim hardened arbitrary-code sandboxing.

### Supply-chain compromise
Controls: SHA-pinned GitHub Actions, compiler checksum verification, owner-code verifier, provenance attestation checklist, immutable commit history, deterministic runtime-source packaging, SPDX SBOM generation, and GitHub-signed release attestations for tagged/manual release-evidence runs. Remote deployment accepts only a previously verified Forge artifact bundle, uses bounded transfer, disables redirects, and keeps the local release ledger authoritative. An attestation is evidence only after the release workflow succeeds for the exact release commit.

### Cryptographic implementation defects
Controls: Base Sepolia-only signer boundary, known-answer tests, low-s signatures, deterministic nonces, no mainnet authorization. Independent cryptographic review and differential/fuzz testing are required before real-value use.

### Availability/resource exhaustion
Controls: request-size limits, login throttling, recovery-request throttling, runtime-data quotas, bounded deployment bundle/response sizes, bounded benchmark targets, recovery drills. Broader per-route abuse controls and production capacity evidence remain incomplete.

### Audit tampering
Controls: hash-chained audit events and retained head checkpoint. This is tamper-evident application storage, not an independent hardware/external trust anchor.

## Explicit non-claims

Current Hercules evidence does not establish:

- independently audited cryptography;
- hardened sandboxing of arbitrary hostile code;
- multi-region production failover;
- continuous production SLO attainment;
- external penetration-test assurance;
- proof that every historical release has a signed SBOM/provenance attestation; the current release-evidence workflow establishes this control for releases that pass through it;
- multi-factor authentication or externally anchored lifecycle-token issuance/revocation evidence.

These non-claims are security boundaries, not documentation omissions.
