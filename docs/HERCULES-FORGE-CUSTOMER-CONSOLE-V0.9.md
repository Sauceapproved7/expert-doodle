# Hercules Forge Customer Console v0.9

## Purpose

v0.9 makes the Forge Builder Console usable through customer sessions instead of the privileged owner control token.

The default Forge UI is now the customer console. The existing owner/operator console remains available separately under `/operator`.

## Routes

Customer-facing UI:

- `/`
- `/console`
- `/customer-console.css`
- `/customer-console.js`

Owner/operator UI:

- `/operator`
- `/operator.css`
- `/operator.js`

The customer HTML does not contain the Forge owner control token field.

## Customer flow

The customer console supports:

- email/password sign-in
- session restoration through the HttpOnly Forge session cookie
- CSRF token rotation after reload
- workspace selection
- workspace-scoped project listing
- prompt-to-project creation
- prompt-driven revisions
- preview start/status/stop
- publish controls for owner/admin roles
- rollback controls for owner/admin roles
- logout

The server remains the source of truth for role enforcement. Hiding controls in the browser is only a usability layer.

## Session and CSRF behavior

`GET /v1/session/csrf` rotates the CSRF token for an existing authenticated session.

This allows a page reload to recover a usable CSRF token without storing it in Local Storage, Session Storage, cookies, or the HTML document.

Rotating CSRF invalidates the previous CSRF token immediately.

## Role-aware console behavior

- `viewer`: browse projects and revisions
- `builder`: viewer capabilities plus build, revise, and preview
- `admin`: builder capabilities plus publish and rollback
- `owner`: same product controls as admin, with canonical ownership at the authorization layer

## Security boundary

- The customer console never asks for or receives the Forge control bearer token.
- Session cookies remain HttpOnly and SameSite=Strict.
- CSRF tokens live only in runtime memory in the browser.
- Customer project requests use the workspace-scoped v0.8 API.
- The server re-checks workspace membership, role, and project/workspace binding on every protected route.
- The operator console remains separate under `/operator`.

Production public deployment still requires TLS, secure cookies, rate limiting, account recovery, email verification, audit logging, and hardened execution isolation for arbitrary customer code.

## Owned-code boundary

The customer console, operator console, identity/session layer, workspace authorization, project/revision store, compiler, artifact verification, preview, and release control remain repository-controlled Hercules Forge source. No hosted builder owns the product workflow.
