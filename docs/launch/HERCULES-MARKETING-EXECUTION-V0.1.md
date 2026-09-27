# Hercules Marketing Execution v0.1

Date: 2026-09-27
Product: Hercules Revenue Recovery
Entity: SauceApproved enterprise LLC
Status: IMPLEMENTATION READY — general availability remains release-gated

## Launch promise

**Recover cash. Keep control. Prove every action.**

Platform category: **Verifiable Autonomous Software**.

## P0 launch-readiness implementation

1. **Revenue Recovery landing page** — implemented in `supabase/functions/hercules-launch/index.ts`.
2. **Proof demos** — 60–90 second synthetic interactive proof plus a five-minute workflow walkthrough are included on the public launch surface.
3. **Trust / security / privacy / legal surfaces** — Trust Center skeleton and security section are public; Terms and Privacy remain explicitly early-access/draft pending owner/qualified review.
4. **Synthetic demo dataset** — three invoice cases cover routine overdue, disputed, and promised-payment conditions without using customer data.
5. **Pilot / contact path** — founding-pilot intake records requests server-side into the existing protected marketing-contact store. The browser cannot write that table directly.
6. **Activation analytics** — launch CTA, proof-demo, pilot, and first_verified_useful_action events are written server-side to the protected marketing-events store.
7. **Sales brief + FAQ** — canonical launch brief and objection handling live in `HERCULES-SALES-BRIEF-FAQ-V0.1.md`.
8. **Controlled distribution** — organic, outbound, and partner execution is defined in `HERCULES-DISTRIBUTION-RUNBOOK-V0.1.md`.

## Safety / claims boundary

Initial market:
- U.S. businesses managing their own commercial receivables.

Not offered at this stage as:
- consumer debt collection;
- third-party debt collection;
- credit scoring;
- debt purchasing;
- legal collections;
- guaranteed recovery;
- uncontrolled autonomous collection.

Consequential external actions remain approval-gated.

## Core funnel

Impression -> qualified visit -> proof viewed -> pilot/sign-in intent -> workspace -> first case -> first verified useful action -> paid -> retained -> referred.

Primary activation event:

`first_verified_useful_action`

## Launch release rule

The marketing surface may ship while public registration stays closed. General availability remains fail-closed until the existing launch gate has verified required pricing, terms, privacy, authentication hardening, and explicit public-release approval.


## Provenance note

The pull request carries the repository-required provenance attestation checklist. No third-party code is added by this marketing launch increment.
