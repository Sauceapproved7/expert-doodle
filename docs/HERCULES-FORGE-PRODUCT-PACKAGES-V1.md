# Hercules Forge Product Packages v1

## Purpose

Forge now carries first-class commercialization packages for three existing SauceApproved-owned products:

- **SauceApproved Studio** — AI Video Maker, built from the canonical `hercules-video/` product core.
- **SauceApproved Ads** — AI Ad Maker, built from the canonical `hercules-forge/ad-studio/index.html` product core.
- **Hercules Cleaner** — recoverable computer maintenance, built from the canonical `hercules-cleaner/` local-agent core.

The package layer does not replace either product core. It gives Hercules Forge a durable productization contract that can be loaded into the owned builder, revised, previewed, released and later transported by the deploy plane.

## Builder behavior

The Forge operator console exposes both packages as quick starts. Loading one pre-fills:

- a stable Forge project id;
- the canonical owned source roots;
- the product name and descriptor;
- the SaaS packaging requirements;
- plan/entitlement intent;
- the commercialization gates that must remain closed until verified.

The normal Forge flow remains unchanged:

`PLAN -> BUILD -> VALIDATE -> DEPLOY -> VERIFY`

## Independent deployment lane

Product-package releases use the SauceApproved-owned control path:

`Hercules Forge Builder -> Hercules Deploy -> Supabase archive/origin -> Render presentation -> live verification`

AppDeploy is an optional external adapter, not a required release dependency. AppDeploy quotas or deployment-credit ceilings must not block Studio or Ads from moving through the owned Forge release path. Provider-specific outages remain isolated behind replaceable adapters and do not grant permission to bypass authentication, release admission, provenance, or verification controls.

## Candidate plans

The current packages carry the same initial candidate monthly structure:

| Plan | Candidate monthly price |
| --- | ---: |
| Starter | $29 |
| Pro | $79 |
| Agency | $199 |

These amounts are **not active pricing**. Their status is `owner_approval_required`.

## Fail-closed commerce gate

Checkout remains disabled until all of the following have verified evidence:

1. pricing approval;
2. Terms approval;
3. Privacy approval;
4. payment-provider readiness;
5. a controlled paid-checkout verification.

The package definitions therefore separate *sellable product design* from *authorized live commerce*. Forge may build and validate the product surface before those decisions, but it must not represent checkout as active.

## SauceApproved Studio scope

The Studio package preserves Hercules Video routing, storyboard/shot policy, quality gates, provenance, assembly evidence, persistent launch state and provider abstraction. Productization adds the surrounding customer SaaS requirements:

- public product and pricing experience;
- authenticated customer workspace;
- server-side plan entitlements and usage-metering hooks;
- billing adapter and verified subscription state;
- customer billing/status surface;
- Terms and Privacy surfaces;
- mobile/accessibility/loading/error/empty states;
- release evidence and rollback metadata.

## SauceApproved Ads scope

The Ads package preserves the existing deterministic Ad Studio core: messaging angles, creative export, campaign JSON, budget planning, UTM construction, performance ledger, backup/import and local validation. Productization adds the same SaaS shell and commerce controls while retaining the current deterministic core rather than replacing it with a duplicate hosted-builder app.

## Hercules Cleaner scope

The Cleaner package preserves local-first file authority, protected defaults, bounded scans, Session Clean, Recovery Capsules, localhost-only dashboard control, native user-level scheduling adapters and exact-commit release evidence. Commercial packaging adds Forge discovery and later web commerce, but local file metadata and cleanup execution stay on the customer device.

## Ownership boundary

The product-package catalog, quick-start integration and productization prompts are canonical Hercules Forge source. External payment systems, hosting runtimes, model/render engines and other infrastructure remain explicit replaceable dependencies. No external infrastructure is represented as SauceApproved-owned code.

## Verification

The package contract is covered by `tests/hercules-forge-product-packages.test.mjs` and the existing Forge PR workflow:

```
node scripts/verify-owner-code-only.mjs
node --test tests/hercules-forge*.test.mjs
```

Exact-head CI must pass before merge.
