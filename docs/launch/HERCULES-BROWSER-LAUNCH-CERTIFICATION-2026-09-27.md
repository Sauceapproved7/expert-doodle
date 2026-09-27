# Hercules Browser Launch Certification — 2026-09-27

## Certification status

**PASS — production-ready with an explicit single-worker admission limit.**

This certification covers the owned Hercules Browser control surface, Browser Agent execution, runtime monitoring, routing policy, safe personal-session handoff boundaries, and burst-load behavior.

## Certified production versions

- Hercules Browser source version: **1.5.3**
- Supabase Edge Function: **hercules-browser v14 — ACTIVE**
- Hercules Browser Agent source version: **0.12.0**
- Supabase Edge Function: **hercules-browser-agent v16 — ACTIVE**
- Runtime monitor classifier: **2.2**
- Production browser worker admission limit: **1 simultaneous CDP start**
- Operator bridge timeout: **120 seconds**
- Browser admission wait budget: **45 seconds**

## 1. Burst and stress proof

A six-request concurrent navigation burst was submitted through the real `public.hercules_browser_submit` operator bridge against the deployed production stack.

Final result:

- submitted: 6
- succeeded: 6
- failed: 0
- capacity_busy: 0
- upstream 429/502/503: 0
- worker attempts per completed request: 1
- slowest completion: approximately **39.8 seconds**
- admission behavior: serialized through a single active worker lease

The pre-hardening test had exposed Browserless/CDP 429 and timeout behavior under concurrency. Hercules now queues browser starts before the upstream worker rather than allowing a thundering herd.

## 2. Default browser routing

The active browser-routing policy keeps:

- `defaultBrowser = hercules-browser`
- `ownedControlSurface = hercules-browser`
- external browser fallback only when Hercules Browser is unavailable, incompatible, or lacks the required action
- a required recorded reason for fallback
- no paid external browser fallback merely for convenience

The canonical execution contract also requires Hercules-owned browsing first.

## 3. Runtime monitoring

Production monitoring is active:

- `hercules-browser-health-probe`: every 15 minutes
- `hercules-browser-runtime-monitor`: every 5 minutes

The live monitor returned:

- `ok = true`
- `latestProbeStatus = succeeded`
- `transientFailures = 0`
- `retryExhaustions = 0`
- `staleRuns = 0`
- p95 browser latency: approximately **31.2 seconds**
- classifier version: **2.2**

The latest active navigation probe reached Example Domain successfully in one worker attempt.

The monitor classifier was corrected during certification after live invocation exposed a PostgreSQL-invalid regular-expression repetition bound. The corrected classifier is covered by a repository regression test.

## 4. Browser Agent workflow verification

The production Browser Agent was tested through the real operator bridge with the goal:

> Inspect the Example Domain page, follow the Learn more link, and return the destination page title.

Production result:

1. deterministic named-link plan selected the Example Domain link;
2. the Browser Agent clicked through to IANA;
3. the destination URL became `https://www.iana.org/help/example-domains`;
4. the destination title was `Example Domains`;
5. the post-action evaluator recognized the goal as complete;
6. the agent stopped instead of performing another unnecessary click;
7. the session cleanup path completed.

Final Browser Agent status: **succeeded**.

## 5. Safe authenticated-session handoff

The active routing policy requires personal authenticated browser use to be:

- explicit owner-session only;
- non-automatic;
- provider-accepted;
- subject to the provider's security controls.

Hercules does not export or transfer:

- passwords;
- cookies;
- credentials;
- MFA/2FA secrets;
- provider session tokens.

Hercules does not bypass CAPTCHA, Cloudflare, MFA, identity verification, or other human-verification/security controls.

Production safety evidence exists from a Spaceship navigation that encountered Cloudflare verification and was correctly marked `human_verification_required` with `bypassAttempted = false`.

## 6. Repository and security gates

The final burst-queue hardening change passed:

- Hercules Browser Launch Hardening
- Hercules Browser Cold Start Recovery
- Hercules Security Baseline
- Hercules Owner Code Gate
- Hercules Implementation Enforcement
- Hercules Universal Merge Gates
- Hercules Main Integrity Guard
- Hercules GitHub Main Protection
- Hercules Workflow Syntax Gate
- Provenance Gate
- CodeQL

Relevant merged changes:

- six-part Browser launch hardening: PR #237
- burst queue / operator timeout / monitor classifier hardening: PR #252
- final production hardening merge SHA: `7851a526ca6d7cd180419bd84eb4794af20f551f`

## Capacity boundary

This certification does **not** claim unlimited browser concurrency.

The currently certified production configuration intentionally permits one simultaneous CDP start. Concurrent submissions are queued within a bounded admission window. Increasing Browserless/CDP capacity or changing the concurrency limit requires another stress certification before the higher limit is treated as production-certified.

## Final certification

The owned Hercules Browser path is certified for the current production launch configuration:

- owned-browser-first routing: PASS
- browser navigation/execution: PASS
- bounded transient recovery: PASS
- six-request concurrent submission handling: PASS
- Browser Agent convergence: PASS
- session cleanup: PASS
- health monitoring: PASS
- stale/retry/latency monitoring: PASS
- personal-session safety boundary: PASS
- anti-bot/security-verification non-bypass: PASS
- owner-code / provenance / security / CodeQL gates: PASS

This certification applies to the exact production configuration and source state recorded above.
