# Hercules Launch Owner Approval Packet v0.1

**Status:** PREPARED — owner decisions remain pending  
**Entity:** SauceApproved enterprise LLC  
**Launch product:** Hercules Revenue Recovery

This packet consolidates the remaining owner-bound launch decisions so they can be approved once, without reopening completed technical work.

## 1. Launch scope

### Proposed initial scope
Launch Hercules Revenue Recovery for businesses managing their own commercial receivables.

Proposed exclusions at launch:
- third-party debt collection;
- consumer credit reporting;
- legal services;
- guaranteed recovery claims;
- autonomous external collection activity without the existing approval/authorization gates.

**Owner approval required before public claims/Terms are finalized.**

## 2. Pricing

Canonical production-aligned catalog prepared for owner approval:
- Starter — $49/month; $490/year
- Pro — $149/month; $1,490/year
- Scale — $399/month; $3,990/year

Guardrails:
- no outcome-based collection fee at launch without legal/compliance review;
- no charge for unavailable capabilities;
- plan entitlements must be enforced server-side;
- payment-provider activation must match the public pricing page.

**Owner approval required before billing activation.**

## 3. Terms of Service

Prepared draft:
- `docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md`

Still requires owner/qualified review for:
- final liability cap;
- indemnification;
- governing law/venue/dispute terms;
- exact billing/cancellation/refund language;
- exact receivables/collections-law scope.

**Do not mark the launch approval `terms` as approved until the final text is affirmatively approved.**

## 4. Privacy Policy

Prepared draft:
- `docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md`

Still requires verification/approval for:
- production subprocessors that receive customer data;
- AI-provider retention/training settings;
- deletion/export workflow;
- retention practices;
- privacy contact;
- launch-market disclosures.

**Do not mark the launch approval `privacy` as approved until the final text matches production.**

## 5. Authentication hardening

Current production security advisor reports Supabase leaked-password protection disabled.

This is a real launch blocker in the existing Hercules launch gate.

The currently connected Supabase automation surface does not expose an auth-configuration action for enabling this setting.

**Owner/platform action required unless a verified programmatic management path becomes available.**

After enabling it:
1. re-run the Supabase security advisor;
2. record evidence;
3. only then mark `auth_hardening` approved.

## 6. Support and security contacts

Before unrestricted public registration, configure:
- monitored customer support contact;
- monitored security reporting contact;
- monitored privacy/legal contact or documented routing.

Do not publish the founder's personal address or personal email by default.

## 7. Formation/admin records

Parallel company-record items:
- retrieve official Connecticut Certificate of Organization and store it in the Hercules Vault;
- finish IRS business-name/EIN alignment as an administrative follow-up;
- execute/sign the Operating Agreement and IP Assignment only after final owner review.

These items must not be falsely represented as completed.

## Approval rule

The product may continue through technical launch preparation while these owner-bound items are pending.

General-availability launch must remain fail-closed until the existing launch gate has verified:
- pricing;
- terms;
- privacy;
- auth hardening.

No automated system should approve these on the owner's behalf without evidence of the required decision or configuration.
