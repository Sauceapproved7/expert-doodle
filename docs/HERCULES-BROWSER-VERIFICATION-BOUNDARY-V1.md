# Hercules Browser Verification Boundary V1

## Purpose

Hercules Browser must distinguish a provider security-verification page from a successfully loaded application page.

When a browser result contains recognized Cloudflare or CAPTCHA-style verification markers, Hercules classifies the result as `security_verification_required`. The browser session is preserved so a legitimate provider-approved verification or authenticated continuation can reuse it.

## Runtime behavior

The low-level `hercules-browser` gateway:

- detects verification markers in the returned page title, text, and URL;
- records the browser run as blocked rather than succeeded;
- returns `status: "verification_required"`;
- returns the existing worker session identifier without attempting to solve the challenge.

The bounded `hercules-browser-agent` applies the same boundary:

- immediately after navigation;
- after page scraping;
- after an interaction changes the page.

When the boundary is reached, the agent stops before further planning or interaction and preserves the session.

## Authorized continuation

Provider security controls are not bypassed. For SauceApproved domain launch work, Hercules uses the already implemented authorized Spaceship DNS API/private-bridge path when registrar API credentials are available. The domain-launch autopilot remains responsible for continuing the DNS reconciliation and Shopify verification workflow once legitimate authorization exists.

## Safety properties

- no CAPTCHA solving or anti-bot bypass;
- no extraction of cookies, session tokens, or registrar secrets;
- no private-network navigation;
- no change to existing browser-agent high-impact autonomy restrictions;
- existing session-recovery and observation controls remain intact.
