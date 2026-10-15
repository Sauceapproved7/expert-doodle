# Hercules Free Work v1 — owned Work/Code foundation

## Scope

This is an isolated proof-of-capability for an independently owned task workspace. It **does not unlock ChatGPT Work, Codex, subscription restrictions, proprietary model weights, or API entitlements**.

The Node.js app uses only the runtime's standard library and web APIs. It has no package dependencies, no payment integration, no automatic deploy authority, and no production credential requirements.

## Functions actually implemented

- **Work planner:** deterministic offline implementation/checklist template. No external action is performed.
- **Research planner:** deterministic source-verification checklist. No websites are fetched.
- **Code review:** heuristic static scan of pasted text for a limited set of dangerous patterns; no execution or complete security assurance.
- **Code drafting:** submits text to an owner-installed, loopback-only Ollama-style local model and returns its text response. It will return `503 model_not_connected` when not configured, and will not silently fall back to paid APIs.
- **Authenticated task UI/API:** bounded create, run, list, inspect operations, with in-memory records by default, or an optional private single-process disk store.

The code path intentionally has **no shell execution**, system-write, browser-control, payment, cloud-deploy or git-push capability. These must be added later as separate scoped owner-authorized tools with explicit limits, tests and audit logs.

## Local usage (developer environment)

Requires Node.js 22+.

Set `HERCULES_FREE_WORK_TOKEN` to a random secret of at least 32 bytes **in the hosting environment**, not in source files or chat:

```sh
HERCULES_FREE_WORK_TOKEN="<your-existing-owner-secret-in-your-env>" node hercules-runtime/free-work-server.mjs
```

The server listens on `http://127.0.0.1:38881` by default and **refuses public network binds**. Browser users must enter the matching owner token. The UI never persists it to localStorage. For remote phone use, integrate with existing authenticated Hercules gateway and HTTPS before public exposure; this phase does not deploy a live URL.

Optional existing local model:

```sh
HERCULES_FREE_WORK_TOKEN="<owner-secret-in-env>" HERCULES_FREE_WORK_MODEL="your-installed-local-model" node hercules-runtime/free-work-server.mjs
```

The default model endpoint is `http://127.0.0.1:11434`. `HERCULES_FREE_WORK_MODEL_URL` may point **only to an http loopback address**; arbitrary remote services and proxy credentials are rejected. The program never installs model weights or downloads software.

## Optional durable state

Set `HERCULES_FREE_WORK_STATE_PATH` to an absolute JSON filename inside an **already existing**, user-owned directory with POSIX permissions `0700`. The server writes a private `0600` file using an atomic rename, and refuses unsafe directories, symlinks, corrupted state, and world/group-readable files. The state contains plaintext prompts and output; never store API keys or sensitive secrets in tasks. Files persist only when the hosting filesystem is durable. Only one server process may use a state file. Jobs interrupted during execution are marked blocked on restart and are **not** rerun without a new job.

This is a development milestone; production persistence should instead use Hercules Auth and tenant-scoped Postgres with independently tested authorization.

## Safety and limitations

- No external API key or paid AI backend is needed for the offline operations.
- Code-generation performance and quality depend on an already running local model, which itself may require paid hardware or hosting.
- Task state is in process memory by default. When HERCULES_FREE_WORK_STATE_PATH is configured, tasks persist across restarts in a private owner-only JSON file with atomic rename and crash recovery. This is NOT encrypted storage, is not suitable for multi-instance hosting, and a server on ephemeral disk can still lose it. A shared database with row-level security is necessary for cloud scale.
- The server has bearer authentication, same-origin API checks, strict CSP, bounded request sizes, capped result sizes, task count limits and a loopback-only bind.
- The UI is not production-ready for internet exposure. Remote access requires the Hercules owner identity and gateway authorization, persistence, quota control, rate limiting, TLS, and negative end-to-end testing.
- The model's answers are untrusted text: they are never interpreted as shell commands or deployed.
- No real web research is performed and no production integration is activated by this prototype.

## Verification

```sh
node --test tests/hercules-free-work*.test.mjs
node scripts/verify-owner-code-only.mjs
```

CI: `.github/workflows/hercules-free-work.yml`. New follow-up persistence revisions remain isolated pending their own review, security checks and release approval.

## Future integration

Route authenticated requests through Hercules Identity Control Plane and existing `hercules-chat` ownership/RLS contracts. Add an authorized model adapter for Hercules AI inference only after its production health gate verifies `ai_ok=true`; never bypass degraded-model health flags.

For a real Codex-style workflow, next implement bounded repository operations (read, propose patch, unit-test sandbox, diff review) behind owner authorization. No arbitrary commands and no automatic publishing until independent security and rollback gates pass.

## Provenance

Original SauceApproved code. Does not package third-party libraries, models or proprietary provider software. No external API access was used in implementation.
