# Contributing to Hercules

The canonical repository is the implementation authority. Chats, Drive documents, vault notes, screenshots, and external workspaces are requirements or evidence until committed here.

## Change requirements

Every change should:

1. preserve the owner-code boundary;
2. avoid committing secrets, private keys, model weights, archives, or vendor dependency trees;
3. add or update tests for behavior changes;
4. preserve provenance and third-party licensing information;
5. keep staging, customer, and production data boundaries intact;
6. avoid weakening fail-closed controls merely to make a test pass;
7. use a reviewable pull request whenever repository permissions allow.

## Before merge

Run the applicable Node test suites plus:

```sh
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

Security-sensitive changes should also pass CodeQL and update `docs/HERCULES-THREAT-MODEL.md` when they introduce a new trust boundary.

## High-risk changes

Authentication, authorization, cryptography, signing/key custody, arbitrary-code execution, production networking, destructive migrations, and release-signing changes require evidence beyond a single happy-path test.
