# Hercules repository instructions

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

All generated or modified code must comply with `governance/hercules-execution-contract-v1.json` and the root `AGENTS.md`.

Treat repository state on canonical `main` as the authority for shipped implementation. Inspect before editing, preserve existing verified work, avoid duplicate rebuilds, preserve owner-code/provenance/security/fail-closed controls, and never claim completion without evidence.

Behavior changes require tests that prove the intended behavior before implementation. Use authorized alternative routes when the preferred surface is blocked, but never bypass authentication, authorization, CAPTCHA/anti-bot controls, 2FA, consent, provider restrictions, or credential boundaries.

For browser work, prefer the owned Hercules Browser when legitimately available and capable. Stop only at genuine owner-only boundaries after all safe work is complete.

Before declaring a change complete, run `node scripts/verify-hercules-execution-contract.mjs` and all applicable exact-head CI gates.
