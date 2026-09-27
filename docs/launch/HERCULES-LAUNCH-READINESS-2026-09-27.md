# Hercules Launch Readiness — 2026-09-27

## Executive state

Hercules has passed the current technical launch gate. General availability remains intentionally blocked by commercial/legal/authentication approvals and paid-billing configuration.

Latest verified production launch gate:
- technical_ok: true
- commercial_ok: false
- launch_ready: false
- checked_at: 2026-09-27T03:19:52.793709Z

## Technical launch evidence

### DevBrain fabric

Latest recorded live DevBrain check passed at 2026-09-27T03:18:36.610526Z.

- AI: pass through LLM7
- Browser: pass through the owned Hercules Browser control surface
- WASM: pass
- overall: pass

### Hercules Browser launch certification

Canonical browser production state was re-certified after the 2026-09-27 local-Chromium cutover:

- Hercules Browser **1.5.4** / Edge Function **v15 — ACTIVE**
- Browser Agent **0.12.0** / Edge Function **v16 — ACTIVE**
- canonical worker: **Hercules Browser Gateway v2**
- engine: **playwright-local-chromium**
- Browserless/CDP removed from the primary path
- LinkedIn Company Page setup navigation: succeeded in one worker attempt and stopped at LinkedIn's owner-controlled authwall
- six-request production burst: **6/6 succeeded**, one attempt each, slowest approximately **10.844 seconds**
- live Browser Agent named-link flow: succeeded and converged on `Example Domains`
- private/internal network targets and embedded URL credentials remain blocked
- raw code execution and anti-bot bypass remain disabled
- temporary direct-Chromium service retained only as rollback
- canonical Gateway v2 merge: `40cfe3510c7d59fda7d5ff9ca8fd41fb683e9506`

See `docs/launch/HERCULES-BROWSER-LAUNCH-CERTIFICATION-2026-09-27.md`.

### Production SLOs

Latest recorded launch-SLO evaluation remains:
- attestation coverage: 1.00 / target 1.00 — pass
- command success: 1.00 / target 0.95 — pass
- critical probe coverage: 1.00 / target 0.90 — pass
- critical service health: 1.00 / target 1.00 — pass
- release success: 1.00 / target 0.95 — pass

The browser worker changed after that SLO snapshot, so browser-specific claims here use the newer live Gateway v2 navigation, burst, and Browser Agent certification rather than inherited Browserless-era latency evidence.

### Operations

At the last launch-readiness snapshot:
- open service incidents: 0
- open security events: 0
- signed production release evidence was present
- verified cross-region recovery evidence was present

### Repository release controls

The launch path now also includes:
- PR #266 — bounded browser redirect recovery
- PR #267 — first-party direct Chromium fallback
- PR #268 — canonical Gateway v2 local Chromium

These changes passed the applicable implementation, security, owner-code, provenance, workflow, merge, and CodeQL gates.

## Commercial and owner-bound blockers

The launch gate currently has four pending approvals:

1. pricing
2. terms
3. privacy
4. auth_hardening

These must not be marked approved without the corresponding owner decision or production evidence.

### Canonical pricing prepared

The launch-closeout catalog matches the active production billing plans:

| Plan code | Name | Monthly | Annual |
|---|---|---:|---:|
| starter | Starter | $49 | $490 |
| pro | Pro | $149 | $1,490 |
| scale | Scale | $399 | $3,990 |

The pricing approval remains owner-gated in the authenticated Launch Decision Center.

### Stripe activation

Stripe is not yet connected. Hercules Integrations includes the owner-facing **Stripe Direct** connection card that validates the account, stores the key in Vault, and configures/reuses the signed webhook receiver after the owner supplies the Stripe secret key.

A paid launch still requires owner completion of Stripe business/identity verification, payout-bank setup, provider connection, and checkout lifecycle verification.

### Terms of Service

Draft prepared at `docs/launch/HERCULES-TERMS-OF-SERVICE-DRAFT.md`. It still requires the final owner/qualified review already identified by the launch process.

### Privacy Policy

Draft prepared at `docs/launch/HERCULES-PRIVACY-POLICY-DRAFT.md`. It still requires the final production-data/subprocessor/retention/contact verification already identified by the launch process.

### Authentication hardening

Supabase leaked-password protection remains the documented authentication-hardening blocker until production evidence shows it enabled and the security advisor is rerun cleanly.

## Social launch owner checkpoint

DA-24 automation is complete up to the provider-controlled boundary:

- the public SauceApproved LinkedIn Company Page package is prepared;
- the Hercules Integrations owner handoff exists;
- Hercules Browser Gateway v2 can reliably reach LinkedIn's authentication surface;
- no credentials, cookies, MFA codes, or Vault material are exposed through the handoff;
- no post is published by connecting the account.

Remaining work is owner/provider controlled: sign into the real LinkedIn account, accept LinkedIn terms/verification if presented, create or verify the SauceApproved Company Page, then authorize the existing Metricool brand and select that Page.

## Final launch sequence

After owner-bound decisions are complete:

1. approve final pricing;
2. configure Stripe if launch is paid;
3. finalize and approve Terms;
4. finalize and approve Privacy Policy;
5. enable and verify Supabase leaked-password protection;
6. complete the LinkedIn/Metricool owner authorization when social launch is desired;
7. configure monitored support, security, and privacy/legal contacts;
8. mark launch approvals only from verified evidence;
9. rerun the launch gate;
10. require both `technical_ok=true` and `commercial_ok=true`;
11. run one final first-customer smoke journey before unrestricted registration.

## Current conclusion

The engineering launch gate remains green.

The remaining launch blockers are owner-controlled business/legal/authentication/payment/social-provider actions, not unresolved core Hercules Browser infrastructure.
