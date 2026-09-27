# Hercules Browser Upstream Recovery v1.4

Date: 2026-09-27 UTC

## Purpose

Harden the owned Hercules Browser against transient Chromium/CDP startup races at the Render-hosted browser upstream without introducing an alternate browser provider or weakening security controls.

## Observed failure

Production browser runs intermittently failed while connecting to `wss://hercules-browser-api.onrender.com/chromium` with HTTP 502/503 responses even though the browser gateway and API health surfaces were reachable. Subsequent requests succeeded, identifying a cold-start/readiness race rather than a permanent routing failure.

## Recovery behavior

`hercules-browser` now:

- retries only transient worker startup failures such as 502, 503, 504, bad gateway, service unavailable, and pre-establishment WebSocket closure;
- uses a maximum of three worker attempts;
- applies bounded backoff between retry attempts;
- limits retry recovery to a 20-second budget so long-running requests are not multiplied into unbounded Edge execution;
- re-runs the existing registry-controlled warmup between eligible retries;
- records the actual worker-attempt count on both success and failure;
- preserves the existing closed-session recovery path.

Permanent request errors are not blindly retried.

## Safety boundary

This recovery change does not bypass CAPTCHAs, Cloudflare verification, authentication, permissions, or site security controls. Security challenges remain reported as `human_verification_required` and browser raw-code execution remains disabled.

## Verification

The regression test was added before the implementation and failed on the previous browser source because bounded transient retry/backoff and failed-attempt telemetry were absent. After implementation, the Hercules Browser deterministic-observation CI suite passed, including the cold-start recovery, session recovery, operator bridge, and safety tests.
