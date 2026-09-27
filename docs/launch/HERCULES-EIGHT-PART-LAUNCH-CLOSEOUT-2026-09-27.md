# Hercules Eight-Part Launch Closeout — 2026-09-27

## Status

This record captures the eight launch-closeout actions requested by the owner and the exact current production state after execution.

Repository state used for this closeout:

- canonical repository: `Sauceapproved7/expert-doodle`
- closeout merge: `72f12061fb048eff06d6032ec930d3bc2e9fc686`
- Hercules Integrations: production Edge Function v14
- Hercules launch-onboarding E2E: production Edge Function v11

## 1. Authentication hardening

**Status: OWNER PLATFORM ACTION REQUIRED**

Completed:
- production Supabase security advisor rerun;
- authenticated SECURITY DEFINER exposure remains cleared;
- current advisor evidence captured.

Current blocking finding:
- `auth_leaked_password_protection` — leaked-password protection is disabled.

The connected Supabase control surface available to Hercules does not expose a safe Auth-settings mutation for this project. This setting must be enabled through an authorized Supabase account/dashboard path and then re-verified by the security advisor.

Public launch remains fail-closed while this warning is present.

## 2. Canonical pricing

**Status: IMPLEMENTATION COMPLETE / OWNER APPROVAL PENDING**

The stale $99 / $249 / $599 proposal was retired from the canonical launch pricing document.

Current production-aligned catalog:

- Starter — $49/month or $490/year
- Pro — $149/month or $1,490/year
- Scale — $399/month or $3,990/year

The production database and canonical launch documentation now agree.

The `pricing` launch approval remains pending because Hercules intentionally requires the authenticated owner decision flow and does not infer approval from chat text.

## 3. Payments / Stripe

**Status: HERCULES SIDE READY / OWNER PAYMENT ACCOUNT ACTION REQUIRED**

Completed:
- secure Stripe Direct connection card added to Hercules Integrations;
- Stripe secret field is password-masked and cleared after submission;
- existing Hercules provider connection validates the Stripe account;
- secret key is stored in Supabase Vault;
- webhook endpoint is created or reused;
- webhook signing secret is Vault-backed when created;
- checkout, subscription, and invoice lifecycle webhook events are registered;
- activation packet prepared at `docs/launch/HERCULES-STRIPE-ACTIVATION-PACKET-2026-09-27.md`.

Remaining owner/provider actions:
- complete Stripe business/identity verification;
- connect the SauceApproved Enterprise LLC payout bank account;
- enter the Stripe secret key only through authenticated Hercules Integrations;
- verify live/test mode and run controlled checkout/cancel/refund tests.

Current Hercules provider state contains no active Stripe connection.

## 4. Custom domain

**Status: OWNER HUMAN-VERIFICATION ACTION REQUIRED**

Completed:
- `sauceapproved.com` remains registered in Hercules;
- Shopify storefront is ready except the custom domain;
- Spaceship OAuth flow was started through the approved service-role launcher;
- Hercules Browser navigated the provider authorization URL;
- provider returned a Cloudflare security challenge;
- Hercules stopped with:
  - security challenge detected;
  - provider `cloudflare`;
  - `humanVerificationRequired = true`;
  - `bypassAttempted = false`.

Current domain state:
- intended domain: `sauceapproved.com`
- Shopify primary host: `sauceapproved-2.myshopify.com`
- intended domain present in Shopify: false
- intended-domain SSL: false
- Spaceship OAuth: `pending_authorization`.

The remaining step is the legitimate owner login / provider human verification. Hercules will not bypass Cloudflare, MFA, identity verification, or provider access controls.

## 5. Terms and Privacy

**Status: FINAL CANDIDATES PREPARED / OWNER OR QUALIFIED REVIEW PENDING**

Completed:
- Terms upgraded to final candidate v0.2;
- production pricing inserted;
- billing/cancellation/refund candidate language added;
- Connecticut governing-law candidate added;
- liability and indemnification candidate language added;
- Privacy upgraded to final candidate v0.2;
- verified production infrastructure/data-flow inventory incorporated;
- current AI-routing providers and limitations documented;
- Stripe remains explicitly described as not yet connected.

Documents:
- `docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md`
- `docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md`

The `terms` and `privacy` launch approvals remain pending because the authenticated owner decision center requires explicit review/confirmation.

## 6. Final first-customer journey

**Status: PASS**

The first production run exposed a regression: the synthetic E2E still called the retired authenticated `hercules_bootstrap_organization` RPC.

Fix:
- E2E now uses the service-role-only `hercules_bootstrap_organization_internal` path;
- production function redeployed as v11;
- public-registration protections remain intact.

Final production E2E result: **PASS**.

Verified proof:
- signed in;
- zero pre-existing organizations;
- workspace provisioned;
- active membership;
- project created;
- AI succeeded via LLM7;
- Knowledge Registry accessible;
- Forge accessible;
- deployment history accessible;
- Starter trial created;
- wallet registered;
- testnet-only enforcement active;
- mainnet locked;
- private-key material rejected;
- unlimited approval blocked;
- blocked review could not broadcast;
- simulation remained server-authoritative.

The synthetic user/workspace/project are cleaned up by the E2E routine.

## 7. Final launch gate

**Status: TECHNICAL PASS / COMMERCIAL HOLD**

Fresh production gate result at 2026-09-27 12:10 UTC:

- `technical_ok = true`
- `commercial_ok = false`
- `launch_ready = false`

Technical checks passing:
- launch surface;
- fresh DevBrain;
- signed production release;
- verified cross-region recovery;
- no open critical security events.

Commercial approvals still pending:
- auth hardening;
- pricing;
- Terms;
- Privacy.

## 8. Public release

**Status: CORRECTLY HELD CLOSED**

The independent continuity-ledger switch remains:

- key: `public-registration-open`
- status: `held`
- value: `{"open": false}`

Hercules did not open registration because the final commercial gate is not green and the release switch is intentionally a separate explicit owner-controlled action.

## Final closeout conclusion

All automatable engineering, documentation, verification, and production-deployment work in the eight-part request has been completed.

The remaining actions are intentionally outside autonomous execution:

1. enable Supabase leaked-password protection through an authorized platform session;
2. complete Spaceship login / Cloudflare human verification;
3. complete Stripe business verification and payout-bank setup and connect the Stripe key through Hercules;
4. approve Pricing, Terms, and Privacy through the authenticated owner decision center;
5. after those checks pass, explicitly authorize the separate public-registration release switch.

No authentication, payment, registrar, security-verification, or owner-approval boundary was bypassed.
