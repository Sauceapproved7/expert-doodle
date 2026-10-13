# Hercules iPhone release — independent public evidence

**2026-10-13**. Canonical source: Sauceapproved7/expert-doodle. Related to issues #909 and PR #908.

The public Hercules AI shell is an installable iPhone web app (PWA), not a native Apple TestFlight binary. A healthy Render process or a green GitHub test does not establish a working iPhone product.

## Read-only public probe

The Hercules-owned Python standard-library script at scripts/hercules_iphone_launch_probe.py uses only the fixed HTTPS origin https://hercules-mcp.onrender.com. It does not accept a user-selected host or URL, follow redirects, send cookies or credentials, post customer information, write data, or alter deployments. Responses are bounded, and output includes only HTTP status and sanitized reason codes.

One uncredentialed `GET /health` is allowed up to 75 seconds to wake a cold Render free instance. The warm-up is never counted as a passed readiness check, never follows redirects, and cannot override any of the seven independently verified response/AI model checks. The entire live probe remains bounded by a three-minute GitHub job timeout. This reduces misleading cold-start failures without weakening the model-backend requirement.

It verifies:
- Hercules public HTML includes the installable manifest and service-worker references.
- The standalone manifest contains the expected icon URLs.
- The reviewed hercules-shell-v2 service-worker marker is served.
- Both icon files are PNGs and the expected Hercules process health identity is returned.
- GET /v1/models reports at least one usable model. A missing model backend, HTTP 502, invalid JSON, 3xx redirect or HTML error page must fail.

A positive result means only that these public web endpoints responded as expected. Full release certification remains false, and marketing is not authorized.

## Differentiators

1. **Credential-free stale-build evidence:** The exact service-worker version check can identify a public build that predates security PR #908 without exposing provider credentials. It is not a substitute for a verified Render deploy SHA.
2. **Backend availability truthfulness:** A healthy web server does not count as working AI until its model inventory responds with a usable model.

The workflow .github/workflows/hercules-iphone-release-probe.yml runs eight deterministic offline tests, all repository enforcement/security checks, and a separate fail-closed, read-only live public probe. It never deploys or publishes anything. A failed external probe is visible as a failing check, not presented as a success.

## Release requirements that remain separate

Compare Render's deployed commit with the reviewed GitHub commit. Diagnose the missing automatic deployments before changing production. At time of initial audit the Render service reports an old commit, and a broad restart would introduce dozens of unrelated newer commits. Do not trigger a redundant deployment on an auto-deploy-enabled service or force an unreviewed production cutover.

Verify the site on a real iPhone: Safari Add to Home Screen, standalone launch, UI, online model response, authentication and session privacy, and appropriate offline state. Verify public support/privacy/offer copy, and check social planner for duplicate promotions before publishing any free organic announcement.

A native TestFlight build would separately require a native Xcode project, supported Mac/Xcode environment, Apple developer enrollment and signing authorization. No purchases or paid promotions are part of this work.

## Reproduction

Offline tests: python3 -m unittest discover -s tests -p 'test_hercules_iphone_launch_probe.py' -v

Fixed public read-only probe: python3 scripts/hercules_iphone_launch_probe.py

## Ownership and provenance

Original Hercules implementation with AI assistance and the Python standard library; no third-party runtime source, model weights, secrets, archives, or paid dependencies were added. Existing Apache-2.0 history, third-party rights, and owner-code controls remain unchanged.
