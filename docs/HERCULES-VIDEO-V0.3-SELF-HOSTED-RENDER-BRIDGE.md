# Hercules Video v0.3 — Self-Hosted Render Bridge

## Purpose

Hercules now owns a generic render-job boundary that can drive a self-hosted video runtime without putting commercial-provider request formats into the Hercules core.

This is infrastructure, not a claim that Hercules owns any external model weights.

## Canonical job flow

1. Hercules compiles a storyboard shot.
2. `createRenderRequest` normalizes the generic render contract and fingerprints it.
3. `createRenderJob` records a queued job with a bounded timeout and attempt limit.
4. The self-hosted adapter sends a Hercules envelope to an injected local transport.
5. Job state may move only through the explicit lifecycle:
   - queued → running
   - running → completed
   - running → failed
   - queued → failed
   - failed → queued only through retry scheduling
6. A completed job requires an artifact record.
7. Artifact evidence includes SHA-256 and a deterministic artifact fingerprint.
8. Retryable failures use bounded exponential retry. Attempt limits fail closed.

## Ownership boundary

Hercules owns:

- render request schema,
- request fingerprints,
- job IDs and state machine,
- timeout policy,
- retry policy,
- artifact checksum/evidence,
- self-hosted envelope,
- adapter/transport contract.

A future model runtime owns only the actual inference implementation behind the injected transport.

## Security and portability rules

- No provider-specific SDK imports are permitted in the Hercules core, storyboard, render bridge, or self-hosted adapter.
- The self-hosted adapter requires `target.kind === "self-hosted"`.
- A runtime ID is mandatory.
- The bridge does not embed credentials.
- The bridge itself performs no uncontrolled network discovery.
- External/open-weight model licensing and hardware requirements must be evaluated before a concrete model runtime is added.

## Next increment

The next useful step is a concrete local runtime service implementing the generic transport contract, followed by an evidence-based selection of an open-weight video model whose license and hardware profile fit the target deployment.
