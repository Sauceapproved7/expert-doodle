# Hercules Owner Checkpoint Broker v1

## Purpose

Hercules must not lose or restart work merely because a provider requires an owner-controlled authorization step.

The broker keeps that work durable and resumable without making Opera or any specific desktop browser a dependency.

## Behavior

- Stores pending authorization work in the private Postgres schema.
- Stores no passwords, MFA values, CAPTCHA responses, cookies, OAuth tokens, or provider secrets.
- Checks the existing Hercules provider registry for legitimate active authorization evidence.
- Requires an active provider record plus connected/access-secret/explicit authorization evidence before a checkpoint becomes ready.
- Rechecks pending checkpoints every five minutes through Supabase Cron.
- Never treats missing consent as granted.
- Never attempts to bypass login, MFA, CAPTCHA, terms, or provider security controls.

## DA-24

The first seeded checkpoint is `DA-24:linkedin-owner-auth`.

Current evidence from Metricool shows the SauceApproved brand exists but has no connected social network. The checkpoint therefore remains `pending_owner_auth` until a legitimate active LinkedIn authorization appears in the Hercules provider registry.

When it becomes ready, the continuation workflow can proceed with:
1. verifying or creating the SauceApproved Company Page through supported provider flows;
2. connecting the existing Metricool brand;
3. confirming scheduling availability;
4. publishing nothing merely because the connection completed.

## Browser routing

Hercules Gateway v2 / owned cloud Chromium remains the default browser execution path. The Personal Browser Bridge is optional. Opera is not required.
