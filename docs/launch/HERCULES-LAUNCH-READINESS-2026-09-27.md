# Hercules Launch Readiness — 2026-09-27

## Executive state

Hercules has passed the current technical launch gate. General availability remains intentionally blocked by commercial/legal/authentication approvals and paid-billing configuration.

Latest verified production launch gate:
- technical_ok: true
- commercial_ok: false
- launch_ready: false
- checked_at: 2026-09-27T03:19:52.793709Z

## Technical launch evidence

### DevBrain fabric

Latest live DevBrain check passed at 2026-09-27T03:18:36.610526Z.

- AI: pass through LLM7
- Browser: pass through the owned Hercules Browser control surface
- WASM: pass
- overall: pass

The browser check was repaired after the production worker cut over from a direct Browserless endpoint to the Hercules Browser gateway. The repaired probe now exercises the live Hercules Browser path rather than a provider-specific health URL.

### Production SLOs

Latest evaluation at 2026-09-27T03:20:00.212295Z:

- attestation coverage: 1.00 / target 1.00 — pass
- command success: 1.00 / target 0.95 — pass
- critical probe coverage: 1.00 / target 0.90 — pass
  - 16 Tier-0 services registered
  - 16 conclusive Tier-0 probes inside the calibrated 45-minute sweep window
- critical service health: 1.00 / target 1.00 — pass
  - 9 conclusive Tier-0 probes inside the 15-minute health window
  - 7 probes were outside the shorter health freshness window and therefore treated as inconclusive, not failures
- release success: 1.00 / target 0.95 — pass

### Operations

- open service incidents: 0
- open security events: 0
- fresh failed DevBrain security events were resolved only after a newer live overall-pass check existed
- signed production release evidence remains present
- verified cross-region recovery evidence remains present

### Repository release controls

The following launch-path changes are merged to main:

- pre-launch certification v0.1
- production operations readiness v0.1
- customer foundation v0.1
- Revenue Recovery product v0.4
- launch hardening v0.1
- launch pack v0.1
- critical probe SLO calibration and evaluator correction
- DevBrain browser fabric repair
- draft Terms of Service
- draft Privacy Policy
- owner launch approval packet

The DevBrain browser repair passed:
- focused browser contract tests
- Hercules Security Baseline
- Provenance Gate
- Hercules Owner Code Gate
- CodeQL
- DeepSource secret scan

## Commercial and owner-bound blockers

The launch gate currently has four pending approvals:

1. pricing
2. terms
3. privacy
4. auth_hardening

These must not be marked approved without the corresponding owner decision or production evidence.

### Pricing mismatch requiring a decision

Current active production billing plans:

| Plan code | Name | Monthly | Annual |
|---|---|---:|---:|
| starter | Starter | $49 | $490 |
| pro | Pro | $149 | $1,490 |
| scale | Scale | $399 | $3,990 |

Current launch pricing proposal:

| Proposed plan | Monthly |
|---|---:|
| Starter | $99 |
| Growth | $249 |
| Scale | $599 |

The public offer and production billing configuration must be reconciled before pricing approval. Do not approve pricing while the plan names/prices disagree.

### Stripe activation

The deployed Stripe webhook currently reports:

- Stripe access credential configured: false
- Stripe webhook signing secret configured: false

A paid launch therefore requires Stripe/provider connection and webhook verification after pricing is finalized.

A non-paid/private beta can remain billing-disabled only if that is an explicit launch decision and the public product does not advertise active paid checkout.

### Terms of Service

Draft prepared at:

`docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md`

Still requires final owner/qualified review for:
- exact contracting entity
- receivables/collections-law scope
- liability
- indemnification
- governing law/disputes
- billing/cancellation/refund language
- support/legal contacts

### Privacy Policy

Draft prepared at:

`docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md`

Still requires final verification/approval for:
- actual production subprocessors
- AI-provider retention/training settings
- deletion/export workflow
- retention practices
- privacy contact
- launch-market disclosures
- payment-provider handling once billing is enabled

### Authentication hardening

Supabase security advisor currently reports leaked-password protection disabled.

That setting remains a real blocker in the existing launch gate. The connected Supabase automation surface does not expose the required hosted Auth configuration mutation.

Before approval:
1. enable leaked-password protection in Supabase Auth for the production project;
2. rerun the Supabase security advisor;
3. retain passing evidence;
4. only then approve `auth_hardening`.

## Final launch sequence

After owner-bound decisions are complete:

1. reconcile and approve final pricing;
2. configure Stripe if launch is paid;
3. finalize and approve Terms;
4. finalize and approve Privacy Policy;
5. enable and verify Supabase leaked-password protection;
6. configure monitored support, security, and privacy/legal contacts;
7. mark launch approvals only from verified evidence;
8. rerun the launch gate;
9. require both `technical_ok=true` and `commercial_ok=true`;
10. run one final first-customer smoke journey before opening unrestricted registration.

## Current conclusion

The engineering launch gate is green.

Hercules should not be labeled general-availability ready yet because the remaining blockers are business/legal/authentication/payment activation items rather than unresolved core technical failures.
