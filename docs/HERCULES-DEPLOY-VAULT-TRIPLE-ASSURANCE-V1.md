# Hercules Vault Triple Assurance v1

**Origin:** User-owned Hercules Secret Knowledge / 2026-10-13_Code_Codex_Cyber_Three_Deep_Dives research collection. It recommends separating observation, verification, authorization, execution and runtime proof. This translates those recommendations into **advisory, first-party Node.js code**, not a public launch or new security credential.

## 1. Release Passport

Function: assessReleasePassport({intent,ci,provider,runtime}).

Cross-checks full 40-character Git commit, artifact SHA-256, live provider record, owner-authenticated runtime-reported commit and last-known-good rollback commit. Requires one success each from tests, security and provenance CI checks. Missing or inconsistent evidence yields HOLD.

For every submitted CI check, the Passport now requires a unique, bounded name, exactly the expected two fields, and status success. Any additional failed, skipped, pending, cancelled, duplicated, missing, oversized or malformed check causes HOLD; required green checks cannot hide a separate red check.

The Passport verifier also checks its exact output schema and fail-closed semantics **before** checking its checksum. A recalculated digest cannot turn releaseApproved, executionAuthority, ownerAuthorizationVerified or similar reserved flags on while returning a valid Passport. This is structural/semantic validation, not third-party signer authentication.

A positive result is EVIDENCE_CONSISTENT_UNATTESTED, **not** RELEASE_APPROVED. The integrity checksum detects changes to the normalized record but **is not a signature**: anyone who can rewrite it can recalculate the SHA-256. The tool never authenticates a source's identity or grants production permissions.

## 2. Agent Authority Firewall

Function: assessAgentAuthority(input).

Composes the existing Hercules Authority Lease policy evaluator with a fixed list of low-privilege agent actions and a separate source-origin check. Repository text, web content, Vault documents, tool responses and model output are **untrusted data, never owner authority**. Even a matching, in-scope lease returns POLICY_CONSISTENT_NO_EXECUTION, never deploy permissions.

Release approval, execution or rollback, charging customers, credential reads, identity grants, billing changes and policy updates remain OWNER_ACTION_REQUIRED. A model cannot impersonate an owner role. The trusted_operator_boundary origin string is itself a **caller assertion** and must be validated by the real upstream authentication system: this module does not authenticate owners or leases.

## 3. Offline Recovery and Adversarial Lab

Function: runVaultAdversarialLab().

Runs eight fixed, in-memory scenarios: valid but unauthenticated record, forged CI check set, provider commit swap, runtime commit swap, Vault prompt injection, expired agent lease, unauthorized rollback, and one valid bounded read/test decision. No network, shell, API, hardware, provider credentials, browser actions, payment, database writes, deployments or rollbacks are performed.

## Testing

    node --test tests/hercules-deploy-vault-assurance.test.mjs
    node --test tests/hercules-deploy*.test.mjs
    node scripts/verify-hercules-execution-contract.mjs
    node scripts/verify-owner-code-only.mjs
    node scripts/security-baseline.mjs

The existing Hercules Deploy Plane CI already runs every tests/hercules-deploy*.test.mjs on pull requests and therefore covers this implementation. This feature does not add live probes.

## Trust boundary and limitations

- The source/provider/runtime/CI inputs are untrusted claims until fetched and authenticated from independent authorized connections.
- Matching a commit does not prove the artifact was reproducibly built, the signer was trustworthy, the service is healthy, customers can use it or owner approval happened.
- Deterministic SHA-256 checksums are integrity evidence, not cryptographic attestation or independent provenance.
- The lab is a policy regression exercise, not an external penetration test, physical-host or firmware scan, or production rollback rehearsal.
- Do not supply decrypted Vault secrets, private headers, customer data, financial information or credential error messages to these checks.
- These functions do not execute, grant privileges, call providers, change hosting plans or modify commercial services.

First-party SauceApproved Node built-ins; no added dependencies or subscriptions.