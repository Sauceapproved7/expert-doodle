# Hercules Prompt Intelligence Lab — canonical integration boundary

Status: **source-only proposed integration; not deployed or connected to live Smallz**.

## What already existed
- The canonical execution contract and Boil the Ocean gate under governance/ and scripts/.
- The owned Hercules Browser routing policy in governance/browser-routing-policy.json.
- The owner-session Personal Browser Bridge, which must retain its explicit pairing and approval rules.
- A separately tested offline Python Prompt Intelligence Lab package (98 tests, four browser tests skipped).

This source change introduces a **non-executing**, standard-library Node trace-ingestion boundary at `hercules-runtime/prompt-intelligence/trace.mjs`, not an alternate browser controller or authorization service.

## Trust contract
A trusted export adapter may HMAC-SHA256-sign a canonical JSON envelope:
`{source, sequence, event, mac}`. The MAC is computed over JSON.stringify({source,sequence,event}) with a private per-emitter key. No keys are stored in this repository.

`ingestBrowserTrace(envelope, {keyForSource,claimSequence})` requires an independent key lookup and **atomic durable monotonic sequence claim**. It rejects unknown emitters, incorrect MACs, replay, malformed fields, and envelopes exceeding 64 KiB. A caller must provide durable transactional sequencing; the example in tests is test-only and not production suitable.

- `navigation`: the URL is replaced with a redacted navigation marker.
- `page_text` and `agent_message`: content is explicitly untrusted data.
- `tool_attempt`: always denied; any approval claimed by page content is ignored.
- Output includes a hash of the signed event, not an authorization grant.

The receiver must never treat this receipt as permission to execute browser operations. The active Browser gateway and owner-session bridge retain all existing access and human-verification requirements.

## Testing
Run `node --test tests/hercules-prompt-intelligence-trace.test.mjs`. Before merging also run:
`node scripts/verify-hercules-execution-contract.mjs`,
`node scripts/verify-owner-code-only.mjs`, and `node scripts/security-baseline.mjs`.

## Rollback / rollout
This is an unused, opt-in module. Rollback is reverting its source, test and workflow commit. No schema, payment path, browser extension or production configuration is modified.

To activate safely, obtain verified Smallz exporter API/schema, wire a trusted exporter with independent key management and transactional replay store, verify browser trace semantics and browser UI in isolated staging, attach independent evidence, then pass the canonical completeness gate. **No direct production wiring is authorized or claimed by this change.**

## Remaining product scope
The separate Python offline lab is not yet imported as a full canonical package. Browser end-to-end tests, actual Smallz signing/export, Forge and Gatehouse adapters, isolated staging deployment, and provider-verified runtime evidence remain open. Do not label the entire Prompt Intelligence Lab complete.
