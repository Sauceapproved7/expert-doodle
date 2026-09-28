# Hercules Cleaner v1.0.0 — Security Boundary

Hercules Cleaner has local file authority only within configured cleanup roots and the current operating-system user's permissions.

## Required controls

- Dashboard binds to loopback only.
- API actions require the ephemeral local control token.
- Foreign browser origins are blocked.
- Symlinks are not followed.
- Personal-document and credential directories are protected by default.
- Scan depth and file count are bounded.
- Candidate size and modification time are revalidated immediately before movement.
- Apply-mode cleanup uses Recovery Capsules rather than blind deletion.
- Recovery items carry SHA-256 integrity records.
- Restore fails if a destination exists or a stored hash does not match.
- Cleanup/restore operations serialize through a local lock.
- Startup integration is user-level and does not bypass OS permissions.

## Protected defaults

Default profiles protect locations including Documents, Desktop, Pictures, Videos, Music, `.ssh`, and `.gnupg`.

## Explicit non-features

This release is not:
- antivirus or malware removal;
- registry optimization;
- kernel cleaning;
- secure forensic erasure;
- authority to delete arbitrary personal files;
- authority to bypass administrator/elevation controls.

Report vulnerabilities through the repository's private security reporting path when available.


## Windows installer and updater controls

- Per-user install root under `LOCALAPPDATA`; no administrator elevation is requested.
- Bundle files are verified against a generated SHA-256 manifest before staging.
- The active version is selected through a local `active.json` pointer.
- Enabled update channels must pass the canonical immutable Cleaner update-policy check and match a separately trusted expected release identity.
- Updates are accepted only from HTTPS and an allowlisted distribution host.
- Downloaded ZIPs must match the trusted SHA-256 before extraction.
- Archive entries are rejected if absolute, drive-qualified, or path-traversing.
- A candidate version must pass a local Cleaner `status` health check before activation.
- Failed activation leaves the previous version active and records rollback evidence.
- The updater does not bypass PowerShell execution policy.
- Node.js, PowerShell, Windows tar, and Task Scheduler are external runtime/OS infrastructure.
- Authenticode publisher signing is not claimed until a trusted owner-controlled certificate is configured.
