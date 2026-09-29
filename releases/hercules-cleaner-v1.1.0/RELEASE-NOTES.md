# Hercules Cleaner v1.1.0 — Release Notes

## Added

- Windows user-scoped one-click setup entrypoint;
- immutable package and per-file SHA-256 verification before activation;
- versioned Windows installs under the current user's local application data;
- verified newer-version update path;
- explicit rollback to the retained prior Cleaner version;
- uninstall that removes app integration while preserving local Cleaner state and Recovery Capsules.

## Preserved

- Session Clean;
- Recovery Capsules;
- protected defaults and bounded scans;
- loopback-only dashboard;
- Windows/macOS/Linux user-level startup adapters;
- Early Access commercial posture with checkout disabled.

## Release posture

This remains **Early Access**. The installer does not approve pricing, Terms, Privacy, payment-provider readiness, or a paid checkout path.

## Runtime requirement

Windows one-click setup still requires Node.js 22+. No third-party Node runtime or native installer framework is bundled.

## Provenance

Original SauceApproved/Hercules implementation created with AI assistance under the repository's ownership/provenance controls. Node.js, Windows command shell, and Windows Task Scheduler remain external operating-system/runtime infrastructure.
