# SauceApproved Studio founding-access page: clarity and accessibility

## Scope

This change improves the existing `hercules-forge/offers/sauceapproved-studio/index.html` landing page. It does not create a new product, change the Ads page, move WordPress domains, deploy a site, or change Shopify, checkout, customer registration, or the Supabase access-request contract.

## User experience

- Keyboard visitors can skip to the main content; visible focus indicators make controls easier to navigate.
- Every active form field has an explicit programmatic label, and the submission response is announced by a polite live region.
- A short feature section distinguishes evidence-backed production and owner-controlled release. These explain existing workflow characteristics without implying automatic billing or an approved live purchase path.
- The existing planned monthly prices, founding-access form, product URL, and early-access commercial caveats remain unchanged.

## Verification

1. The new `tests/hercules-studio-offer-accessibility.test.mjs` regression checks initially failed against the unmodified HTML for missing navigation, labels, live-region, and explanation features.
2. The change does not edit or replace the embedded form submission script or outbound service URL.
3. The relevant tests must pass in GitHub CI on the exact pull-request head before merge.
4. Before any deployment, a real keyboard/mobile/browser review and release-policy verification are still required. A CI pass is not proof of production publication or checkout readiness.

## WordPress boundary

WordPress.com site-scoped MCP editing is unavailable for the connected account on its current plan, and no native WordPress-to-GitHub connection was verified. This code is maintained in the canonical Hercules GitHub repository only. WordPress publication requires a separately authorized, supported publishing route.

## Provenance

First-party SauceApproved landing-page content and tests, AI-assisted original authoring, October 14, 2026. No copied third-party templates, new packages, externally sourced assets, credentials, or customer data. All original upstream licensing and ownership boundaries remain intact.
