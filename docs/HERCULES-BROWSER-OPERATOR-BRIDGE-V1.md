# Hercules Browser Operator Bridge v1

Date: 2026-09-27 UTC

## Purpose

This bridge gives authorized SauceApproved/Hercules operator workflows a server-side path into the owned Hercules Browser control surface without exposing browser gateway credentials to the caller.

## Production path

`operator -> Supabase service-role call -> hercules_browser_submit -> hercules-browser Edge Function -> Hercules Browser Gateway -> browser worker`

The bridge follows the repository browser-routing policy: Hercules Browser is the default browser execution path when it is available, authorized, and capable of the requested action.

## Functions

- `public.hercules_browser_submit(jsonb)` validates and queues one Hercules Browser request through `pg_net`.
- `public.hercules_browser_result(bigint)` reads the compact response for the queued request.

Both functions are revoked from `public`, `anon`, and `authenticated` and executable only by `service_role`.

## Request constraints

The submit function:

- limits payload size;
- allows only `navigate`, `scrape`, `screenshot`, `interact`, and `close_session`;
- requires HTTPS/HTTP targets for new navigation;
- caps timeout and step count;
- allows only `click`, `type`, `wait`, and `extract` interaction steps;
- resolves the existing `browser-gateway` credential only on the server;
- returns only the `pg_net` request ID.

## Security repair

During live verification, Browserless debug logging was found to serialize launch options containing inherited process-environment data. That created a risk that runtime authentication material could appear in service logs.

An initial attempt to suppress that debug path was insufficient. The final repair rotated the affected Browserless authentication material, synchronized the matching gateway configuration, explicitly disabled Browserless debug namespaces, redeployed both services, and repeated the full browser probe.

After the final repair, the post-probe runtime-log inspection found zero launch-option or environment-dump records from the affected debug path. Runtime credentials are not recorded in this repository.

## Live verification

The final post-repair probe executed through the full Hercules Browser path against `https://example.com/` and returned HTTP 200 with `ok: true`, the expected URL, and page title `Example Domain`.

This verifies that the operator bridge can execute real browser work through Hercules-owned browser infrastructure after the logging hardening.

A separate live attempt against the Spaceship domain manager reached Spaceship through Hercules Browser but was stopped by the site's Cloudflare security-verification challenge. Hercules must not bypass that protection. DNS changes therefore require an authorized Spaceship DNS API/MCP path or a legitimate authenticated browser session accepted by the provider.

## Source-of-truth rule

The migration in `supabase/migrations/20260927033800_hercules_browser_operator_bridge_v1.sql` must remain equivalent to the deployed production functions. Do not place runtime credentials, passwords, cookies, recovery material, or private keys in repository source.
