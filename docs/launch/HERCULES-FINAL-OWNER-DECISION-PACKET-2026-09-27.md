# Hercules Final Owner Decision Packet — 2026-09-27

**Status:** PRELAUNCH — public registration remains explicitly held closed  
**Entity:** SauceApproved enterprise LLC

The technical launch path is green. This packet contains only the remaining decisions/actions that cannot safely be inferred or approved on the owner's behalf.

## Already completed / verified

- Connecticut Certificate of Organization approved and archived in the Hercules Vault.
- Connecticut Acceptance Notice archived.
- Hercules technical launch gate passes.
- Production SLOs pass.
- Latest verified DevBrain fabric passes AI, Hercules Browser, and WASM.
- Synthetic first-customer onboarding certification passes.
- Public registration is fail-closed at both UI and workspace-bootstrap layers.
- A separate owner-controlled `public-registration-open` release switch exists and is currently held closed.
- Inactive GitHub App finalizer noise has been stopped.
- Terms and Privacy drafts are prepared.
- Auth/security review is prepared.

## Owner decision 1 — Final paid-launch pricing

Two different price sets currently exist and must not be mixed.

### Current production database plans
- Starter — $49/month; $490/year
- Pro — $149/month; $1,490/year
- Scale — $399/month; $3,990/year

### Earlier proposed launch prices
- Starter — $99/month
- Growth — $249/month
- Scale — $599/month

**Required decision:** select the one price structure Hercules will actually sell at launch. After that decision, align database plans, public copy, payment products/prices, entitlements, checkout, and Terms.

## Owner action 2 — Business banking / payment account

For a paid launch, complete the identity-verified business-bank onboarding for SauceApproved enterprise LLC.

State formation evidence is now ready in the Vault. IRS/EIN naming reconciliation remains an administrative follow-up and the bank/payment provider must receive the exact tax identity information it requires.

After the business account is available:
1. connect the approved payment processor;
2. set the business checking account as the payout account;
3. configure the final Hercules products/prices;
4. verify signed webhooks;
5. run a real/sandbox end-to-end checkout, subscription, cancellation, refund, and payout-state test as applicable.

No raw bank username/password should be stored in Hercules.

## Owner action 3 — Production Auth hardening

Supabase currently reports leaked-password protection disabled.

Enable leaked-password protection in the production project's Auth password-security settings. After that action, rerun the security advisor and require the warning to clear before `auth_hardening` is approved.

## Owner decision 4 — Final Terms

The existing Terms draft is prepared around a narrow B2B launch: businesses managing their own commercial receivables.

Proposed launch exclusions:
- third-party debt collection;
- consumer credit reporting;
- legal services;
- guaranteed recovery claims;
- uncontrolled autonomous external collection actions.

Final Terms still require affirmative approval of:
- liability limitation;
- indemnification;
- governing law/venue/disputes;
- cancellation/refunds;
- exact paid plan language;
- support/legal contact.

## Owner decision 5 — Final Privacy

Production data-flow verification is recorded in:
`docs/launch/HERCULES-PRODUCTION-DATA-FLOW-VERIFICATION-2026-09-27.md`.

Remaining Privacy approval work:
- verify current retention/training policies for the production AI providers;
- finalize deletion/export procedures;
- configure monitored privacy contact;
- add the payment processor once connected;
- ensure final public wording matches the live architecture.

## Owner action 6 — Spaceship registrar authorization

The earlier Shopify-domain ambiguity is resolved. Live Shopify Admin data confirms one production shop:

- Shop GID: `gid://shopify/Shop/100002726208`;
- original myshopify domain: `azymhc-x0.myshopify.com`;
- current primary domain: `sauceapproved-2.myshopify.com`;
- current primary-domain SSL: enabled.

These domains are the same Shopify shop identity, not separate stores. The same shop contains the expected active Printify SauceApproved hoodie with 29 variants.

Current custom-domain state:
- `sauceapproved.com`: owned and registered in Hercules, connection still pending;
- public A records currently resolve to `34.216.117.25` and `54.149.79.189`;
- no apex AAAA is currently published;
- no `www` CNAME is currently published;
- nameservers are `launch1.spaceship.net` and `launch2.spaceship.net`;
- desired Shopify records remain A `@` → `23.227.38.65`, AAAA `@` → `2620:0127:f00f:5::`, and CNAME `www` → `shops.myshopify.com`.

Hercules Domain Launch Controller v1 is deployed, and Hercules Integrations now automatically continues from secure Spaceship credential setup into DNS reconciliation and provider-result verification.

The only remaining owner-only domain action is legitimate Spaceship authorization: create/authorize a least-privilege API credential with `dnsrecords:read` and `dnsrecords:write` and submit it through Hercules Integrations. Do not paste registrar secrets into chat.

Automated browser navigation remains blocked by Spaceship's Cloudflare verification and must not be bypassed. After authorized DNS access is available, Hercules handles DNS reconciliation, then verifies Shopify custom-domain recognition and SSL before any primary-domain cutover.

## Administrative follow-up — IRS/EIN naming

The existing IRS EIN evidence is retained privately. The current IRS naming record does not yet clearly match the new LLC legal name.

Do not create a second EIN merely to resolve a naming mismatch. Complete the IRS reconciliation using the applicable official process and preserve the acknowledgement in the Vault.

## Final release sequence

Public release stays closed while all items above are completed.

When all required approvals/evidence are green:
1. rerun security advisor;
2. rerun technical + commercial launch gate;
3. run final customer journey;
4. run paid checkout/payment tests if paid launch;
5. verify custom domain/SSL;
6. verify support/privacy/legal contacts;
7. review launch evidence packet;
8. obtain explicit owner authorization to open public registration;
9. change the separate `public-registration-open` switch from held/false to active/true;
10. verify the public signup path after release.

Until step 8, Hercules must remain sign-in-only for existing authorized users.
