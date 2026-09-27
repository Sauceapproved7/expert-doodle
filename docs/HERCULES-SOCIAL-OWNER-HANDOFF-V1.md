# Hercules Social Owner Handoff v1

Date: 2026-09-27  
Linear: DA-24  
First channel: LinkedIn Company Page  
Scheduling/analytics connection: Metricool brand 6894246

## Purpose

Provide a Hercules-owned handoff surface for creating and connecting the first SauceApproved social account without moving provider credentials, browser sessions, MFA/2FA values, or Hercules Vault material into Hercules.

The handoff lives in the existing Hercules Integrations UI. It does not create a personal LinkedIn profile for the business and it does not publish content.

## Public package exposed by the handoff

Only the already-approved public LinkedIn company-page fields are shown:

- Page name: SauceApproved
- Legal entity: SauceApproved enterprise LLC
- Industry: Software Development
- Company type: Privately Held
- Public tagline
- Tracked SauceApproved website URL

No private launch records, Vault notes, passwords, cookies, session tokens, recovery codes, MFA values, or unpublished implementation material are displayed.

## Owner-controlled boundary

The owner remains responsible for provider-controlled actions that cannot be delegated safely:

1. Sign into a real personal LinkedIn account.
2. Create or verify the SauceApproved Company Page.
3. Accept LinkedIn terms/authorization and complete any required email, phone, identity, CAPTCHA, or MFA verification.
4. Open the existing Metricool brand connection page.
5. Authorize LinkedIn access requested by Metricool and select the SauceApproved Company Page.
6. Approve any paid-plan change if Metricool requires one.

Hercules does not bypass, imitate, replay, or manufacture any of these approvals.

## Automatable after authorization

After the owner-authorized provider flow succeeds:

1. Verify Metricool reports LinkedIn as connected.
2. Verify scheduling availability can be read for LinkedIn.
3. Confirm the Page identity/URL matches the prepared SauceApproved package.
4. Record current evidence in DA-24.
5. Keep publishing separate; connection alone must not publish a post.

## Browser fallback evidence

At implementation time the Opera Browser Connector reported that the browser was not connected. The TinyFish browser fallback was also unavailable because its wallet balance was below zero.

The repository therefore implements a direct owner-handoff path inside the existing Hercules Integrations surface. This is an authorized alternative route, not an authentication or anti-bot bypass.
