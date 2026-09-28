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
