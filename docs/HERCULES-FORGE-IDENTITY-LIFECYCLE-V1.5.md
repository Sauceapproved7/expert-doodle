# Hercules Forge Identity Lifecycle v1.5

## Purpose

v1.5 adds invite-only onboarding and password recovery to Hercules Forge without enabling unrestricted public signup or coupling the product to a specific email provider.

The lifecycle is repository-controlled Hercules source. Message delivery is a replaceable external infrastructure boundary.

## Invite-only onboarding

Workspace owners/admins can invite a new user through:

- `POST /v1/workspaces/:workspaceId/invites`

The owner control plane can invite through:

- `POST /v1/admin/workspaces/:workspaceId/invites`

Allowed invite roles:

- `admin`
- `builder`
- `viewer`

`owner` is intentionally excluded from the invite role set.

The API response contains invite metadata but never returns the one-time invite token.

## Invite storage and delivery

Invite tokens are generated from 32 random bytes and stored only through a SHA-256-derived lifecycle path.

The persisted invite record contains:

- invite ID
- normalized email
- workspace ID
- role
- creation time
- expiry time

It does not contain the raw invite token.

The one-time token is sent only to the configured notification adapter.

If delivery fails, Forge revokes the token before returning a delivery failure.

## Invite links

Lifecycle links use URL fragments:

```text
https://forge.example/#invite=<one-time-token>
```

The fragment is not part of the initial HTTP request and is not sent as a referrer.

The customer console:

1. reads the fragment in browser memory;
2. immediately removes it with `history.replaceState`;
3. asks the invited user to set a password;
4. submits the token directly to `POST /v1/invites/accept`;
5. automatically signs the new user in after successful acceptance.

The token is not written to localStorage or sessionStorage.

## Recovery request

Public recovery request:

- `POST /v1/recovery/request`

For syntactically valid email input, the endpoint returns the same accepted response whether or not an account exists:

```json
{"accepted":true}
```

This prevents direct account-existence disclosure through the response body/status.

Production enables a dedicated recovery-request limiter. Defaults:

- 3 requests
- per normalized email
- per 60-minute window

A blocked request returns HTTP 429 with `Retry-After`.

## Recovery delivery

For an existing account Forge creates a one-time recovery token and sends:

```text
https://forge.example/#recovery=<one-time-token>
```

The stored recovery record contains only recovery ID, user ID, creation time, and expiry time.

If delivery fails, the recovery token is revoked. The public endpoint still returns the generic accepted response; the failed delivery is recorded in the security audit.

## Recovery completion

Public completion endpoint:

- `POST /v1/recovery/complete`

On success Forge:

1. validates and consumes the one-time token;
2. derives a new password using the hardened `scrypt-v2` profile;
3. updates `passwordUpdatedAt`;
4. revokes every existing session for that user;
5. records an `identity.recovery.complete` audit event.

The customer console then signs in using the new password.

## Password and identity storage

v1.5 preserves the hardened identity controls already on `main`:

- scrypt-v2 with explicit work factors;
- backward-compatible scrypt-v1 verification and upgrade;
- 0600 identity/session/lifecycle files;
- opaque session tokens stored only by hash-derived filename;
- CSRF protection;
- secure production cookies;
- malformed cookie/path input fails closed.

Operator-created users remain treated as administratively verified. Invite-created users receive `emailVerifiedAt` when the delivered invitation is accepted.

## Notification adapter boundary

Forge exports:

- `ForgeNotificationAdapter`
- `HttpForgeNotificationAdapter`
- `MemoryForgeNotificationAdapter` for tests/local fixtures

Production configuration:

- `FORGE_NOTIFICATION_URL`
- `FORGE_NOTIFICATION_TOKEN` (optional provider credential)
- `FORGE_RECOVERY_MAX_REQUESTS`
- `FORGE_RECOVERY_WINDOW_MS`

Remote production notification endpoints must use HTTPS. Plain HTTP is accepted only for loopback endpoints.

The HTTP adapter:

- rejects embedded URL credentials;
- disables redirects;
- uses bounded timeouts;
- bounds response size;
- does not expose the provider credential in the safe production summary.

## Audit events

v1.5 adds lifecycle events to the v1.4 tamper-evident audit chain:

- `identity.invite.create`
- `identity.invite.accept`
- `identity.recovery.request`
- `identity.recovery.complete`

Audit records never contain invite tokens, recovery tokens, passwords, session cookies, CSRF values, notification-provider credentials, or the Forge control token.

Recovery-request audit correlation uses the existing normalized-email SHA-256 value.

## Customer Builder Console

The customer console now provides:

- Forgot password from the sign-in screen;
- invite acceptance from a fragment link;
- recovery completion from a fragment link;
- automatic sign-in after successful invite/recovery completion;
- workspace owner/admin invite controls.

The “forgot password” message remains generic:

```text
If that account exists, a recovery link has been sent.
```

## Production fail-closed behavior

Identity lifecycle creation routes require both:

- a configured notification adapter;
- a configured public origin.

Without them, invite/recovery issuance returns HTTP 503 rather than creating undiscoverable one-time credentials.

Invite acceptance and recovery completion remain available for already-issued unexpired tokens.

## Current boundary

v1.5 intentionally remains invite-only.

It does not claim:

- unrestricted public signup;
- multi-factor authentication;
- externally anchored token revocation evidence;
- multi-process transactional lifecycle-token consumption;
- guaranteed email deliverability;
- immunity to timing side channels at the network/provider level.

The current local identity store serializes lifecycle mutation in-process. A future transactional identity backend can provide multi-writer atomic token consumption without changing the API contract.
