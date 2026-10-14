# Hercules Marketing Command v1 — owned review-only control console

## Purpose
Original SauceApproved enterprise LLC marketing-intelligence front end and deterministic safety engine. Extends existing docs/growth/HERCULES_GROWTH_ENGINE_V1.md, hercules-forge/ad-studio/, and sauceapproved-studio/campaign-forge/. It does not replace them. No direct Shopify, analytics, social posting, email, LLM or paid ads API is connected.

## Run
Serve the hercules-marketing-command/ folder with a static HTTPS server. Browser requires ECMAScript modules; no credentials, external assets, tracking, telemetry or dependency install. index.html loads app.mjs and engine.mjs. CSP blocks remote connections and form submissions, while noindex discourages indexing. A public static preview is not authentication.

## Implemented
1. Segmented campaign briefs for apparel, Forge, Studio, Titan and Gatehouse.
2. Channel planning for organic search/social, email, business outreach, affiliates and paid-draft channels.
3. Required claim and supporting-evidence entry, independent of actual proof verification.
4. Red-team copy flags for third-party endorsements, unverified guarantees, testimonials, pricing and scarcity claims.
5. Four consistent creative plans (hero, Reel, square, Story), with one audience, promise and CTA. Generates no media and publishes nothing.
6. UTM tracking URLs pinned to SauceApproved HTTPS owned destinations.
7. Break-even per-order and contribution calculators with finite numeric validation.
8. Evidence-sourced Opportunity Radar. Rankings remain unverified hypotheses, not measured demand.
9. Local, explicit draft JSON export. No personal customer information, server database or background jobs.

## Explicitly not implemented
- No ShopifyQL read adapter, checkout test, verified paid order, receipts, current paid campaign revenue, channel ad APIs or live platform permissions.
- No automatic publishing, real video generation, social posting, creator outreach, email delivery, customer lead capture, permission grant, identity verification or advertising spend.
- No Smallz or Studio production route integration and no independent verification of claims merely because an operator types a proof string.
- No NASA, SpaceX or DARPA affiliations, endorsements, proprietary software, brand assets or marks.

## Safety and privacy
- Review-only by construction: publicationAllowed=false, automaticSpendAllowed=false, automaticOutreachAllowed=false regardless of user-supplied approval flags.
- Email and business outreach drafts require an explicit lawful contact-basis flag before human review; this is NOT a validated consent record.
- Unsubstantiated red-team claim flags, invalid/overlength input and non-owned tracking URLs block review readiness.
- No external requests are sent. No persistent browser data is stored. The explicit draft export is user-operated.
- Never put secrets, private customer records or personal identifiers into the form; public preview is not private.
- Paid expansion requires separate authenticated, authorized, audited and budget-capped services with owner-only grants intact.

## Acceptance tests and validation
Test-first RED GitHub Actions run at PR #1058 head a73e2e504f5985395902f34946bb16899da3e4bb, job 115709125833, failed with the intentionally missing engine ERR_MODULE_NOT_FOUND. After adding implementation, run:

    node --test tests/hercules-marketing-command.test.mjs tests/hercules-marketing-command-ui.test.mjs
    node scripts/verify-hercules-execution-contract.mjs
    node scripts/verify-owner-code-only.mjs
    node scripts/security-baseline.mjs

CI result on exact release head is the evidence; test passes are not proof of a real live Shopify order or an authorized campaign.

## Next increments (not shipped)
- Privacy-aware read-only ShopifyQL aggregate data and verified attribution.
- Studio creative render adapter, original assets, and independently checked claims.
- Authorized channel scheduling with consent-aware recipient records and emergency stop.
- Bounded ad-spending envelope, proof and rollback.
- Public competitive intelligence and anomaly-defense monitoring.
These features must be independently implemented, tested, integrated and reviewed.

## Provenance and ownership
First-party SauceApproved original code/design created with AI assistance. Node standard modules, browser APIs and CSS only. No copied third-party source, NASA/DARPA/SpaceX marks, assets, weights or packaged dependencies. Existing repository LICENSE, owner-code policy and IP_PROVENANCE.md remain authoritative. Render hosting, when used, remains external infrastructure.
