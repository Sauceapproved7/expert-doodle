# Hercules Binary Inspector v1

Owned defensive static binary-inspection surface for SauceApproved Hercules.

## Scope

- static file-format identification for PE, ELF, and 64-bit Mach-O signatures;
- SHA-256 evidence bound to the inspected bytes;
- bounded printable-string extraction with deterministic offsets;
- fail-closed explicit authorization input;
- immutable evidence report with `execution: "not_performed"` and `mutations: "not_performed"`;
- optional read-only IDA adapter boundary.

The core inspector does **not** execute submitted binaries, extract credentials, patch targets, grant itself permissions, invoke a shell, spawn a process, or make network requests.

`authorized: true` is a library boundary, not an authentication system. Any service exposing the inspector must derive that boolean from its own verified authorization decision; caller-supplied untrusted data must never be promoted directly to authorization.

Default input is capped at 32 MiB, configurable only within the hard 128 MiB ceiling. Printable-string results default to 200 and cannot exceed 10,000; each emitted string is capped at 512 bytes.

The IDA integration is adapter-only: deployments may connect a properly licensed IDA installation under a separately verified policy boundary. Third-party IDA code is not vendored or represented as Hercules-owned code.
