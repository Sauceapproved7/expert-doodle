# Hercules Cleaner v1.1.0 — Install

## Requirements

- Windows one-click setup: Node.js 22 or newer.
- Windows, macOS, or Linux user account.
- Permission to read/write only cleanup paths the user authorizes.

No package-manager dependency is required by the Cleaner runtime.

## Windows one-click setup

1. Use the exact-commit Hercules Cleaner v1.1.0 release artifact.
2. Keep the extracted package together so `cleaner-release-manifest.json`, `HerculesCleaner-Setup.cmd`, and `hercules-cleaner/` remain in the same package root.
3. Double-click `HerculesCleaner-Setup.cmd`, or run:

```bat
HerculesCleaner-Setup.cmd install
```

The setup is **user-scoped**. It installs a versioned app copy below `%LOCALAPPDATA%\SauceApproved\Hercules Cleaner\`, creates a user launcher, and does not bypass UAC or operating-system permissions.

Before activation, setup verifies the immutable package identity, the exact source commit recorded by the package build, the aggregate SHA-256, every packaged file hash, and the Early Access / checkout-disabled commercial posture.

Existing local state is preserved at:

```text
~/.hercules-cleaner/
```

That includes configuration, sessions, runtime state, and Recovery Capsules.

## Verified update

Run a newer exact-commit package:

```bat
HerculesCleaner-Setup.cmd update
```

A candidate must be a newer semantic version and match its immutable commit and aggregate package digest. Same-version replacement, downgrade, digest mismatch, mutable source identity, and checkout-enabled packages fail closed.

The previous installed version is retained as the rollback target.

## Rollback

```bat
HerculesCleaner-Setup.cmd rollback
```

Rollback switches the launcher to the retained prior version without deleting Cleaner state or Recovery Capsules.

## Uninstall

```bat
HerculesCleaner-Setup.cmd uninstall
```

Uninstall removes the user-scoped installed app and startup integration. It deliberately **does not delete** `~/.hercules-cleaner/`. State removal, if ever desired, is a separate explicit user action.

## macOS and Linux

The v1.1.0 one-click wrapper is Windows-only. macOS and Linux continue to use the canonical Node.js CLI and existing user-level LaunchAgent/systemd adapters.

A scan is non-destructive. Apply-mode cleanup routes approved files through Recovery Capsules.
