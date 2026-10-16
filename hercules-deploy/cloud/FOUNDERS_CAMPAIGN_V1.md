# Hercules Cloud — Free Founding Interest v1

**Status:** Free, opt-in interest campaign. Not a Hercules public account registration, customer subscription, hosted application, payment checkout, or product entitlement.

## Customer experience

The original Hercules Cloud static preview adds `/founders.html`: a mobile-first founding-interest form that requests only email, interest category, and explicit marketing consent. It links the actual published SauceApproved Shopify Privacy Policy. The response records interest as **unverified**; it sends no email, grants no account/hosting access, and does not promise a release date. No price or card fields exist.

## Technical implementation

- `supabase/migrations/20261013152000_hercules_cloud_founders_private_intake_v1.sql` creates a dedicated table with email, consent time, interest, source, policy notice, status and timestamp. RLS is on. Anonymous and signed-in callers have **no direct SELECT or INSERT** on the table; only the existing service role is granted those table capabilities.
- `supabase/migrations/20261013155500_hercules_cloud_join_founders_rpc_v1.sql` adds **one intentionally public, narrow PostgREST RPC** `public.hercules_cloud_join_founders(text,boolean,text,text)`. It runs with fixed `pg_catalog, public` search path, checks explicit consent, validates/normalizes email, enforces allowed interest values, silently ignores honeypot requests, serializes submissions with a transaction-scoped advisory lock, caps total new interest records at 200 per rolling 24 hours, and inserts only unverified interest. Duplicate emails get the same response. Error responses never include subscriber email.
- The public browser posts to the project's existing `/rest/v1/rpc/hercules_cloud_join_founders` with its **publishable API key**; a publishable key identifies the project but is not proof of individual identity. No secret/service-role key is bundled, and the table cannot be listed by public users.
- Supabase Edge Function quota is **fully used**, so a new Edge Function attempt was rejected by the provider. No plan upgrade, extra function or billing was requested. The unused Edge files were removed from this branch.

## Key limitations

- **Email ownership is not verified.** Treat recorded rows as unverified expressions of interest, **not** confirmed marketing subscribers. Do not bulk email them until a genuine double-opt-in confirmation transport is separately installed and tested.
- The daily cap, deduplication and honeypot are basic abuse constraints, **not** proof against all bots; the public RPC is intentionally accessible.
- Support unsubscribe/deletion requests through SauceApproved's official published contact policy. Review retention before bulk outreach.
- PostgREST quotas and static-host bandwidth/build minutes remain provider-metered; using existing plans creates no new subscription but is not an unlimited-cost guarantee.
- No modification to Shopify prices, checkout, payout, DNS, Hercules public-registration gate, old services or existing Render deploys.

## Verification

```sh
node --test tests/hercules-cloud-founders.test.mjs tests/hercules-cloud-original-ui.test.mjs tests/hercules-cloud-control-plane.test.mjs
node scripts/build_hercules_cloud_preview.mjs
node scripts/verify-owner-code-only.mjs
```

Apply only the two additive SQL migrations through authorized Supabase migration tooling, verify live RLS/ACL + RPC grants, then publish **only** the same isolated static Hercules Cloud preview manually from this campaign branch, auto-deploy off. An external verified signup and confirmed email flow must precede paid advertising or bulk marketing.

### Commercial follow-on

Before charging, approve one specific downloadable software deliverable, the actual package/license/support boundaries, price, refund terms, automated digital fulfillment and a real checkout test. The free interest form does not sell a Railway replacement or an unbuilt hosting subscription.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
