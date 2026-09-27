# Hercules Browser Agent Operator Bridge v1

Date: 2026-09-27 UTC

## Purpose

Make the owned Hercules Browser Agent directly usable from trusted Hercules operator workflows without exposing either the Browser Agent key or Browser Gateway key.

## Route

`trusted operator -> service-role SQL function -> Hercules Browser Agent -> Hercules Browser -> owned browser worker`

The operator bridge is asynchronous through `pg_net`:

- `hercules_browser_agent_submit(...)` submits a bounded browser goal.
- `hercules_browser_agent_result(request_id)` reads the completed result.

## Guardrails

The bridge preserves the Browser Agent's existing protections:

- HTTP/HTTPS start URL only.
- Up to 10 explicitly allowed extra domains.
- Maximum six agent steps.
- Input values are passed only through named input keys.
- CAPTCHA and anti-bot bypass are prohibited.
- Autonomous purchases, transfers, trades, account deletion, security-setting changes, and similar high-impact actions are prohibited.
- Internal Browser Agent and Browser Gateway credentials stay server-side in Vault.

## Why this matters

This creates a first-party operator lane for browser work. Trusted Hercules operations can use the user's owned browser infrastructure first rather than paying for a third-party browser automation service simply for convenience.
