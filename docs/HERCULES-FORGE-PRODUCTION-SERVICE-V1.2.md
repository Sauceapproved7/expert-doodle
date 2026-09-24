# Hercules Forge Production Service v1.2

## Purpose

v1.2 adds the first fail-closed production service entrypoint for Hercules Forge without introducing a third-party application framework, hosted-builder dependency, package manager dependency, or committed Dockerfile.

The Forge application/control plane remains repository-controlled Hercules source. Node.js, TLS termination, process supervision, networking, and the host itself remain replaceable infrastructure and are not represented as Hercules-owned code.

## Production entrypoint

Run:

```sh
node hercules-forge/production-cli.mjs
```

The production CLI delegates to `startForgeProductionService()` and prints only a safe startup summary. It never prints the control token or interpreter token.

Production startup fails closed unless all required security and persistence settings are valid.

## Required production configuration

Required:

- `FORGE_ROOT`: persistent Forge state directory
- `FORGE_CONTROL_TOKEN`: owner/operator bearer credential, minimum 32 characters in production
- `FORGE_PUBLIC_ORIGIN`: canonical HTTPS origin such as `https://forge.example.com`

Optional:

- `FORGE_HOST`: bind host, default `0.0.0.0`
- `FORGE_PORT` or platform `PORT`: bind port, default `38700`
- `FORGE_DATA_MAX_BYTES`: per-project runtime-data quota
- `FORGE_LOGIN_MAX_FAILURES`: failed login threshold, default 8
- `FORGE_LOGIN_WINDOW_MS`: failed-login window, default 300000 ms
- `FORGE_INTERPRETER_URL`: prompt interpreter endpoint
- `FORGE_INTERPRETER_TOKEN`: optional interpreter credential

Remote interpreter traffic must use HTTPS. Plain HTTP is accepted only for loopback interpreter endpoints.

## Session security

Production mode always starts Forge with:

- HttpOnly session cookies
- SameSite=Strict
- Secure cookies
- explicit production service mode
- canonical public-origin metadata

Customer sign-in now supports an injected `ForgeLoginRateLimiter`.

The production runner enables it by default. Repeated failed credentials are limited per normalized email identity. Successful authentication clears the failure counter. A blocked request returns HTTP 429 with `Retry-After`.

The local development CLI keeps its existing behavior and does not silently inherit production assumptions.

## Persistence

`FORGE_ROOT` is mandatory in production because Forge state must live on persistent storage supplied by the deployment environment.

The production runner reuses the v1.1 runtime-data quota, verified snapshot, and atomic restore boundary. A hosting target may mount any durable filesystem at `FORGE_ROOT`; that host does not become the canonical source of project state or application source.

## Hosting boundary

The repository owner-code policy forbids committing a `Dockerfile`. v1.2 therefore does not weaken provenance policy to make deployment convenient.

A production host must provide:

1. a supported Node.js runtime;
2. durable storage for `FORGE_ROOT`;
3. TLS termination for `FORGE_PUBLIC_ORIGIN`;
4. secret injection for `FORGE_CONTROL_TOKEN` and any interpreter credential;
5. process supervision/restart;
6. inbound routing to the configured Forge port.

Those are external infrastructure responsibilities. They can be swapped without changing the Forge product source.

## Graceful shutdown

`production-cli.mjs` handles SIGTERM and SIGINT and closes the HTTP service cleanly. Closing the Forge control service also triggers preview shutdown through the existing preview manager close hook.

## Health

`GET /health` reports Forge v1.2 and includes:

- service mode
- configured public origin
- prompt-ingress availability
- preview availability
- persistent runtime availability
- runtime-data control availability
- configured runtime-data byte limit

It does not expose secrets.

## Current launch boundary

v1.2 makes Forge a provider-neutral production service process, but a public deployment is not claimed until an authorized infrastructure target actually starts it behind HTTPS with persistent storage.

For an initial private/invite-only deployment, existing operator-provisioned users and workspaces can be used without public registration.

Before unrestricted public signup, the remaining security roadmap still includes:

- email verification
- account recovery
- broader abuse controls
- security event/audit logging
- stronger execution isolation if Forge later accepts arbitrary customer code rather than only deterministic generated templates

## Ownership

v1.2 product code is covered by the repository owner-code gate:

- `hercules-forge/rate-limit.mjs`
- `hercules-forge/production.mjs`
- `hercules-forge/production-cli.mjs`
- updated `hercules-forge/control-api.mjs`

No third-party runtime package imports are introduced.
