# Hercules iPhone distribution and free organic launch gate (candidate)

## Decision: use the existing iPhone-installable web app first

The canonical Hercules AI runtime has a mobile web app with an Apple touch icon,
standalone manifest, and service worker. This source-level readiness **does not**
establish that the app is publicly reachable, has a working model backend,
can process paid orders, or has passed on-device smoke tests.

**No advertising purchase, Apple account enrollment, TestFlight upload,
production DNS change, or public post is authorized by this candidate.**

## Release gate for the no-new-fee path

1. Identify the approved public HTTPS host for the *Hercules AI UI* specifically
   (not the unrelated Mobile Ops, browser, MCP, or Shopify hosts).
2. Read-only verify TLS, page, manifest, touch icon, and service-worker delivery
   on that exact host. Record URL and timestamp.
3. On an iPhone with Safari, verify install via Share → Add to Home Screen,
   standalone launch, online chat/request behavior, session boundaries and
   device-specific layout. An offline shell must **not** suggest inference,
   payments or authentication are available.
4. Confirm public privacy/support terms, brand permissions, model capabilities
   and the exact truthful offer before sending any visitors.
5. After these gates pass, prepare a single free organic announcement through
   currently approved SauceApproved social channels. Link only to the verified
   public HTTPS URL; check the planner for earlier posts to avoid duplicates.
   No paid ads and no auto-post until the source link and release are verified.

## Draft organic launch copy (not published)

**Hercules by SauceApproved — iPhone early access**

Explore Hercules from your phone. Open the verified Hercules web app in Safari
and choose **Share → Add to Home Screen** for quick access. We're collecting
early feedback on the experience.

**CTA:** Visit the verified Hercules URL. Do not replace this line with an
unverified domain, or claim that the app is in the App Store or TestFlight.

## Why native TestFlight stays separate

TestFlight distributes native Apple builds, not just a web manifest. A credible
native build requires a real iOS Xcode project and meaningfully native utility,
Apple developer account/signing, a macOS/Xcode 26+ runner, review details,
privacy disclosures, device tests, and a valid App Store Connect build.
Apple's guideline 4.2 rejects apps that are merely repackaged websites.

The canonical repository had no native Xcode project in the inspected tree on
2026-10-13; its Hercules mobile control is a separate read-only staging tool.
Do not represent the existing PWA as an approved native iOS build.

Apple references:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/news/upcoming-requirements/
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

## Security/provenance of this change

This candidate narrows offline caching to the same-origin public app shell.
Authenticated API GETs, requests with query parameters, OAuth routes, POSTs,
and cross-origin requests are never substituted with cached homepage HTML.
Tests exercise real service-worker fetch-handler behavior in an isolated Node
VM with no network calls. Implementation is original project-authored code
using standard browser APIs and Node built-ins only. No private keys or
third-party runtime packages are added.

Source of truth: Sauceapproved7/expert-doodle, after a reviewed/merged commit.
This document is a candidate plan until merged and independently deployed.
