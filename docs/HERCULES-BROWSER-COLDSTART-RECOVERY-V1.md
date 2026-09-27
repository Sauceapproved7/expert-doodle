# Hercules Browser Cold-Start Recovery v1

Date: 2026-09-27 UTC

## Purpose

Make the owned Hercules Browser reliable after idle periods without relying on a paid third-party browser service merely to absorb startup delay.

## Behavior

The browser control plane performs a bounded, on-demand warmup before a browser worker call. Warmup URLs come from the worker registry rather than user input. The primary worker warms the Hercules Browser Gateway health endpoint and the Hercules Browser API endpoint in parallel. If the first authenticated worker call still fails, Hercules performs one additional bounded warmup and retries exactly once.

## Boundaries

This is not a keepalive loop. Render can sleep normally while Hercules is idle. Existing restrictions remain: private-network targets are blocked, raw browser code execution is disabled, CAPTCHA and anti-bot bypass are disabled, the Browser Agent stays bounded, and autonomous high-impact actions remain prohibited.

## Timing

Browser Agent and its trusted operator bridge allow up to 120 seconds for a cold-start-aware request to return. Page navigation itself remains constrained by the worker's configured browser timeout.
