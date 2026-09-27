# Hercules Launch Owner Decision Center v1

Date: 2026-09-27 UTC

## Purpose

Put the remaining owner-bound launch decisions in one authenticated Hercules surface without allowing automation to make those decisions on the owner's behalf.

The decision center is intentionally separate from the technical launch machinery.

## Decisions

The center reads the four existing launch approvals:

- pricing;
- terms;
- privacy;
- auth hardening.

Pricing, Terms, and Privacy remain pending until the owner explicitly reviews the prepared document and types the exact confirmation phrase in the authenticated Hercules Integrations UI.

The UI supports resetting an approval back to pending.

## Authentication hardening

`auth_hardening` cannot be approved from this decision center.

The current production Supabase security advisor still reports leaked-password protection disabled. That platform setting must be enabled and independently verified before the auth approval can be recorded.

This prevents a button click from substituting for required security evidence.

## Audit and launch gate

Every owner decision writes an audit record containing:

- approval type;
- decision status;
- document reference;
- confirmation-verification marker;
- authenticated owner identity.

After a decision is written, Hercules requests a fresh launch-gate evaluation. A launch approval does not open public registration.

## Final release boundary

The existing `public-registration-open` continuity-ledger switch remains independent and held closed.

Even if pricing, Terms, Privacy, and auth hardening eventually pass, general public registration still requires the separate explicit release action after final verification.

## Safety properties

- owner role is required for launch decisions;
- admin role cannot approve owner-bound launch decisions;
- no decision is inferred from chat text;
- authentication hardening is evidence-gated, not owner-click-gated;
- public release is not coupled to commercial approval;
- no credential or secret value is stored in launch-approval evidence.
