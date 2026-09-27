# Hercules Organic Acquisition System v1

**Status:** Active for organic execution. Paid acquisition remains off.  
**Primary offer:** Hercules Revenue Recovery — Founding Pilot  
**Primary CTA:** Request a controlled founding pilot.

## Objective

Create a repeatable path from public proof to a measurable founding-pilot request without exposing internal operating material or relying on paid traffic.

## Initial channels

| Channel | Motion | Cadence | Attribution |
| --- | --- | --- | --- |
| LinkedIn | Founder/product proof post | Weekly | `utm_source=linkedin&utm_medium=organic_social` |
| YouTube | Proof walkthrough | Weekly | `utm_source=youtube&utm_medium=organic_video` |
| Short video | Vertical proof cuts | 2/week | `utm_source=short_video&utm_medium=organic_social` |
| X | Proof thread | Weekly | `utm_source=x&utm_medium=organic_social` |
| SEO | Problem/solution article | Weekly | `utm_source=seo&utm_medium=organic_search` |
| Partner referral | One-workflow pilot introduction | Ongoing | `utm_source=partner_referral&utm_medium=referral` |
| Targeted outbound | Small named-account sequence | Bounded | `utm_source=targeted_outbound&utm_medium=direct_outreach` |

Default campaign: `founding-pilot-organic-v1`.

Use `utm_content` for the concrete asset identifier, for example `build-receipt-001`, `approval-financial-ai`, or `founding-pilot-invite`.

## Weekly proof engine

One verified Hercules proof event becomes:
1. a LinkedIn founder/product proof post;
2. a YouTube walkthrough;
3. two short vertical proof cuts;
4. an X proof thread;
5. an SEO article;
6. a reusable sales proof asset;
7. a Trust Center, Build Receipt, or Failure File update when applicable.

The content is derived from public-safe product behavior and published proof. Internal operating material is not a content source.

## First content sequence

1. Why overdue invoices are not all the same.
2. Build Receipt #001 — three receivables, three safe routes.
3. Why human approval belongs in financial AI workflows.
4. Failure File #001 — what happens when evidence conflicts.
5. Hercules Gauntlet #001 — a messy receivables case with visible evidence.
6. Founding-pilot invitation.

## Lead capture

Every channel uses the same destination: the Hercules public launch surface and its **Founding Revenue Recovery Pilot** form.

The form writes server-side into protected `marketing_contacts`. Browser clients do not receive direct table access.

## First-touch attribution

The launch surface persists one first-touch acquisition packet:
- source;
- medium;
- campaign;
- content;
- attribution ID.

UTM parameters override defaults on the first attributed visit. That packet is reused for landing, proof, pilot-request, and first-verified-useful-action events in the same browser.

The pilot contact record stores the acquisition identifiers in protected server-side fields/metadata so a request can be traced back to the originating motion without exposing customer data publicly.

## Measurable funnel

The protected aggregate view `hercules_organic_acquisition_funnel_v1` reports by day/source/medium/campaign/content:
- landing views;
- product-open CTA events;
- proof demo starts;
- pilot requests;
- first verified useful actions.

The view is revoked from `anon` and `authenticated`; only service-role access is granted.

## Operating rule

For every published asset:
1. assign one channel;
2. use campaign `founding-pilot-organic-v1`;
3. give the asset one stable `utm_content` identifier;
4. use the founding-pilot CTA;
5. inspect funnel movement after distribution;
6. keep, revise, or stop the motion from observed conversion evidence.

## Outbound boundary

Targeted outbound remains small and account-specific:
qualified account → relevant role → marketing/jurisdiction check → personalized message → limited follow-up → suppression/opt-out → outcome.

No mass spam.

## Paid acquisition gate

Paid acquisition remains **disabled** until the existing evidence gates are satisfied: measured activation, an actual paid conversion, observable retention, trustworthy attribution/billing, and ready claims/legal/privacy surfaces.
