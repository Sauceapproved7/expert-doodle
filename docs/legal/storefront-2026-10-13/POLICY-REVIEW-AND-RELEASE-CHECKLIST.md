# SauceApproved legal policy repair — owner/qualified review checklist

**Prepared:** October 13, 2026  
**Status:** Review packet only. No Shopify, DNS, prices, payout settings, subscriptions, entitlements, permissions or production pages are changed by this branch.

## Existing store policies checked via read-only Shopify Admin API

- Shopify primary domain: https://sauceapproved.com.
- Merchant contact email: smallzshon@gmail.com.
- Live Shopify **Shipping Policy** contains only `<p>Yes</p>`: not adequate as a meaningful shipping disclosure.
- Live Shopify **Legal Notice** contains only `<p>Yes</p>`: not meaningful; applicability and legally required details need a separate assessment.
- Live **Return and Refund Policy** has a 30-day physical merchandise return window but contains **[INSERT RETURN ADDRESS]**. It also promises a return label; provider capability is not verified.
- Live **Terms of Service** includes **[LINK]** placeholders and a Shopify merchant-instruction note; review the final cross-links and preserve required Shopify-platform language.
- The Shopify-generated Privacy Policy contains store-specific data and opt-out disclosures; verify actual advertising integrations, privacy choice routes, international-transfer mechanisms and contacts. Its displayed last-updated date differs from its API updated timestamp; check that before editing.
- These candidates deliberately do **not** insert an unconfirmed return address or universal production/shipping timeframe.

## Product boundary and existing repository terms

Existing, separate legal candidate documents are present at:
- `docs/legal/HERCULES-TITAN-TERMS-CANDIDATE-V1.md`
- `docs/legal/HERCULES-TITAN-PRIVACY-CANDIDATE-V1.md`
- `docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md`
- `docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md`
- `docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-TERMS-CANDIDATE-V1.md`
- `docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-PRIVACY-CANDIDATE-V1.md`

Do **not** conflate the:
1. physical merchandise **30-day** request window;
2. Titan **$49 one-time** access candidate with **7-day** refund-request candidate;
3. Studio Founding Pilot **$99 one-time** candidate with **7-day** refund-request candidate;
4. separately pending Studio **$29/$79/$199 per month** subscription catalog, including renewal/cancellation terms.

These are separate commercial products. No new price, paid-path verification, legal approval or billing activation is inferred here.

## Additional evidence from authenticated Shopify read-only check — October 13, 2026

- **Two configured delivery profiles:** General profile and a profile labeled "Standard: Printify Choice - International, Sweatshirt, Hoodie." These profiles contain configured shipping methods but do **not** establish actual rates for every checkout, accepted shipment deadlines, international legal coverage, or customer-visible delivery estimates.
- **Product evidence:** Two active physical hoodie products list the vendor **Printify**. This supports treating Printify as an integration to verify, not treating an integration label as proof of return acceptance or delivery service levels.
- **One visible merchant-managed Shopify location** fulfills online orders. It is **not** verified as a safe/public customer return destination, and its physical address must not be silently inserted into a published policy.
- **FTC shipment rule:** For most internet merchandise orders, fulfillment must have a reasonable basis for the advertised shipment period or generally within 30 days where none is promised. Delays require compliant consent/cancellation notices or refunds. Source: https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule.
- **Connecticut online return disclosure:** Connecticut General Statutes § 42-110aa requires the online refund/exchange policy to disclose refund form, return deadline, fees as dollar amount or percentage, and other conditions. Confirm whether regular exchanges are offered and settle a conspicuous final fee statement. Source: https://prdext2.cga.ct.gov/2025/pub/chap_735c.htm.
- **Missing operational proofs:** fulfillment provider's return-acceptance rules and label service, actual return destination, rates and shipping times by checkout market, customer delay-notice handling, approved refund fee schedule, and currently valid privacy opt-out pages.
- None of the read-only checks proves an end-to-end paid checkout, provider payout, fulfillment or refunds.

## Before authorizing publication

1. **Owner/qualified legal review:** Confirm registered legal entity wording, appropriate contact information, applicable service markets, required legal notice/registered address, nonwaivable consumer rights, tax/business data and privacy requirements.
2. **Operational verification:** Confirm actual POD/fulfillment partner, shipping zones and costs, handling time, real returns destination, label policy, tracking, refunds and practical support process.
3. **Data verification:** Confirm Shopify and active marketing integrations, cookie/consent controls, opt-out behavior, processor list, retention/deletion request processes and any international transfers.
4. **Product-specific review:** Retain separate Hercules/Titan/Studio terms, entitlement promises, trial/one-time/subscription distinctions, applicable refund rules, AI output disclaimers and source-code ownership statements.
5. **Link QA:** Replace all merchant placeholders such as `[LINK]` and `[INSERT RETURN ADDRESS]` with actually tested destinations. Do not put a personal residence into the public policy without conscious approval.
6. **Express approval:** Obtain and record a decision on the exact final document versions before updating the Shopify policy objects or production legal pages. No silent approval from “go” or a merge.
7. **Release QA:** After authorized publication, verify each public policy URL, footer/checkout links, headings and mobile rendering; compare the published body against its approved version.

**Safety constraint:** This branch is a proposal, not a production cutover. Do not merge/publish these exact documents as legally effective without step 6.
