# Hercules Cleaner v1.0.0 — Install

## Requirements

- Node.js 22 or newer.
- A Windows, macOS, or Linux user account.
- Permission to read/write only the cleanup paths the user authorizes.

No package-manager dependency is required by the Cleaner runtime.

## Start from the canonical repository

```sh
node hercules-cleaner/cli.mjs status
node hercules-cleaner/cli.mjs scan
node hercules-cleaner/cli.mjs dashboard
```

A scan is non-destructive. Apply-mode cleanup routes approved files through Recovery Capsules.

## Enable user-level automation

```sh
node hercules-cleaner/cli.mjs install-autostart
```

This uses:
- Windows Task Scheduler at user logon;
- a macOS LaunchAgent;
- a Linux systemd user service.

The installer does not bypass operating-system permission or elevation boundaries.

## Configure cadence

```sh
node hercules-cleaner/cli.mjs schedule --profile quick-safe --type daily
node hercules-cleaner/cli.mjs schedule --profile quick-safe --type everyNDays --days 2
node hercules-cleaner/cli.mjs schedule --profile quick-safe --type weekly
```

## Session Clean

```sh
node hercules-cleaner/cli.mjs session-start --label "Work Session"
node hercules-cleaner/cli.mjs session-stop --id <session-id>
```

## Restore

```sh
node hercules-cleaner/cli.mjs capsules
node hercules-cleaner/cli.mjs restore --id <capsule-id>
```

## Uninstall startup automation

```sh
node hercules-cleaner/cli.mjs uninstall-autostart
```

Local state remains under `~/.hercules-cleaner/` until the user deliberately removes it.


## Windows packaged installer

The Windows Early Access bundle is customer-invoked and current-user scoped under:

```text
%LOCALAPPDATA%\SauceApproved\Hercules Cleaner
```

The bundle requires Node.js 22+ and does not request administrator elevation or bypass UAC / PowerShell execution-policy controls.

Before application files are copied or activated, setup verifies the immutable Windows bundle identity: the release must be `early_access`, the source identity must be an exact 40-character commit SHA, the bundle must carry a 64-character aggregate SHA-256, and that aggregate must recompute exactly from the manifest-listed file identities. Setup then verifies each listed file SHA-256 before installation. GitHub main-branch build attestation provides external build provenance for the distributed ZIP; it is not represented as Windows Authenticode signing.

Cleaner state remains separate at `~/.hercules-cleaner/`, including configuration, sessions, runtime state, and Recovery Capsules. Verified updates retain the previous exact version/commit/artifact identity as rollback metadata. Rollback requires that retained identity and a passing health check. Uninstall removes Windows scheduled-task integration before application files and fails closed if integration cleanup cannot be confirmed. Local recovery/state data remains preserved unless the user separately requests its removal.

Installer support does not change checkout or any other commercial/legal gate and does not add antivirus, malware-removal, or registry-optimization capability.
