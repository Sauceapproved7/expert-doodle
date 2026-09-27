# Hercules Browser Personal Session Handoff v1

Date: 2026-09-27

## Purpose

Define the safe handoff between the owned Hercules Browser and an explicitly connected personal browser session when a site requires the owner's existing authenticated session, MFA, or provider-controlled human verification.

## Routing

1. Hercules Browser remains the default browser execution path.
2. A personal-session browser is eligible only when Hercules Browser is unavailable, incompatible, incapable of the required action, or the provider requires an already-authenticated owner session.
3. Personal-session routing is never automatic. The owner must explicitly connect/authorize that browser session.
4. The fallback reason must be preserved in execution evidence.

## Credential boundary

Hercules must never copy, export, persist, replay, or expose:

- passwords;
- browser cookies;
- session cookies;
- MFA/2FA secrets or one-time codes;
- credential-manager contents;
- provider session tokens.

The personal browser remains the credential holder. Hercules may operate only through the permissions and session state that the connected browser/provider exposes.

## Human verification boundary

CAPTCHA, Cloudflare verification, MFA, identity verification, consent, and provider security controls are not bypassed. When one is encountered, execution stops at that boundary and preserves enough non-secret context to continue after the owner completes the provider-approved step.

## Resume behavior

After the provider accepts the authenticated session or human verification, Hercules may resume the requested workflow through the connected browser or return to the owned Hercules Browser when the target action no longer depends on personal-session state.

No secret material is transferred between the personal browser and the Hercules Browser control plane.

## Enforcement

The canonical execution contract and browser-routing policy encode these constraints. Repository tests fail if the explicit-session or no-export/no-bypass boundaries are removed.
