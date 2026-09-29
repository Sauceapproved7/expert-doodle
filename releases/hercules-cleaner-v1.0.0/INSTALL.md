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

The customer-installable Windows bundle is built from the canonical v1.0.0 source and includes `install.cmd`, `Install-HerculesCleaner.ps1`, the versioned Cleaner runtime, and `expected-install-identity.json`.

Windows setup is current-user scoped under:

```text
%LOCALAPPDATA%\SauceApproved\Hercules Cleaner
```

It does not request administrator elevation or bypass PowerShell execution policy. Before copying or activating the runtime, setup verifies the expected install identity against the bundle version, exact source commit, aggregate SHA-256, and every manifest-listed file hash. Existing `~/.hercules-cleaner/` state, sessions, configuration, and Recovery Capsules remain outside the application version tree.

Verified updates require a separately trusted expected identity and preserve the previous active version identity as explicit rollback metadata. Failed activation leaves the previous active pointer unchanged and records rollback evidence.

Uninstall removes startup/update integration before deleting application files. If integration cleanup cannot be confirmed, uninstall fails closed instead of silently deleting the app. Local state and Recovery Capsules remain preserved unless the user explicitly invokes the separate `-RemoveUserData` option.

Installer availability does not enable checkout or approve pricing, Terms, Privacy, payment processing, antivirus capability, malware-removal capability, or registry-cleaning claims.
