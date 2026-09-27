# Hercules Browser Gateway v2 — Production Cutover

Date: 2026-09-27  
Status: **canonical production worker**

## Canonical path

`operator -> hercules_browser_submit -> hercules-browser v15 -> Hercules Browser Gateway v2 -> local Chromium`

Gateway v2 runs Chromium inside the SauceApproved/Hercules-owned Render service instead of connecting to Browserless over CDP.

Production service:
- name: `hercules-browser-gateway-v2`
- Render service ID: `srv-dasi97bncjis73a8r6m0`
- URL: `https://hercules-browser-gateway-v2.onrender.com`
- engine: `playwright-local-chromium`
- source PR: #268
- merged main SHA: `40cfe3510c7d59fda7d5ff9ca8fd41fb683e9506`

## Live verification

After cutover:
- LinkedIn Company Page setup navigation succeeded in one worker attempt and reached LinkedIn's authwall;
- six concurrent Example Domain submissions completed 6/6, one worker attempt each;
- slowest burst completion was approximately 10.844 seconds;
- Browser Agent followed Example Domain to IANA and returned `Example Domains`;
- no provider authentication or human-verification control was bypassed.

## Security contract

Gateway v2 requires bearer authentication for `/v1/run`, blocks private/internal targets and embedded URL credentials, validates DNS resolution, bounds browser actions and extracted content, expires reusable session IDs, and exposes no raw-code execution or anti-bot bypass.

The worker bearer token is stored in Hercules Vault; raw token material must never be committed or surfaced to clients.

## Rollback order

1. `hercules-browser-direct` — verified local-Chromium rollback.
2. legacy Browserless-backed gateway — retained only as older rollback material, not the primary path.

Any rollback must preserve the owned-browser safety contract and be followed by a live production navigation check.
