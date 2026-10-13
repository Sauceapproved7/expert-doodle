# Hercules Runtime Witness v1 — bounded public-page evidence

**Scope:** First-party, no-credential HTML reachability and short-duration latency samples for Smallz and Hercules Studio. Never equate a public 200 response with authenticated functionality, deployment identity, payout verification, Codex publication or production release.

## Offline regression tests

    node --test tests/hercules-runtime-witness.test.mjs

The CI test suite uses synthetic responses only; it does not contact any service.

## Explicit read-only public probes

    node scripts/hercules-runtime-witness.mjs --probe --target smallz-launch --samples 3 --json
    node scripts/hercules-runtime-witness.mjs --probe --target studio-activation --samples 3 --json

Only two exact HTTPS URLs are accepted. Arbitrary user URLs, redirects, private hosts, auth headers, cookies, POSTs, and more than five samples are unsupported. Each request has a 4-second timeout and reads at most a 16 KiB page prefix; errors and remote HTML are not logged. Any failed observation causes a nonzero exit status.

## What observations do and do not prove

- The witness measures client-side p50, p95 and maximum latency in milliseconds, with a small explicitly reported sample count.
- It separates all-success, mixed and no-success HTML outcomes, including a limited transient recovery observation when a failure is followed by success within the samples.
- The result **always** reports deploymentIdentityVerified=false, productionHealthVerified=false, paymentFlowVerified=false and releaseEligible=false.
- A small sample is not an SLO or reliable tail-latency estimate. The transient-recovery label is not proof of durable recovery.
- Stronger claims require independent authenticated service contracts and a provider-bound deployment identity, outside this tool.

## Hercules differentiators

1. Fail-closed evidence ladder that prevents HTML availability from being mistaken for verified deployment or commerce health.
2. Strictly scoped, no-secret owner-controlled probe budget with deterministic latency summary, sanitized failures and no arbitrary destination.

Original SauceApproved AI-assisted Node.js source, no dependency additions or third-party copied code. No billing, changes to DNS, hosting, Shopify, checkout, credential custody or live deployments.
