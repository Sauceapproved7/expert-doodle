# Hercules Cloud Host Engine V1 — source and Linux sandbox validation

Status: **stacked draft PR only**, not connected to owner-managed Linux hardware or production. Builds on #975 and #948, not current production main.

Host Engine source `hercules-deploy/cloud/host-engine.mjs` composes the project's existing immutable sandbox plan, owner-signed one-use permits, rootless Docker restriction, private durable replay markers and bounded container create/start/inspect/rollback. The local operator `host-engine-cli.mjs` is default-off. It requires explicit sandbox opt-in, an owner-private external signing-key file, private plan and permit files, non-root Linux identity, actual rootless Docker Unix socket, and exact command allowlisting before any sandbox action. It never mints a permit.

The new Node child-process boundary is explicitly declared in `governance/owner-code-policy.json`; it uses a fixed Docker executable, no shell, no public API listener, no inherited ambient credentials or cloud provisioning. Production approvals remain false. The HMAC secret must remain owner-controlled; before multi-tenant network exposure, move to public-key verification and independent provider attestation.

Tests: `node --test tests/hercules-cloud-host-engine.test.mjs tests/hercules-cloud-host-agent.test.mjs tests/hercules-cloud-host-local.test.mjs tests/hercules-cloud-oci-a1-readiness.test.mjs`; `node scripts/verify-owner-code-only.mjs`. GitHub Linux CI additionally creates, inspects, and removes a **real, unprivileged no-network Docker sandbox** with a pinned third-party Node base image and no production hooks. This disposable GitHub Docker daemon is NOT the signed rootless Host Engine path and NOT a user-owned machine; those verifications remain blocked. CI never installs a host agent into Render/Railway, Oracle, or the user's computer.

Future: independently obtain owner-controlled Linux host and verified incremental cost, install secure owner-managed rootless Docker, run operator using an explicitly signed permit for a pinned sandbox image and prove safe rollback. Only then consider Gatehouse-approved production. Oracle signup and card/identity checks were not performed. No cloud VM, live services, payment settings, DNS or registration changed.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
