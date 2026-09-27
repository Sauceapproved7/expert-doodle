# Hercules Explicit Public Release Gate v0.1

Date: 2026-09-27 UTC

## Purpose

Passing the technical and commercial launch gates must not automatically open unrestricted public registration.

The final customer smoke journey is intentionally performed before public signup is opened. Public release therefore needs a separate, explicit owner-controlled switch.

## State model

Hercules now uses two distinct launch states:

1. `launch_ready` — technical + commercial readiness.
2. `public-registration-open` — explicit release authorization.

New public account onboarding requires **both** states to be true.

The release switch is stored in the Hercules continuity ledger and is seeded closed:

- key: `public-registration-open`
- status: `held`
- value: `{"open":false}`

## Product-surface behavior

The Hercules launch surface enables **Create account** only when:

- the latest launch gate reports `launch_ready=true`; and
- the explicit public registration switch is open.

Otherwise the surface remains **Early access — sign-in only**.

## Server-side enforcement

`hercules_bootstrap_organization()` independently requires the same two conditions before provisioning a new public workspace.

Existing active members may continue using Hercules.

The isolated synthetic onboarding certification path remains available so the final customer journey can be tested while the public release switch is still closed.

## Release procedure

After pricing, Terms, Privacy, Auth hardening, payment setup (for a paid launch), and the final customer smoke journey are verified:

1. owner explicitly authorizes public release;
2. set the continuity-ledger release switch to active / open;
3. re-read the launch surface and launch gate;
4. verify Create account is enabled;
5. retain release evidence.

The switch must not be opened automatically merely because other launch approvals pass.
