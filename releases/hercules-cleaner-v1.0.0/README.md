# Hercules Cleaner v1.0.0

**Release class:** Early Access  
**Runtime:** local-first Node.js agent  
**Supported operating systems:** Windows, macOS, Linux  
**Checkout:** disabled pending owner-approved commercial gates

Hercules Cleaner is a recoverable computer-maintenance agent. It cleans only policy-approved temporary/cache targets and keeps destructive behavior fail-closed.

## Core capabilities

- manual `scan` and `clean`;
- daily, weekly, every-N-days and low-storage schedules;
- native user-level startup adapters;
- localhost-only control dashboard;
- protected-path enforcement and bounded scans;
- cleanup receipts and recovery history.

## Hercules differentiators

### Session Clean
Track a work session, compare approved cleanup roots before/after, and target only disposable files created or changed during that session.

### Recovery Capsules
Apply-mode cleanup moves approved files into a SHA-256-verified recovery capsule before later purge. Restore refuses overwrites and fails closed on integrity mismatch.

## Commercial state

The Forge package may model Starter / Pro / Agency candidate plans, but pricing remains `owner_approval_required`. No checkout is enabled by this release package.

## Canonical source

- `hercules-cleaner/`
- `docs/HERCULES-CLEANER-V1.md`
- `tests/hercules-cleaner*.test.mjs`

## Verification

```sh
node --test tests/hercules-cleaner.test.mjs tests/hercules-cleaner-agent.test.mjs tests/hercules-cleaner-command.test.mjs tests/hercules-cleaner-release-package.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```

See `INSTALL.md`, `SECURITY.md`, and `RELEASE-NOTES.md`.
