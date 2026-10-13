# Hercules Cloud Founding Interest — free public campaign

**Purpose:** collect explicit consent to future updates about the Hercules Cloud software project. This is **not** the existing Hercules account registration, is not hosting access, and does not authorize checkout, payouts or public SaaS release. Price: **free ($0)**.

## Customer-facing deliverable
- Original responsive public landing `/founders.html` within separate static Hercules Cloud preview, with email-only interest and required opt-in.
- Link to the exact connected SauceApproved Shopify privacy policy on the provider's policy host.
- User explicitly chooses future software, self-hosting, or both, and agrees to updates.
- The success state says only **interest recorded / unverified**. It does not claim a confirmation email, an account, a paid order, or future hosting entitlement.

## Storage and consent restrictions
- New dedicated `public.hercules_cloud_founders` Postgres table; RLS enabled, no policies for anonymous/authenticated users, direct permissions revoked. Only the existing backend service role may select or insert.
- Email normalized lowercase and deduplicated. Store email, chosen interest category, consent timestamp, notice version, policy URL, initial source, status `unverified`.
- Service endpoint via Supabase Edge Function `hercules-cloud-founders`. Protected by `@supabase/server` `auth:'publishable'` (publishable API key authorization) and exact Origin check. The Edge platform `verify_jwt=false` is intentionally chosen because this is public interest without Hercules Auth account signup; the application handler enforces publishable-key authentication as documented at https://supabase.com/docs/guides/functions/auth and https://supabase.com/docs/guides/functions/auth-headers.
- No service role key is sent to the browser; the public publishable key is expected to be visible in frontend code and only identifies the project, not any subscriber identity.
- 200 new submissions/24h global cap plus case-normalized dedup, 2KiB JSON size limit and hidden honeypot. These protections are limited; they do not constitute CAPTCHA, anti-spam perfection, email address ownership verification or verified marketing consent.
- Because the intake has no confirmation email transport, **do not send marketing to unverified addresses**; connect a verified double-opt-in transport before sending marketing communications. Support opt-out/deletion requests through the connected SauceApproved contact information; no automatic customer account creation or messaging.
- Backend responds generically without echoing private email or allowing public lookup, enumeration or results export.
- No Shopify products, prices, checkout status, legal policy bodies or launch-gate approvals changed.

## Development and verification
```sh
node --test tests/hercules-cloud-founders.test.mjs tests/hercules-cloud-original-ui.test.mjs tests/hercules-cloud-control-plane.test.mjs
node scripts/build_hercules_cloud_preview.mjs
node scripts/verify-owner-code-only.mjs
```

## Restricted deployment order
1. Complete repository tests, CodeQL, security and provenance gates on exact branch head.
2. Apply **only** the additive isolated `hercules_cloud_founders_private_intake_v1` migration. Verify no public/anon/authenticated access to the table, service-role insert permission, and no existing public registration flag changed.
3. Deploy a new named Edge function with publishable-handler auth and `verify_jwt=false`, verify status, and ensure other functions remain unchanged.
4. Manually deploy **only** the existing `hercules-cloud-origin-preview` static site from this isolated branch or update that one site's branch after reviewing the deploy target. Keep auto-deploy disabled; do not change existing production MCP, Smallz or Studio services.
5. Smoke test CORS from allowed and disallowed origin, request validation, no-account/no-charge behavior. Do not create a fake paid order or synthetic public subscriber just to claim success.
6. Launch free founding campaign. Before any paid Cloud offer, approve definite licensed software deliverable, final price, download fulfillment, legal/refund terms, checkout and transaction verification.

## Cost and release limitations
The campaign uses already connected Render static hosting and Supabase project. It creates no subscription or new paid service, but real usage of either provider still consumes metered quotas and may incur charges if account limits are exceeded. Live hosting, generative AI, multi-tenant PaaS, paid entitlements and account registration remain separate and not released here.

**Hercules:** SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.
