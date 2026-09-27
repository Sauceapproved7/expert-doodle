# Hercules Domain Launch Autopilot v1

Date: 2026-09-27 UTC

## Purpose

Keep the SauceApproved production-domain launch moving without repeatedly asking the owner to perform steps Hercules can do itself.

The autopilot is intentionally fail-closed. It never fabricates registrar authorization and never bypasses Spaceship login, Cloudflare verification, CAPTCHA, 2FA, or other owner-only security controls.

## State machine

The singleton launch state moves through:

1. `waiting_authorization`
2. `dns_reconcile`
3. `dns_propagation`
4. `shopify_attach_pending`
5. `complete`

A `blocked` stage records a real provider conflict or reconciliation failure.

## Autonomous behavior

Every five minutes Hercules:

- checks whether the legitimate Spaceship DNS credential is configured;
- reuses the existing fail-closed Spaceship reconciliation instead of duplicating provider logic;
- deduplicates against recent reconciliation runs;
- waits for the provider write to succeed;
- probes public A, AAAA, CNAME, and NS through DNS-over-HTTPS;
- requires the exact Shopify web-routing set before advancing;
- updates the canonical `hercules_domains` metadata with observed public DNS;
- marks the launch `shopify_attach_pending` when public DNS is ready.

## Safety boundary

The autopilot stops before Shopify custom-domain attachment and primary-domain promotion. Those stages require Shopify to recognize the custom domain and provision SSL first.

Registrar credentials remain in Vault and never enter the autopilot state table, status function, audit metadata, or Git repository.

## Current owner involvement

The only unresolved owner-only action remains legitimate Spaceship authorization. Once that occurs, DNS reconciliation and propagation verification no longer need a manual continuation step.
