# Hercules iPhone isolated static preview (layout only)

A generated, preview-only iPhone PWA from original Hercules source, without altering the live Hercules MCP Render service, checkout, payout, DNS, OAuth, or any other production software. Related to issue #909.

## What it proves
- Reviewable original Hercules layout rendered as a static installable PWA over an HTTPS static site.
- The standalone `manifest.json`, service worker, and two shield/H icons are generated from owner-authored source.
- No live chat, AI inference, user authentication, checkout, or customer operations.
- No marketing or open public registration. The visible PREVIEW ONLY banner prevents confusion with a working app.
- Safari install, offline shell, layout and accessibility must still be tested on an actual iPhone.

## What it does NOT prove
It is NOT Hercules AI production, native TestFlight, an App Store release or a paid product. It cannot verify the actual model backend, which has returned HTTP 502 at /v1/models, nor replace missing Render GitHub linkage. A model-plane service with verified conversation inference is still required before public promotion.

## Build locally / in GitHub
`python3 scripts/build_hercules_iphone_static_preview.py`

Generated location: `dist/hercules-iphone-preview`. Binary images are generated, never committed. Run `python3 -m unittest discover -s tests -p 'test_hercules_iphone_static_preview.py' -v` and Hercules owner-code/security/contract checks.

## Optional isolated Render static site
From canonical repo `Sauceapproved7/expert-doodle`, use a reviewed branch or main at reviewed commit. Build command `python3 scripts/build_hercules_iphone_static_preview.py` and publish path `dist/hercules-iphone-preview`. Keep auto-deploy off and do not advertise the unreviewed preview URL. Its own HTTPS URL must be verified for the five public assets, and then tested on an iPhone.

Render static sites are free to deploy but consume the workspace's included bandwidth and pipeline minutes, with potential overage billing at the applicable plan rate. Do not present this as unlimited free traffic, do not turn on paid plans, and do not publish customer-facing marketing without verified live AI readiness.

## Ownership / provenance
Original Hercules UI, existing guarded worker, and Python standard-library generated icon geometry derived from Hercules-owned main.py, with AI assistance. No external source, packages, binaries or account credentials are embedded.
## Manifest MIME repair
Render’s static CDN responded with a media type not accepted by the app-manifest checker for `/manifest.webmanifest`. The isolated preview build therefore emits `manifest.json` and rewrites only its own HTML link and its own generated service-worker cache entry. The Hercules production service, its manifest path, and authentication/AI endpoints are unchanged. Validate the resulting `application/json` response with the independent public smoke test before treating the static preview as verified.
