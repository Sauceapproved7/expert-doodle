# Contributing to Hercules

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

The canonical repository is the implementation authority. Chats, Drive documents, vault notes, screenshots, and external workspaces are requirements or evidence until committed here.

Every contributor and automation must load and obey `governance/hercules-execution-contract-v1.json` and the root `AGENTS.md` before making changes.

## Change requirements

Every change must:

1. inspect and preserve the current canonical state instead of rebuilding equivalent work;
2. preserve the owner-code boundary;
3. avoid committing secrets, private keys, model weights, archives, or vendor dependency trees;
4. establish tests for behavior changes before implementation, then keep those tests green;
5. preserve provenance and third-party licensing information;
6. keep staging, customer, and production data boundaries intact;
7. avoid weakening fail-closed controls merely to make a test pass;
8. use legitimate already-authorized alternative routes when appropriate without bypassing authentication, authorization, CAPTCHA/anti-bot protections, 2FA, consent, provider restrictions, or credential boundaries;
9. require current evidence before claiming implemented, complete, merged, deployed, healthy, connected, or fixed;
10. use a reviewable pull request whenever repository permissions allow.

## Before merge

Run the applicable Node test suites plus:

```sh
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

The implementation-enforcement verifier is mandatory. A verifier failure is a merge blocker, not an advisory warning.

Security-sensitive changes should also pass CodeQL and update `docs/HERCULES-THREAT-MODEL.md` when they introduce a new trust boundary.

## High-risk changes

Authentication, authorization, cryptography, signing/key custody, arbitrary-code execution, production networking, destructive migrations, and release-signing changes require evidence beyond a single happy-path test.
