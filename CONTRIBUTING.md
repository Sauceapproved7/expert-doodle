# Contributing to Hercules

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

The canonical repository is the implementation authority. Chats, Drive documents, vault notes, screenshots, and external workspaces are requirements or evidence until committed here.

Every contributor and automation must load and obey `governance/sauceapproved-master-gpt-operating-instructions-v1.md`, `governance/hercules-execution-contract-v1.json`, and the root `AGENTS.md` before making changes.

## Change requirements

Every change must:

1. inspect and preserve the current canonical state instead of rebuilding equivalent work;
2. follow the hands-off execution default and complete authorized implementation rather than pushing routine execution to the founder;
3. preserve the owner-code boundary;
4. avoid committing secrets, private keys, model weights, archives, or vendor dependency trees;
5. establish tests for behavior changes before implementation, then keep those tests green;
6. preserve provenance and third-party licensing information;
7. keep staging, customer, and production data boundaries intact;
8. avoid weakening fail-closed controls merely to make a test pass;
9. use legitimate already-authorized alternative routes when appropriate without bypassing authentication, authorization, CAPTCHA/anti-bot protections, 2FA, consent, provider restrictions, or credential boundaries;
10. complete all safe independent work before stopping at an owner-only boundary;
11. require current evidence before claiming implemented, complete, merged, deployed, healthy, connected, or fixed;
12. use Hercules Browser first for supported browser work when it is available and authorized, and document fallback reasons;
13. preserve continuity with verified prior work across sessions and avoid unnecessary rebuilds;
14. favor commercially useful, secure, scalable, maintainable assets and the business priority encoded by the master operating instructions;
15. use a reviewable pull request whenever repository permissions allow.

## Before merge

Run the applicable Node test suites plus:

```sh
node --test tests/hercules-implementation-enforcement.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

The implementation-enforcement verifier is mandatory. A verifier failure is a merge blocker, not an advisory warning.

Security-sensitive changes should also pass CodeQL and update `docs/HERCULES-THREAT-MODEL.md` when they introduce a new trust boundary.

## High-risk changes

Authentication, authorization, cryptography, signing/key custody, arbitrary-code execution, production networking, destructive migrations, and release-signing changes require evidence beyond a single happy-path test.
