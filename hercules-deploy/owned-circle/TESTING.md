# Owned Circle v0.2 test evidence

Date: October 13, 2026. Independently executed in isolated local Node 22.16.0 environment.

- 8 original tests: email normalization, owner-only SQLite filesystem, single-use confirmation token and expiry, verified-only early tester application, no SMTP success claim, bounded HTTP API with owner bearer, header injection rejection, and subscription withdrawal.
- 4 added tests: absence of HTTPS/mail/database guarantees, complete configuration still held without independently verified SMTP receipt and persistent storage, blocked insecure origins/shared secrets/untrusted ports, and explicit owner release gate.
- Combined command: `node --test tests/*.test.mjs`
- Result: **12 tests, 12 pass, 0 fail**.
- Source syntax checks: `node --check` on `src/*.mjs` and `public/*.mjs` passed.
- Standalone package: `hercules_owned_circle_v02.zip`, SHA-256 `b05062d41e6c116af12e786f5d022f7dcce3a47ef550ee4e5786b0c949c5d4a3`.
- Live email delivery, durable owner-host deployment, public HTTPS browser, actual signup, production release, and financial transaction: **not verified**.

Full app package is a conversation artifact, not an archive committed to this repository. This PR contains only source-release contract and CI guards; do not claim the runnable app itself is hosted or in this branch.

Render Free web-service local storage is ephemeral, making it unsuitable for live subscriber SQLite: https://render.com/docs/free.

Provenance: SauceApproved original work, no proprietary third-party app code packaged.
