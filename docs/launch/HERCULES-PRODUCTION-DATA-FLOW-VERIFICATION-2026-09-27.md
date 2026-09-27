# Hercules Production Data-Flow & Subprocessor Verification — 2026-09-27

**Status:** Launch verification artifact — not a published Privacy Policy  
**Entity:** SauceApproved enterprise LLC

## Purpose

This artifact records providers and data flows that are actually present in the current Hercules production architecture. It is evidence for final Privacy Policy review; it is not permission to publish stronger privacy claims than the verified configuration supports.

## Verified production processors / infrastructure

### Supabase

Current production project: `xbwuablxhhwsaoomsoco`.

Verified functions include authentication, database access, serverless/Edge Functions, usage/billing state, audit/evidence records, service monitoring, launch-gate state, and Hercules data tables.

Potential data categories handled in this layer:
- account identifiers and email;
- authentication/session state;
- workspace membership and roles;
- project/workspace content;
- prompts and AI responses stored by Hercules;
- usage and entitlement records;
- audit, security, release, recovery, and operational telemetry;
- billing/subscription metadata when payment billing is activated.

### Render

Verified active Hercules services include:
- `hercules-browser-gateway`;
- `hercules-browser-api`;
- SauceApproved Forge hosting services.

The browser gateway is the production browser control route and uses a Render-hosted Browserless upstream. It can receive:
- authorized target URLs;
- browser interaction steps;
- page content required for the requested browser operation;
- transient session state;
- technical request/error telemetry.

The gateway blocks private-network targets and does not expose raw-code execution.

### Browserless

The current `hercules-browser-api` upstream is based on the Browserless project and is hosted on the SauceApproved Render account. Browser workloads traverse the Hercules gateway before reaching this upstream.

Because the service is hosted in SauceApproved's Render workspace, Browserless is currently an upstream software/runtime dependency; Render remains the external hosting provider for this path.

### Railway / SauceApproved G4F routing

The deployed Hercules AI function routes supported AI requests through:

`https://sauceapproved-g4f-production.up.railway.app/v1/chat/completions`

The configured provider chain is:
1. LLM7
2. Yqcloud
3. KiloCode

Potential data sent through this path:
- the user's Hercules prompt;
- applicable project goal/name;
- a bounded recent-project conversation context;
- an internal system instruction needed to generate the response.

A provider that is not selected for a successful request may still receive an attempted request if an earlier provider in the failover chain fails.

### GitHub

Canonical Hercules source is stored in `Sauceapproved7/expert-doodle`.

Current GitHub use includes source control, pull requests, CI/security/provenance checks, and release/source evidence. The pending Hercules GitHub App is not yet configured and its inactive finalizer has been paused.

Customer receivable data should not be intentionally stored in the source repository.

### Lovable

The production deployment broker currently health-checks `hercules-forge-command.lovable.app` as a deployment/hosting lane. The verified broker code shown during this review performs a host check without sending customer prompt or receivable content in that health request.

Any future path that sends build artifacts or customer-derived content to Lovable must be re-verified before the public Privacy Policy describes that flow.

## Connected-but-not-active provider records

The Hercules provider registry currently contains pending/credential-required records for:
- `github_forge`;
- Google Drive knowledge vault;
- Shopify production integration.

A pending record is not evidence that customer data is currently flowing to that provider through Hercules. Public privacy disclosures should distinguish live processing from planned or optional integrations.

## Payment processing

Stripe is not yet connected in the current Hercules provider state.

Before a paid public launch:
- connect the approved payment provider;
- keep raw payment-card data out of Hercules when provider-hosted payment collection is used;
- verify exactly which customer/billing fields Hercules stores;
- verify webhook signing and event processing;
- update the public Privacy Policy/subprocessor list to reflect the live payment flow.

## AI retention/training verification still required

The current runtime verifies the routing path and provider names, but it does **not** by itself establish the downstream providers' current retention or model-training policies.

Before final Privacy approval, verify current contractual/policy terms for:
- Railway as hosting infrastructure;
- LLM7;
- Yqcloud;
- KiloCode;
- any additional provider added to the production chain.

Do not state "no training" or a fixed retention period without provider-specific evidence.

## Customer deletion/export verification still required

The current Privacy draft describes access/export/deletion rights conditionally. Before making a public operational commitment:
- identify the supported request channel;
- verify the exact deletion path for customer workspace data;
- define treatment of required audit/security/legal records;
- define backup expiration behavior;
- verify exports are complete for the supported launch data set.

## Launch conclusion

This artifact narrows the remaining Privacy work to policy/contract verification and customer-rights operations. It does not mark the `privacy` launch approval as approved.
