# Hercules Cleaner v1.1.0

**Release class:** Early Access  
**Runtime:** local-first Node.js agent  
**Supported operating systems:** Windows, macOS, Linux  
**Windows setup:** user-scoped one-click entrypoint  
**Checkout:** disabled pending owner-approved commercial gates

Hercules Cleaner is recoverable computer maintenance. It cleans only policy-approved temporary/cache targets and keeps destructive behavior fail-closed.

## Core capabilities

- manual scan and clean;
- daily, weekly, every-N-days and low-storage schedules;
- native user-level startup adapters;
- localhost-only control dashboard;
- protected-path enforcement and bounded scans;
- cleanup receipts and recovery history.

## Hercules differentiators

### Session Clean
Track a work session, compare approved cleanup roots before/after, and target only disposable files created or changed during that session.

### Recovery Capsules
Apply-mode cleanup moves approved files into a SHA-256-verified Recovery Capsule before later purge. Restore refuses overwrites and fails closed on integrity mismatch.

## Windows distribution

v1.1.0 adds `HerculesCleaner-Setup.cmd`. It verifies the exact packaged release identity and per-file hashes before installing a versioned copy under the current user's `%LOCALAPPDATA%`. It does not request administrator elevation.

Updates retain the prior installed version as an explicit rollback target. Uninstall removes the installed app integration but leaves `~/.hercules-cleaner/`, including Recovery Capsules, untouched.

The setup requires Node.js 22+. Node.js is external infrastructure and is not bundled or represented as SauceApproved-owned code.

## Commercial state

Pricing remains `owner_approval_required`. No checkout is enabled by this release package.

## Canonical source

- `hercules-cleaner/`
- `HerculesCleaner-Setup.cmd`
- `docs/HERCULES-CLEANER-V1.md`
- `tests/hercules-cleaner*.test.mjs`

See `INSTALL.md`, `SECURITY.md`, and `RELEASE-NOTES.md`.
