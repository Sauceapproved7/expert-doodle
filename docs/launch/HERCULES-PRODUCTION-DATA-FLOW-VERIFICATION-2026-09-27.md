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

### Render / standalone Hercules Browser

The canonical Hercules browser worker is `hercules-browser-standalone`, hosted in the SauceApproved Render workspace.

Verified runtime characteristics:
- engine: `playwright-local-chromium`;
- owned standalone PWA and server-side browser API;
- one-time Supabase broker authentication;
- session reuse and bounded autopilot;
- private-network targets blocked;
- raw-code execution disabled;
- anti-bot bypass disabled.

Browser requests can process:
- authorized target URLs;
- browser interaction steps;
- page content required for the requested browser operation;
- transient/persistent session state required by Hercules workflows;
- technical request/error telemetry.

Gateway v2 remains a rollback path. Browserless is no longer the canonical browser runtime for the verified production path.

### Railway / SauceApproved G4F routing

The deployed Hercules AI function routes supported AI requests through:

`https://sauceapproved-g4f-production.up.railway.app/v1/chat/completions`

The production provider chain is:
1. LLM7
2. KiloCode

Yqcloud was removed from the launch allowlist because a current provider privacy/retention policy could not be independently verified.

Potential data sent through this path:
- the user's Hercules prompt;
- applicable project goal/name;
- a bounded recent-project conversation context;
- an internal system instruction needed to generate the response.

A provider that is not selected for a successful request may still receive an attempted request if an earlier provider in the failover chain fails.

### AI-provider privacy evidence

#### LLM7

The LLM7 privacy policy reviewed on 2026-09-27 is dated July 10, 2026. It states:
- account/email data is retained while an account exists;
- token/usage logs are retained as necessary to operate, secure, and account for the service;
- verified deletion/account-deletion requests are targeted for deletion or anonymization within 30 days;
- residual backups may persist for up to 90 days.

The reviewed policy does not provide a blanket no-training guarantee for Hercules prompts. Hercules therefore makes no such claim.

Evidence source:
- `https://github.com/chigwell/llm7.io/blob/main/PRIVACY.md`

#### Kilo Code

The Kilo Code privacy materials reviewed on 2026-09-27 are dated May 29, 2026. They state that prompts/conversation content may be routed to selected AI providers to generate responses and that provider-specific handling applies. Kilo's terms also acknowledge that some AI models may use Customer Data for training unless the applicable model/provider path is configured otherwise.

Hercules therefore does not claim that all Kilo-routed prompts are excluded from model training.

Evidence sources:
- `https://kilo.ai/privacy`
- `https://kilo.ai/privacy/apps`
- `https://kilo.ai/terms`

#### Railway

Railway hosts the SauceApproved G4F routing service. Railway's current DPA states that it purges or anonymizes customer data/customer content when a customer deletes its Railway account and supports data portability and erasure requests.

Evidence source:
- `https://railway.com/legal/dpa`

### GitHub

Canonical Hercules source is stored in `Sauceapproved7/expert-doodle`.

Current GitHub use includes source control, pull requests, CI/security/provenance checks, and release/source evidence. Customer receivable data should not be intentionally stored in the source repository.

### Lovable

The production deployment broker may health-check SauceApproved Lovable deployment lanes without sending customer receivable content in the verified health request.

Any future path that sends build artifacts or customer-derived content to Lovable must be re-verified before the public Privacy Policy describes that flow.

## Connected-but-not-active provider records

Pending or credential-required provider records are not evidence that customer data is currently flowing to that provider through Hercules. Public privacy disclosures must distinguish live processing from planned or optional integrations.

## Payment processing

Stripe is not yet connected in the current Hercules provider state.

Before a paid public launch:
- connect the approved payment provider;
- keep raw payment-card data out of Hercules when provider-hosted payment collection is used;
- verify exactly which customer/billing fields Hercules stores;
- verify webhook signing and event processing;
- update the public Privacy Policy/subprocessor list to reflect the live payment flow.

## AI retention/training conclusion

Current evidence is sufficient to describe the verified LLM7, Kilo Code, Railway, Supabase, Render, and GitHub paths without claiming universal no-training or zero-retention behavior.

Any additional AI provider added to the production chain requires a fresh privacy/retention review before becoming launch-eligible.

## Customer deletion/export verification still required

Before making a public operational commitment:
- identify the supported request channel;
- verify the exact deletion path for customer workspace data;
- define treatment of required audit/security/legal records;
- define backup expiration behavior;
- verify exports are complete for the supported launch data set.

## Launch conclusion

The AI-provider evidence gap has been narrowed by removing Yqcloud and documenting the remaining live provider policies. Remaining Privacy work is customer-rights operations, a monitored privacy contact, launch-market disclosures, and the payment-provider flow once billing is activated.

This artifact does not mark the `privacy` launch approval as approved.
