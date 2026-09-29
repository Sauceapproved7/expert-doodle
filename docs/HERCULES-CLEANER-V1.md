# Hercules Cleaner v1

Status: implementation candidate  
Runtime: `hercules-cleaner/`  
Control surface: localhost-only dashboard + CLI  
Primary platforms: Windows, macOS, Linux (Node.js runtime)

## Purpose

Hercules Cleaner is a local-first computer maintenance agent for repeatable cleanup without blind deletion. It supports manual cleanup, daily/weekly/every-N-days schedules, low-storage triggers, and session-aware cleanup after a tracked work session.

The default policy targets user-scoped temporary and cache locations while protecting personal-document and credential directories.

## Hercules differentiators

### Session Clean

A work session begins with a bounded metadata snapshot of approved cleanup roots. When the session ends, Hercules compares the before/after state and considers only files created or changed during that session. Standard policy still applies: the file must be inside an approved root, outside protected paths, and disposable by the selected profile.

This is designed for workflows such as development, rendering, editing, and other work that creates large temporary artifacts.

### Recovery Capsules

Apply-mode cleanup does not immediately destroy selected files. Hercules creates a per-run Recovery Capsule under the local recovery vault, moves approved files into it, stores a SHA-256 manifest, seals the capsule, and retains it for the profile retention window.

Restore is fail-closed:
- every stored file must match its recorded hash;
- stored paths must stay inside the capsule;
- Hercules refuses to overwrite a path that has been repopulated;
- a cleanup that fails partway rolls moved files back.

These are Hercules product differentiators. They are not represented as verified global market-first capabilities.

## Safety model

Hercules Cleaner:
- follows explicit cleanup roots only;
- protects Documents, Desktop, Pictures, Videos, Music, `.ssh`, and `.gnupg` by default;
- does not follow symbolic links;
- bounds scan depth and file count;
- re-validates file metadata immediately before moving a cleanup candidate;
- serializes cleanup/restore operations with a local lock;
- uses a recovery vault before purge;
- binds its dashboard only to loopback;
- requires a high-entropy local control token for API actions;
- blocks foreign browser origins;
- keeps configuration, runtime state, sessions, and recovery data local.

The cleaner does not bypass operating-system permissions. Files that the current user cannot access remain outside its authority.

## Default profiles

### Quick Safe
General temporary/cache cleanup. Default cadence: weekly.

### After Work
Session Clean profile. Runs only when a tracked session is explicitly stopped.

### Low Storage Guard
Runs when free disk space at the configured cleanup root drops below the threshold.

## Commands

```sh
node hercules-cleaner/cli.mjs status
node hercules-cleaner/cli.mjs scan
node hercules-cleaner/cli.mjs clean
node hercules-cleaner/cli.mjs "clean my computer"
node hercules-cleaner/cli.mjs dashboard

node hercules-cleaner/cli.mjs schedule --profile quick-safe --type daily
node hercules-cleaner/cli.mjs schedule --profile quick-safe --type everyNDays --days 2
node hercules-cleaner/cli.mjs schedule --profile quick-safe --type weekly

node hercules-cleaner/cli.mjs session-start --label "Work Session"
node hercules-cleaner/cli.mjs session-stop --id <session-id>

node hercules-cleaner/cli.mjs capsules
node hercules-cleaner/cli.mjs restore --id <capsule-id>

node hercules-cleaner/cli.mjs install-autostart
node hercules-cleaner/cli.mjs uninstall-autostart
```

## Native automation adapters

- Windows: user logon task through Windows Task Scheduler.
- macOS: per-user LaunchAgent.
- Linux: systemd user service with `NoNewPrivileges`, `PrivateTmp`, strict system protection, and kernel/control-group hardening while retaining user-home access required for user-approved cache cleanup.

The scheduler/launch systems are operating-system infrastructure and are not SauceApproved-owned code.

## State

Default local state directory:

```text
~/.hercules-cleaner/
  config.json
  runtime.json
  cleaner.lock
  sessions/
  recovery-vault/
```

## Verification

Focused suite:

```sh
node --test tests/hercules-cleaner.test.mjs tests/hercules-cleaner-agent.test.mjs tests/hercules-cleaner-command.test.mjs
```

Repository gates:

```sh
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```

Reviewable pull requests also carry the repository provenance-attestation checklist so origin, licensing, third-party notices, AI assistance, and owner-code scope are explicit evidence rather than implicit assumptions.

## Current non-claims

v1 does not claim:
- kernel-level cleaning;
- malware removal or antivirus protection;
- registry optimization;
- secure forensic erasure;
- autonomous deletion of arbitrary personal folders;
- a bundled third-party Node.js runtime;
- silent background self-updates;
- installation on a customer device without that device user's explicit action and operating-system permissions.

The design favors recoverability and explicit policy over aggressive deletion.


## Early Access catalog

Hercules Cleaner is registered for SauceApproved Early Access discovery through the owned software-catalog path. The public catalog/request surface handles ordinary access-request information only; it does not require the customer's local file inventory or Recovery Capsule contents.

Commercial state remains fail-closed: candidate pricing is not approved, Terms and Privacy remain owner-decision gated, payment-provider readiness is separate, paid-path verification is separate, and checkout stays disabled until those controls are explicitly satisfied.

The catalog record intentionally carries no live product URL until an actual customer-facing Cleaner delivery endpoint is deployed and verified.


## Update and rollback certification

Cleaner updates are fail-closed against immutable release identity. An update candidate must carry an exact 40-character canonical commit SHA and 64-character aggregate package SHA-256 that match the expected release identity. Mutable refs such as `main`, digest mismatches, malformed versions, same-version replacement, and downgrades are rejected.

The update policy cannot enable checkout or change the release out of Early Access. A verified update retains the currently installed version as the explicit rollback version. Recovery Capsule data and local Cleaner state are not update payloads and must not be deleted or migrated implicitly by update eligibility checks.

This v1 certification defines update eligibility and rollback identity. Cleaner v1.1.0 adds an explicit, user-invoked Windows setup entrypoint that installs a versioned copy under the current user's local application data, verifies the exact package identity and per-file hashes, preserves `~/.hercules-cleaner/` including Recovery Capsules, retains the prior version for rollback, and removes only app integration on uninstall. It still requires Node.js 22+ and does not claim a bundled native runtime or silent auto-update. Installation or replacement on a customer device remains subject to that device user's explicit action and operating-system permissions.


## Windows one-click distribution — v1.1.0

The exact-commit Early Access package now includes `HerculesCleaner-Setup.cmd` and the owned `hercules-cleaner/windows-installer*.mjs` implementation.

The Windows distribution path is deliberately user-scoped and fail-closed:
- install root is below `%LOCALAPPDATA%\SauceApproved\Hercules Cleaner\app\<version>`;
- Cleaner state remains under `~/.hercules-cleaner/` and is not an install/update payload;
- activation requires the separate generated exact-commit `cleaner-release-trust.json` lock to match package version, source commit, and aggregate SHA-256, followed by verification of every manifest-listed file hash;
- same-version replacement, downgrade, malformed identity, digest mismatch, commercial-gate drift, and tampering are rejected;
- the previous version is retained as the rollback target and its recorded identity plus manifest-listed files are re-verified before rollback activation;
- uninstall removes startup integration first and aborts app deletion if that cleanup cannot be confirmed; Recovery Capsules and local state are not silently deleted;
- no administrator/elevation control is bypassed.

Paid checkout remains a separate owner-controlled launch gate and is not enabled by installer availability.
