# Hercules MCP scoped release candidate, October 13, 2026

**Do not deploy this branch into the existing live service automatically.** This is a nonproduction deployment candidate pinned to the exact last confirmed Render production SHA `2a5425bac77460be9ef37c2cad74d43ef6fa7763`.

It ports exactly four existing and previously tested Hercules Python/PWA paths from the reviewed GitHub main `ad60d2c255b870ac8d2d0d2bd37fb1b87e94912b`: `hercules-ai/app/main.py`, `hercules-ai/app/model_readiness.py`, `hercules-ai/ui/index.html`, `hercules-ai/ui/service-worker.js`. The dependencies and original Render start command are unchanged. App main imports the single new module. The 503 readiness check only proves model inventory and always claims chat inference and public release unverified; the UI disables chat if inventory is absent. Service worker deliberately excludes authenticated API responses and foreign origins.

The GitHub branch CI is read-only and verifies exact base ancestry and scope, TDD cases, Python compilation and existing ownership/security baselines. It does not hold credentials, contact billing providers, change checkout, sign contracts, or deploy to Render. Even when tests pass, the actual production backend remains unavailable (`/v1/models` last returned 502) and the unrelated Devbrain/Railway AI transport remains offline.

Prior to any release: verify a separate staging runtime on resource-feasible, authorized infrastructure; confirm same pinned SHA and actual GET /health, /ready, /v1/models, authenticated real /v1/chat and no accidental public inference; verify Render GitHub integration or use an owner-approved narrowly scoped deployment path. Do not replace live main with this branch or bypass the Gatehouse gate. Any provider plan charges require owner decision. This release candidate is not a public AI app.

Provenance: First-party Hercules source backport, existing ownership/law/security boundaries preserved; documentation and tests original, AI assisted; no external code or model weights introduced.

Candidate governance: only an isolated test deployment may be considered until real inference, exact provider SHA, and release gate approval are independently evidenced.

## Candidate source provenance

The four application blobs were copied without modification from reviewed main commit `ad60d2c255b870ac8d2d0d2bd37fb1b87e94912b`, onto the base of the live Render SHA `2a5425bac77460be9ef37c2cad74d43ef6fa7763`. GitHub CI checks the complete changed-path set; a passing source test is not provider health or live release evidence.
