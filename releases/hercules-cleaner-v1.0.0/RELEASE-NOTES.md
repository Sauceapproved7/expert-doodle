# Hercules Cleaner v1.0.0 — Release Notes

## Added

- policy-scoped cleanup engine;
- dry-run cleanup plans;
- Quick Safe, After Work and Low Storage Guard profiles;
- Session Clean before/after work-session diffing;
- Recovery Capsules with SHA-256 manifests and fail-closed restore;
- cleanup-operation locking and metadata revalidation;
- loopback-only dashboard with local control token;
- Windows, macOS and Linux user-level startup adapters;
- Hercules command-surface routing;
- Forge product-package registration;
- exact-commit CI packaging path;
- Windows per-user installer bundle with Start Menu launcher;
- health-checked version activation and rollback receipts;
- SHA-256/HTTPS constrained updater with archive traversal protection;
- Windows CI smoke install/launch/uninstall path.

## Release posture

This is an **Early Access** release package. The runtime is merged and verified in canonical Hercules source. The packaged commercial surface remains checkout-disabled pending owner-controlled pricing, legal and payment activation gates.

## Current limitation

The release requires Node.js 22+. A Windows PowerShell/CMD installer bundle is included as an Early Access distribution path. A native EXE/MSI and Authenticode publisher signature are later distribution milestones and are not claimed in v1.

## Provenance

Original SauceApproved/Hercules implementation created for the user with AI assistance under the repository's ownership/provenance controls. Node.js and operating-system schedulers are external infrastructure and are not claimed as SauceApproved-owned code.
