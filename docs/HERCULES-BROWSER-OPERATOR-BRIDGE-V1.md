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

During live verification, Browserless debug logging was found to serialize launch options containing the inherited process environment. Because that environment includes the Browserless authentication token, debug output could expose the credential in service logs.

The Browserless credential was rotated, the gateway was updated to the matching replacement credential, and verbose Browserless debug logging was disabled before the bridge was accepted as healthy. Credentials are not recorded in this repository.

## Live verification

A post-repair probe executed through the full Hercules Browser path against `https://example.com/` and returned HTTP 200 with `ok: true`, the expected page title, URL, text, and link metadata.

This verification establishes that the operator bridge can execute real browser work through Hercules-owned browser infrastructure. It does not imply that an arbitrary third-party account is authenticated; account-bound actions still require a valid authorized session or provider credential.

## Source-of-truth rule

The migration in `supabase/migrations/20260927033800_hercules_browser_operator_bridge_v1.sql` must remain equivalent to the deployed production functions. Do not place browser credentials, service-role keys, passwords, cookies, or recovery material in repository source.
