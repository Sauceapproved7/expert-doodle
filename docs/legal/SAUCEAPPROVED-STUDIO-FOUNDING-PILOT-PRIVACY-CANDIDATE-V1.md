# SauceApproved Studio Founding Pilot Access — Privacy Candidate v1

**Status:** FINAL CANDIDATE — OWNER/QUALIFIED REVIEW REQUIRED BEFORE EFFECTIVE DATE  
**Company:** SauceApproved enterprise LLC  
**Product:** SauceApproved Studio — Founding Pilot Access

This candidate describes the intended privacy model for the Studio Founding Pilot. It is not effective until SauceApproved enterprise LLC affirmatively approves and publishes it through the authenticated Hercules owner approval path.

## 1. Scope

This policy is intended to cover information processed when a customer:
- visits the Studio or Founding Pilot product surface;
- purchases or activates Studio Founding Pilot Access;
- creates or uses a SauceApproved account or Studio workspace;
- uses Studio creative workflows or Hercules-powered features;
- creates, imports, saves, or exports projects;
- contacts support;
- claims an eligible SoundWorld launch gift;
- uses payment, refund, or entitlement features.

It does not govern a third party's independent website or service.

## 2. Information we may process

### Account and identity information

Examples include email address, account identifier, authentication/session information, workspace membership, role, and authorization evidence.

### Studio project information

Examples include project names, briefs, storyboard state, prompts, instructions, reference assets, generated or transformed content, continuity data, project settings, entitlement state, and product configuration.

### Support, security, and audit information

Examples include support messages, approval history, integrity evidence, authentication and authorization events, security events, release evidence, service-health information, and incident records.

### Usage and technical information

Examples include feature usage, request timestamps, usage counters, logs, latency, errors, device/browser information, and network information made available by infrastructure providers.

### Billing and Shopify order information

If paid billing is activated, SauceApproved may receive customer, Shopify order, payment-status, refund, reversal, and entitlement-state identifiers needed to verify the purchase and operate access.

Raw payment-card details should remain with **Shopify and its approved payment processor** rather than be stored directly by SauceApproved unless the production architecture is explicitly changed and reviewed.

### SoundWorld gift information

If a customer qualifies for and claims the launch gift, SauceApproved may process the selected gift type, eligibility state, claim state, and purchase linkage.

Physical fulfillment may later require recipient and shipping information. That information should be collected only when needed through an approved fulfillment flow and should not be treated as required for the digital Studio purchase unless the customer separately enters the fulfillment process.

## 3. How information is used

Information may be used to:
- provide and operate SauceApproved Studio;
- authenticate users and enforce permissions;
- provide project, planning, evidence, continuity, and AI-assisted workflows;
- save and restore project state;
- enforce purchase and entitlement state;
- verify Shopify order, refund, and payment state;
- operate the SoundWorld eligibility and claim workflow;
- secure the product and investigate abuse or incidents;
- maintain audit, provenance, recovery, and release evidence;
- provide support;
- comply with legal obligations;
- improve supported Studio features as permitted by applicable law and the final customer agreement.

## 4. AI and processing providers

Studio may route selected customer inputs to approved AI or processing providers when a customer invokes provider-dependent features.

Provider-specific terms, data handling, retention, and training practices may differ. SauceApproved should not claim a universal provider policy unless it has been verified.

Provider-dependent features remain fail-closed when the required provider is not connected or authorized.

Before this policy becomes effective, the final active provider list and material data flows must match production.

## 5. Infrastructure and subprocessors

Verified or intended Founding Pilot infrastructure may include:
- **Shopify** — storefront checkout, order state, payment-status integration, refunds, and purchase records;
- **Supabase** — authentication, database, protected entitlement state, audit/evidence records, serverless functions, and release controls;
- **Render** — hosted SauceApproved Studio public/runtime surfaces where used;
- **GitHub** — source control, CI/security/provenance checks, and release evidence;
- approved AI or media-processing providers when a customer invokes features that require them;
- an approved fulfillment provider if and when a physical SoundWorld gift is shipped.

The final published policy must reflect providers actually active in production.

## 6. Payment and entitlement processing

A Founding Pilot purchase is a separate one-time Shopify offer.

The $29/$79/$199 monthly Studio subscription catalog is a different commercial system and is not automatically activated by this purchase.

SauceApproved should store only the billing/order identifiers and state needed to verify payment, refunds, entitlement, fraud controls, support, and audit evidence. Raw card details should remain with Shopify and its payment processor.

A customer-supplied receipt, screenshot, or order number alone does not establish entitlement. Hercules uses authenticated Shopify order facts and the protected entitlement ledger.

## 7. SoundWorld launch gift

The SoundWorld promotional gift is separately eligibility-gated.

The gift system may process an opaque purchase key, provider/order identifier, product code, hashed buyer-email identity, selected gift, eligibility timestamp, and claim state.

Raw buyer email should not be duplicated into the gift-eligibility ledger when a privacy-minimized hash is sufficient.

Shipping information, if later needed for a physical gift, should be collected only through an approved fulfillment workflow.

## 8. Data retention

Retention depends on the information type, product function, customer relationship, legal requirements, security needs, fraud-prevention needs, billing/audit obligations, and active provider behavior.

SauceApproved should not publish a universal retention period unless production behavior actually enforces it.

Customers may request account or data deletion through the supported privacy/request process, subject to records that must be retained for legal, security, fraud-prevention, billing, refund, or audit reasons.

## 9. Security

SauceApproved uses technical and operational measures intended to reduce risk, including authentication, authorization, protected service credentials, fail-closed execution, release gates, monitoring, provenance checks, and recovery systems.

No security measure can eliminate all risk.

## 10. Customer responsibilities

Customers should not submit information that is unnecessary for their intended workflow.

Customers are responsible for ensuring they have authority to provide personal information, media, client data, trademarks, likenesses, voices, business records, or other content they submit.

## 11. Privacy rights

Depending on applicable law and the location of the customer or data subject, rights may include access, correction, deletion, portability, restriction, objection, or appeal.

The final policy must identify a monitored method for privacy requests and match the production request-handling process.

## 12. Children's data

Studio Founding Pilot Access is a creator/business software offer and is not directed to children.

The separately designed Kids Studio experience does not create child accounts through the Founding Pilot checkout. Customers must not knowingly use Studio to collect or process children's personal information in violation of applicable law.

## 13. International and regional processing

Infrastructure or subprocessors may process information outside the customer's state or country.

The final published policy must include any jurisdiction-specific disclosures required for the markets where the Founding Pilot is actually offered.

## 14. Changes and contact

The final published policy must state its effective date and explain how material changes are communicated.

Privacy and support requests should use a monitored SauceApproved business channel or in-product request center.

---

## Owner packet decision

Approving the SauceApproved Studio Founding Pilot commercial packet approves this Privacy candidate together with the matching Founding Pilot Terms candidate and the $99 one-time commercial configuration.

It does **not** approve the separate monthly Studio subscription catalog, Stripe Direct, payment-path verification, product publication, or any unrelated offer.
