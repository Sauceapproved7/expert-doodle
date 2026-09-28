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


## Windows Early Access installer bundle

The Windows bundle is a per-user installer and does not request administrator elevation.

1. Ensure Node.js 22 or newer is installed.
2. Extract the Hercules Cleaner Windows ZIP.
3. Double-click `install.cmd`.
4. Launch **Hercules Cleaner** from the Start Menu.

Installed application versions live under:

```text
%LOCALAPPDATA%\SauceApproved\Hercules Cleaner\versions\
```

Cleaner configuration, sessions, and Recovery Capsules remain under:

```text
%USERPROFILE%\.hercules-cleaner\
```

Updates and normal uninstall preserve that state. To deliberately remove it during uninstall, run `Uninstall-HerculesCleaner.ps1 -RemoveUserData`.

### Update posture

The update client is implemented but fail-closed. The public Early Access update channel is disabled until a verified distribution asset and trusted expected release identity/signing path are available. Enabled updates require HTTPS, an allowed distribution host, a resolved 40-character source commit, exact SHA-256 package identity, safe archive paths, and a successful Cleaner health check before activation.

The v1 Windows bundle is not claimed as a native EXE/MSI and is not claimed to carry an Authenticode publisher signature.
