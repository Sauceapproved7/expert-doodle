# Hercules Cloud V1 — root-managed owner public-key trust anchor

The Host Engine now verifies Ed25519 owner-signed permits using a **fixed local root-managed** trust anchor at `/etc/hercules-cloud/owner-ed25519.pub`, never a path supplied by an unprivileged operator or an environment variable.

The host operator must run as a non-root UID 1000–65535. The trust loader checks that `/etc` and `/etc/hercules-cloud` are real directories owned by UID 0 with no group/world write bits. It opens the public key using Linux `O_NOFOLLOW` and `O_NONBLOCK`, validates the opened file itself through `fstat` as a regular UID-0-owned, group/world-nonwritable file of bounded size, and reads only its public PEM content. Symlinks, operator-owned keys, writable directories, user-supplied alternate paths, malformed keys, missing files and rootful host operation all fail closed. Existing owner-signature expiry, digest/action binding, nonce replay vault and rootless container controls remain in place.

**The operator must never store or receive the owner's Ed25519 private signing key.** Only a separately approved host/root administrator can install or rotate this protected public key, and only after the actual VM/ownership identity has been independently checked. This source change does not install that key, provision a machine, or grant any new root capability.

A local root-owned key checks the Linux filesystem trust boundary; it does not itself attest Oracle tenancy, provider billing, machine ownership, Secure Boot, OS integrity or full host-compromise resistance. The existing Host Engine and Gatehouse production authorization remain disabled.

Test-first: `node --test tests/hercules-cloud-owner-trust-anchor.test.mjs tests/hercules-cloud-owner-permit.test.mjs tests/hercules-cloud-host-engine.test.mjs`. All code is first-party Node standard library with AI assistance; no signing keys, OAuth secrets, VM IDs or billing credentials committed. This PR remains stacked and draft, not in live production. No live hosting, cloud cost or commerce change.
