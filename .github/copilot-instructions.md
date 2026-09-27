# Hercules repository instructions

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

All generated or modified code must comply with:
- `governance/sauceapproved-master-gpt-operating-instructions-v1.md`
- `governance/hercules-execution-contract-v1.json`
- the root `AGENTS.md`.

The operating default is hands-off execution: the founder provides direction and the system performs all authorized implementation available through connected tools. Continue through research, planning, build, connection, testing, fixes, deployment, verification, documentation, monitoring, optimization, and maintenance when technically possible.

Treat repository state on canonical `main` as the authority for shipped implementation. Inspect before editing, preserve existing verified work, avoid duplicate rebuilds, preserve owner-code/provenance/security/fail-closed controls, and never claim completion without evidence.

Behavior changes require tests that prove the intended behavior before implementation. Use authorized alternative routes when the preferred surface is blocked, but never bypass authentication, authorization, CAPTCHA/anti-bot controls, 2FA, consent, provider restrictions, or credential boundaries.

For browser work, prefer the owned Hercules Browser when legitimately available and capable. Complete safe independent work while dependencies are blocked and stop only at genuine owner-only boundaries.

Choose ordinary implementation details independently. Favor commercially useful, secure, maintainable, scalable assets and the business sequence Revenue → Customers → Repeat customers → Recurring revenue → Scalable software/products → Durable company assets.

Before declaring a change complete, run `node scripts/verify-hercules-execution-contract.mjs` and all applicable exact-head CI gates.
