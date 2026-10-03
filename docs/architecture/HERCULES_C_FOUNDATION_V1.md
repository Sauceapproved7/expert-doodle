# Hercules C Foundation v1

Status: proposed dependency allowlist. This document does not vendor, download, or activate third-party code.

## Rules

1. Prefer the smallest dependency set that solves an owned Hercules requirement.
2. Pin reviewed releases or immutable source hashes before production use.
3. Preserve upstream license notices and maintain an SBOM.
4. Run compiler warnings, sanitizers, tests, dependency/security review, and provenance checks before release.
5. No dependency may grant itself permissions, weaken authentication, bypass commerce/payment controls, or replace fail-closed policy.
6. Cryptographic protocols remain higher-level Hercules policy; do not invent cryptographic primitives.

## Approved baseline candidates

| Component | Hercules role | Upstream license | Adoption state |
| --- | --- | --- | --- |
| libsodium | authenticated encryption, signatures, password hashing and secure primitives | ISC | APPROVED CANDIDATE |
| SQLite | embedded durable local state and indexes | Public Domain core | APPROVED CANDIDATE |
| libuv | cross-platform event loop, async I/O, IPC and worker/thread primitives | MIT + documented bundled exceptions | APPROVED CANDIDATE |
| zlib | DEFLATE/gzip-compatible compression where interoperability requires it | zlib license | APPROVED CANDIDATE |

## Integration boundaries

### libsodium
Use behind an owned `hercules_crypto` adapter. Keys must come from the existing Hercules secret/key boundary. Never log secret keys or plaintext credentials.

### SQLite
Use behind an owned `hercules_store` adapter. Enable transactions and explicit schema migrations. Authorization remains outside the database adapter and must fail closed.

### libuv
Use behind an owned `hercules_io` adapter only where native asynchronous I/O is required. Do not let event-loop callbacks bypass policy or identity checks.

### zlib
Use behind an owned `hercules_compress` adapter. Apply decompressed-size limits before accepting untrusted compressed input.

## Required production gate

A component moves from candidate to active only after:
- exact upstream release/hash is recorded;
- license/provenance review passes;
- SBOM entry exists;
- build is reproducible in Hercules CI;
- unit/integration tests pass;
- ASan/UBSan are clean on supported native test targets where available;
- fuzz or malformed-input tests cover parsers/decompression/native boundaries;
- no existing Hercules security invariant regresses.

## Explicitly not approved by this document

Everything else in the referenced Awesome C catalog remains unapproved until independently reviewed. This allowlist is intentionally narrow.
