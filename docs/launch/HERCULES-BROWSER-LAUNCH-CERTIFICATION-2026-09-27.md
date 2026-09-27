# Hercules Browser Launch Certification — 2026-09-27

## Certification status

**PASS — canonical production browser is Hercules Browser Gateway v2 with local Chromium and a bounded single-worker admission limit.**

This certification covers the owned Hercules Browser control surface, Gateway v2 worker, Browser Agent execution, routing policy, safe authenticated-session boundaries, and live burst behavior.

## Certified production versions

- Hercules Browser source version: **1.5.4**
- Supabase Edge Function: **hercules-browser v15 — ACTIVE**
- Hercules Browser Agent source version: **0.12.0**
- Supabase Edge Function: **hercules-browser-agent v16 — ACTIVE**
- Canonical worker engine: **playwright-local-chromium**
- Canonical Render service: **hercules-browser-gateway-v2**
- Render service ID: **srv-dasi97bncjis73a8r6m0**
- Worker URL: `https://hercules-browser-gateway-v2.onrender.com`
- Runtime monitor classifier: **2.2**
- Production admission limit: **1 active Hercules browser worker lease**
- Operator bridge timeout: **120 seconds**
- Browser admission wait budget: **45 seconds**
- Production cutover: **2026-09-27T14:23:13Z**

## 1. Why the worker changed

Live DA-24 LinkedIn verification exposed two distinct issues in the previous Browserless-backed path:

1. Hercules Browser navigation could lose the Playwright execution context while LinkedIn redirected to its authentication surface.
2. After that race was fixed, Browserless-backed CDP connections still failed with timeouts or a public-edge 429/Cloudflare response.

PR #266 fixed the bounded redirect-observation race in `hercules-browser` without treating login, MFA, CAPTCHA, Cloudflare, or provider authorization as recoverable.

PR #267 proved a first-party direct Chromium fallback.

PR #268 established the canonical Gateway v2 implementation, which launches Chromium locally inside the owned Render service and removes Browserless/CDP from the primary execution path.

## 2. Canonical LinkedIn production proof

After Gateway v2 cutover, the normal `public.hercules_browser_submit` production path navigated to the LinkedIn Company Page setup URL successfully.

Verified result:
- trace: `a0f5c1e2-faf5-4fba-8bf9-18fec3b5838c`
- status: **succeeded**
- worker attempts: **1**
- engine: **playwright-local-chromium**
- session persistence: **created successfully**
- provider outcome: LinkedIn authwall / sign-up surface
- security challenge: **none detected**
- authentication bypass: **not attempted**

This is the expected boundary. Hercules can carry the workflow to LinkedIn's owner-controlled authentication checkpoint, but the owner must complete provider login, terms, verification, MFA/CAPTCHA, or identity steps when LinkedIn requires them.

## 3. Burst and stress proof

A six-request concurrent navigation burst was submitted through the real `public.hercules_browser_submit` operator bridge after the Gateway v2 production cutover.

Final result:
- submitted: **6**
- succeeded: **6**
- failed: **0**
- worker attempts per completed request: **1**
- engine on all completed requests: **playwright-local-chromium**
- slowest completion: approximately **10.844 seconds**
- admission behavior: serialized through the existing single-worker lease

Observed completion times were approximately 2.564s, 4.529s, 6.270s, 7.632s, 9.219s, and 10.844s.

## 4. Browser Agent workflow verification

The production Browser Agent was rerun after Gateway v2 became primary with the goal:

> Inspect the Example Domain page, follow the Learn more link, and return the destination page title.

Production result:
1. the deterministic named-link plan selected the Example Domain link;
2. the Browser Agent clicked through to IANA;
3. the destination became `https://www.iana.org/help/example-domains`;
4. the destination title was `Example Domains`;
5. the post-action evaluator recognized the goal as complete;
6. the agent stopped without an unnecessary additional action.

Final Browser Agent status: **succeeded**.  
Final answer: **Example Domains**.  
Convergence: **destination_title_satisfied**.

## 5. Security and session boundaries

Gateway v2 preserves the Hercules browser safety contract:
- bearer-token authentication on `/v1/run`;
- worker token stored in Hercules Vault rather than repository source;
- HTTP(S)-only navigation;
- private/internal targets blocked;
- DNS answers checked for private-address resolution;
- embedded URL credentials blocked;
- subresource network requests checked;
- bounded request body, actions, selectors, steps, waits, text extraction, and session lifetime;
- opaque reusable session IDs with a ten-minute TTL;
- no raw JavaScript/code-execution endpoint;
- no CAPTCHA, Cloudflare, MFA, login, consent, terms, or provider-authorization bypass.

The temporary `hercules-browser-direct` service remains available as the first rollback target. The older Browserless-backed gateway is legacy rollback material only and is not the canonical production worker.

## 6. Default browser routing

The active browser-routing policy remains:
- `defaultBrowser = hercules-browser`
- `ownedControlSurface = hercules-browser`
- external browser fallback only when the owned Hercules Browser is unavailable, incompatible, or lacks the required action
- recorded fallback reason required
- no paid external browser fallback merely for convenience

## 7. Repository and security gates

The redirect recovery and local-Chromium worker changes passed the applicable gates, including:
- Hercules Browser Cold Start Recovery
- Hercules Browser Direct Runtime
- Hercules Browser Gateway V2
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
- PR #266 — redirect-destroyed navigation observation recovery
- PR #267 — first-party direct Chromium runtime
- PR #268 — canonical Gateway v2 local-Chromium worker
- Gateway v2 merge SHA: `40cfe3510c7d59fda7d5ff9ca8fd41fb683e9506`

## Capacity boundary

This certification does **not** claim unlimited browser concurrency.

The production control plane intentionally permits one active browser worker lease. Gateway v2 can reuse its local Chromium process across isolated browser contexts, while concurrent operator submissions remain bounded by the existing admission queue. Any increase to the production admission limit requires another stress certification before the higher limit is treated as certified.

## Final certification

The current production configuration is certified for:
- owned-browser-first routing: **PASS**
- Gateway v2 local Chromium execution: **PASS**
- LinkedIn redirect/authwall navigation: **PASS**
- bounded transient observation recovery: **PASS**
- six-request concurrent submission handling: **PASS**
- Browser Agent convergence: **PASS**
- session reuse and cleanup boundaries: **PASS**
- private-target and embedded-credential blocking: **PASS**
- personal-session safety boundary: **PASS**
- anti-bot/security-verification non-bypass: **PASS**
- owner-code / provenance / security / CodeQL gates: **PASS**

This certification applies to the exact production worker and source state recorded above.
